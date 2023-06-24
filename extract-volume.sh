#!/bin/bash
set -e 

usage_msg="Usage: $0 [-s remote_path] [-o local_path] ssh_address"
default_remote_path="hackem-bot:/app/data/db/"
default_local_path="$(readlink -f "$(dirname "$0")")/data/db/"
while getopts "s:o:p:" opt
do
    case "$opt" in
        s) remote_path=$OPTARG;;
        o) local_path=$OPTARG;;
        *) ;;
    esac
done
shift "$((OPTIND-1))"
remote_path="${remote_path:-$default_remote_path}"
remote_path="${remote_path%%/}/"
local_path="${local_path:-$default_local_path}"
local_path="${local_path%%/}/"
ssh_address=${1:?$usage_msg}
tmp="/tmp/hackem-$(tr -dc A-Za-z0-9 < /dev/urandom | head -c 32)"

ssh -T "$ssh_address" << END_OF_SCRIPT
echo '--- ssh connected'
set -e
main() {
    set -x
    local tmp="$tmp"
    mkdir "\$tmp"
    docker cp '$remote_path' "\$tmp/vol"
    tar -czf "\$tmp/vol.tgz" -C "\$tmp/vol" .
    rm -r "\$tmp/vol"
}
main
END_OF_SCRIPT
echo "--- ssh disconnected"

set -x
mkdir "$tmp"
scp "$ssh_address":"$tmp/vol.tgz" "$tmp/"
ssh -T "$ssh_address" rm -r "$tmp"
tar -xf "$tmp/vol.tgz" -C "$local_path"
rm -r "$tmp"
