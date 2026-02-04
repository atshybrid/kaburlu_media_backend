#!/bin/bash

# Test creating ASSEMBLY level reporter with proper assemblyConstituencyId

curl -X 'POST' \
  'https://api.kaburlumedia.com/api/v1/tenants/cmkh94g0s01eykb21toi1oucu/reporters' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWw1M3h1ZzMwMDAzankxZjBtbmE5cTlmIiwicm9sZSI6IlRFTkFOVF9BRE1JTiIsInBlcm1pc3Npb25zIjp7ImRvbWFpbnMiOlsibWFuYWdlIl0sInRlbmFudHMiOlsibWFuYWdlIl0sImFydGljbGVzIjpbImFwcHJvdmUiXSwicmVwb3J0ZXJzIjpbIm1hbmFnZSJdLCJzaG9ydE5ld3MiOlsiYXBwcm92ZSJdLCJ3ZWJBcnRpY2xlcyI6WyJhcHByb3ZlIl19LCJzZXNzaW9uSWQiOiJjbWw3c2Myb2IwMWdlYnp3MTV1ZnE2ZHZjIiwiaWF0IjoxNzcwMTk0ODk0LCJleHAiOjE3NzAyODEyOTR9.ZG7Vr9g_batQj6nfcNBe_pWLjYAF5gnuTkMTcNwzV4o' \
  -H 'Content-Type: application/json' \
  -d '{
  "fullName": "Eega Nagabhushan",
  "mobileNumber": "9505409134",
  "designationId": "cmkwcj8j50005jytf89cizzuu",
  "level": "ASSEMBLY",
  "subscriptionActive": false,
  "manualLoginEnabled": true,
  "manualLoginDays": 365,
  "autoPublish": true,
  "assemblyConstituencyId": "cmkku6ryk003zugvk79ytfmhm"
}' | jq
