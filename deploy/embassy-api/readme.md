Systemd services files:
/etc/systemd/system/embassy-api.service
/etc/systemd/system/autossh-tunnel.service

Systemd services control commands:
systemctl daemon-reload
systemctl status service_name.service
systemctl stop service_name.service
systemctl start service_name.service
systemctl restart service_name.service

Required tunnels:
ssh -N -R 8222:127.0.0.1:22 root@nickkiselev.me -o "ServerAliveInterval=30" -o "ServerAliveCountMax=3" -o ExitOnForwardFailure=yes
ssh -f -NR 8001:127.0.0.1:8001 root@nickkiselev.me -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes