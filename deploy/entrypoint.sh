#!/bin/sh
set -xe
if [ ! -f "/app/data/db/data.db)" ]; then
    mkdir -p /app/data/db/
    cp /app/data/sample.db /app/data/db/data.db
fi
exec "$@"