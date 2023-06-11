echo "Initializing..."

mkdir -p ./data/db/
cp ./data/sample.db ./data/db/data.db
echo HACKERBOTTOKEN=\"replace_with_bot_father_token\" > .env
echo UNLOCKKEY=\"DevTestToken\" >> .env
echo LUCITOKEN=\"replace_with_luci_token\" >> .env
echo MQTTUSER=\"replace_with_mqtt_user\" >> .env
echo MQTTPASSWORD=\"replace_with_mqtt_password\" >> .env
echo WIFIUSER=\"replace_with_wifi_user\" >> .env
echo WIFIPASSWORD=\"replace_with_wifi_password\" >> .env
echo HASSTOKEN=\"replace_with_hass_token\" >> .env
mkdir -p ./config/sec
ssh-keygen -b 1024 -t rsa -f ./config/sec/priv.key -q -N "" -m pem
mv ./config/sec/priv.key.pub ./config/sec/pub.key

echo "Done!"
echo "Don't forget to replace values in .env"