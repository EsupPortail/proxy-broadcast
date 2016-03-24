# proxy-broadcast
Node.js server that proxies CAS requests to all load balancing backends. It works for the pgtUrl and back channel SLO. 

Usage:

- for now, this script uses JSESSIONID cookie as the stickysession parameter

- start this file as daemon, for example with:

```sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
APP=/usr/local/esup/proxy-broadcast/index.js
PORT=8081
PIDFILE=/var/run/proxy-broadcast.pid
LOGFILE=/var/log/proxy-broadcast.log
USER=esup
export PORT
start-stop-daemon --start --quiet --background --no-close --chuid $USER --pidfile "$PIDFILE" --make-pidfile --startas $APP >>$LOGFILE 2>&1
```

- proxy requests from CAS server to us:

```apache
RewriteEngine On
RewriteCond %{REMOTE_ADDR} "=193.55.96.57"
RewriteRule ^(.*) http://localhost:8081/routes=ent1,ent2/$1 [P]
```
