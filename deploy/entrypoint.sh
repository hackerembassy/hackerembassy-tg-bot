#!/bin/sh
set -xe
if [ ! -f "/app/data/db/data.db" ]; then
    cp -v /app/data/sample.db /app/data/db/data.db
fi
if [ -f "/app/config/sec/production.json" ]; then
    cp -v /app/config/sec/production.json  /app/config/production.json
fi
exec "$@"
