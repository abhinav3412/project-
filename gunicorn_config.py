import multiprocessing
import os
from app import create_app

# Gunicorn config
port = int(os.environ.get("PORT", 10000))
bind = f"0.0.0.0:{port}"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "gevent"
timeout = 120
keepalive = 5
errorlog = "-"
loglevel = "info"
accesslog = "-"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=port) 