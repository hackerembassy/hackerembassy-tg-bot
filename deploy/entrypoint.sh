#!/bin/sh
set -xe
cd /app
if [ -z "$(ls -A ./data)" ]; then
    mv ./sample-data/* ./data/
    mv ./data/sample.db ./data/data.db
fi
exec "$@"