#!/bin/bash
set -e
default_container_name="hackem-bot"
default_container_path="/app/data/db/"
default_local_path="$(readlink -f "$(dirname "$0")")/data/db/"

usage_msg="Usage:
    $0 [-c container_name] [-p container_path] [-o local_path] {-h | -d | -u} ssh_address"
help_msg="
Parameters:
    ssh_address        like in ssh (specify port in ~/.ssh/config if required)
    -d                 download container_path to local_path
    -u                 upload local_path to container_path
    -c container_name  (optional) default: $default_container_name
    -p container_path  (optional) default: $default_container_path
    -o local_path      (optional) default: $default_local_path
    -h                 you are reading this fine man"
while getopts "duc:p:o:h" opt
do
    case "$opt" in
        d) action=download ;;
        u) action=upload ;;
        c) container_name=$OPTARG ;;
        p) container_path=$OPTARG ;;
        o) local_path=$OPTARG ;;
        h) echo "$usage_msg$help_msg" 1>&2 ; exit 1 ;;
        *) ;;
    esac
done
shift "$((OPTIND-1))"
container_name="${container_name:-$default_container_name}"
container_path="${container_path:-$default_container_path}"
container_path="${container_path%%/}/"
local_path="${local_path:-$default_local_path}"
local_path="${local_path%%/}/"
ssh_address=${1:?$usage_msg}
tmp="/tmp/hackem-$(cat /dev/urandom | LC_ALL=C tr -dc A-Za-z0-9 | head -c 32)"

volume_download() {
    ssh -T "$ssh_address" << END_OF_SCRIPT
echo '--- ssh connected'
set -e
main() {
    set -x
    local tmp="$tmp"
    mkdir "\$tmp"
    docker cp '$container_name:$container_path' "\$tmp/vol"
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
    docker cp  "\$tmp/vol/."  '$container_name:$container_path'
    rm -r "\$tmp"
    docker restart $container_name
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
