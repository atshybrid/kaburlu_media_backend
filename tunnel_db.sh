#!/bin/bash
# SSH Tunnel - Connect local port 5433 → Droplet PostgreSQL
# Usage: ./tunnel_db.sh
# Then use: postgresql://kaburlu_user:KaburluDB2026SecurePass@localhost:5433/kaburlutoday

echo "Starting SSH tunnel to Droplet DB..."
echo "Local port 5433 → 142.93.213.144:5432"
echo "Press Ctrl+C to stop"
echo ""
echo "DB URL for local use:"
echo "postgresql://kaburlu_user:KaburluDB2026SecurePass@localhost:5433/kaburlutoday"
echo ""

ssh -i ~/.ssh/id_ed25519 \
    -L 5433:localhost:5432 \
    -N \
    -o ServerAliveInterval=60 \
    -o ExitOnForwardFailure=yes \
    root@142.93.213.144
