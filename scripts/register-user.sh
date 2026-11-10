#!/usr/bin/env bash
# Registers a PiVault user. Run ON THE PI SERVER ITSELF: the endpoint only answers requests
# that come straight from localhost (anything via the public domain/proxy gets a 404).
#
# 1. Replace the placeholders below (leave no real password in this file once done).
# 2. bash scripts/register-user.sh
#
# Password: 8-16 chars with an uppercase letter, a lowercase letter, a digit and a special character.
# Mobile: country code and national number are separate; the number must be valid for that country.
set -euo pipefail

PORT="${APP_PORT:-5000}"

curl --fail-with-body -sS -X POST "http://127.0.0.1:${PORT}/api/internal/register" \
  -H 'Content-Type: application/json' \
  -d '{
    "firstName": "FIRST_NAME",
    "lastName": "LAST_NAME",
    "email": "name@example.com",
    "countryCode": "+91",
    "mobile": "9876543210",
    "password": "CHANGE_ME_Passw0rd!"
  }'
echo
