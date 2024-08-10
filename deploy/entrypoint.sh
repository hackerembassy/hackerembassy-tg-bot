#!/bin/sh
set -xe
if [ -f "/app/config/sec/production.json" ]; then
    cp -v /app/config/sec/production.json  /app/config/production.json
fi
exec "$@"
