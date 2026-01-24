#!/bin/bash
curl -s -X GET "http://localhost:3000/api/v1/public/config" \
  -H "X-Tenant-Domain: telangana.kaburlu.com" \
  -H "Content-Type: application/json" | jq '.'
