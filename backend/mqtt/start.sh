#!/bin/sh
set -eu
: "${MQTT_USERNAME:?MQTT_USERNAME must be set}"
: "${MQTT_PASSWORD:?MQTT_PASSWORD must be set}"
umask 077
mosquitto_passwd -b -c /tmp/mqtt-passwords "$MQTT_USERNAME" "$MQTT_PASSWORD"
chown mosquitto:mosquitto /tmp/mqtt-passwords
chmod 600 /tmp/mqtt-passwords
exec mosquitto -c /mosquitto/config/mosquitto.conf
