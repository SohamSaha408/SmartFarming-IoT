#!/bin/sh
# Create password file with user 'iot_device' and password 'iot_secure_2024'
mosquitto_passwd -c -b /mosquitto/config/passwd iot_device iot_secure_2024
