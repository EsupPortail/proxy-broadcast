#!/usr/bin/env nodejs

// Usage:
//
// - for now, this script uses JSESSIONID cookie as the stickysession parameter
//
// - start this file as daemon, for example with:
//
//  export PORT=8081
//  start-stop-daemon --start --quiet --background --chuid $USER --pidfile /var/run/proxy-broadcast.pid --make-pidfile --startas /xxx/proxy-broadcast.js --oknodo -- start
//
// - proxy requests from CAS server to us:
//
//  RewriteEngine On
//  RewriteCond %{REMOTE_ADDR} "=193.55.96.57"
//  RewriteRule ^(.*) http://localhost:8081/routes=ent1,ent2/$1 [P]

var http = require('http');
var https = require('https');

var env = process.env;
if (!env.NODE_ENV) {
   env.NODE_ENV = 'production';
}
var ourUserAgent = 'proxy-broadcast';
var routeCookiePrefix = 'JSESSIONID=xxx.';
var port = env.PORT || 8080;
var verbose = env.NODE_ENV !== 'production';
var DNS_TTL = 10; // seconds

// increase performance and eliminate DNS lookup conflicts (https://github.com/joyent/node/issues/7729)
require('dns-cache')(DNS_TTL * 1000);

function log(msg, o) {
    console.log("" + new Date() + ": " + msg, o);
}

function respond(response, code, msg) {
    response.statusCode = code;
    response.write(msg);
    response.end();
}
function invalid_request(response, msg) {
    respond(response, 400, msg);
}

function extract_path(path) {
    var m = path.match(/\/routes=(.*?)\/(.*)/);
    if (!m) return;
    return { path: m[2], routes: m[1].split(/,/) };
}

http.createServer(function(request, response) {
    var path_routes = extract_path(request.url);
    if (!path_routes) return invalid_request(response, 'missing routes');
    var path = path_routes.path;
    var routes = path_routes.routes;

    var headers = request.headers;
    if (verbose) log(path, JSON.stringify(headers));

    if (headers['user-agent'] === ourUserAgent) {
        return invalid_request(response, "ignore request to avoid dead loop")
    }
    var hostname = headers['x-forwarded-server']
    if (!hostname) {
        return invalid_request(response, "missing X-Forwarded-Host");
    }
    
    var body = '';
    request.on('data', function(chunk) {
        body += chunk;
    });
    
    request.on('end', function() {
        routes.forEach(function (route, index) {
            var mainRoute = index === 0;
            var req = {
                path: path,
                hostname: hostname,
                method: request.method,
                port: headers['x-forwarded-port'] || '443',
                headers: {
                    'Content-Type': headers['content-type'] || 'text/plain',
                    'User-Agent': ourUserAgent,
                    'Cookie': routeCookiePrefix + route,
                },
            };
            if (verbose) log("sending to " + route, req);

            var proxy = https.request(req);
            if (mainRoute) {
                proxy.once('response', function (resp) {
                    response.writeHead(resp.statusCode, resp.headers);
                    resp.pipe(response);
                    resp.on('error', function (e) {
                        log('backend response error' + hostname, e);
                    });
                });
            }

            request.on('aborted', function () {
                proxy.abort();
            });
            
            proxy.on('error', function (e) {
                log('backend request error ' + hostname + " " + route, e);
            });
            proxy.write(body, 'binary');
            proxy.end();
          });
    });
}).listen(port, 'localhost');
