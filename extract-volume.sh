#!/bin/bash
set -e 

usage_msg="Usage: $0 ssh_address [container_uri] [target_path]"

script_dir="$(readlink -f "$(dirname "$0")")"

default_container_uri="hackem-bot:/app/data/db/"
default_target_path="$script_dir/data/db/"

ssh_address=${1?$usage_msg}
container_uri="${2:-$default_container_uri}"
target_path="${3:-$default_target_path}"

container_uri="${container_uri%%/}/"
target_path="${target_path%%/}/"
tmp="/tmp/$(uuidgen)"

echo "Connecting to '$ssh_address' via ssh..."
ssh -T "$ssh_address" << END_OF_SCRIPT
echo 'Running on the remote host...'
set -e
main() {
    set -xe
    local container_uri=\$1
    local tmp=\$2
    mkdir "\$tmp"
    docker cp \$container_uri \$tmp/vol
    tar -czf \$tmp/vol.tgz -C \$tmp/vol .
    rm -r \$tmp/vol
}
main $container_uri $tmp
END_OF_SCRIPT
echo "Fetching the compressed volume..."

set -x
mkdir "$tmp"
scp "$ssh_address":"$tmp/vol.tgz" "$tmp/"
ssh -T "$ssh_address" rm -r "$tmp"
tar -xf "$tmp/vol.tgz" -C "$target_path"
rm -r "$tmp"
