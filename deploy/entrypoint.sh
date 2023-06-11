#!/bin/sh
set -xe
if [ ! -f "/app/data/db/data.db" ]; then
    cp /app/data/sample.db /app/data/db/data.db
fi
if [ -f "/app/config/sec/production.json" ]; then
    mv /app/config/sec/production.json  /app/config/production.json
fi
exec "$@"
