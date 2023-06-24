#!/bin/bash
set -e
default_remote_path="hackem-bot:/app/data/db/"
default_local_path="$(readlink -f "$(dirname "$0")")/data/db/"
usage_msg="Usage:
    $0 [-s remote_path] [-o local_path] {-h | -d | -u} ssh_address"
help_msg="
Parameters:
    ssh_address     like in ssh (specify port in ~/.ssh/config if required)
    -d              download remote_path to local_path
    -u              upload local_path to remote_path
    -s remote_path  container:path (optional, default: $default_remote_path)
    -o local_path   path on your host (optional, default: $default_local_path)
    -h              you are reading this fine man"
while getopts "s:o:p:duh" opt
do
    case "$opt" in
        s) remote_path=$OPTARG ;;
        o) local_path=$OPTARG ;;
        d) action=download ;;
        u) action=upload ;;
        h) echo "$usage_msg$help_msg" 1>&2 ; exit 1 ;;
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

volume_download() {
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
}

volume_upload() {
    set -x
    mkdir "$tmp"
    tar -czf "$tmp/vol.tgz" -C "$local_path" .
    ssh -T "$ssh_address" mkdir -p "$tmp/vol"
    scp "$tmp/vol.tgz" "$ssh_address":"$tmp/"
    set +x
    ssh -T "$ssh_address" << END_OF_SCRIPT
echo '--- ssh connected'
set -e
main() {
    set -x
    local tmp="$tmp"
    tar -xf "$tmp/vol.tgz" -C "\$tmp/vol"
    docker cp  "\$tmp/vol/."  '$remote_path'
    rm -r "\$tmp"
}
main
END_OF_SCRIPT
    echo "--- ssh disconnected"
    rm -r "$tmp"
}

case $action in
    "download") volume_download ;;
    "upload") volume_upload ;;
    *) echo "$usage_msg$help_msg" 1>&2 ; exit 1 ;;
esac
