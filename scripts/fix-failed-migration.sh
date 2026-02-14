#!/bin/bash
# Script to resolve failed Prisma migration on production

echo "🔧 Resolving failed migration: 20260212120000_tenant_subscription_wallet"
echo ""

# Step 1: Mark the failed migration as rolled back
echo "📌 Step 1: Marking failed migration as rolled back..."
npx prisma migrate resolve --rolled-back 20260212120000_tenant_subscription_wallet

echo ""
echo "📌 Step 2: Applying migrations (including the fix)..."
npx prisma migrate deploy

echo ""
echo "✅ Migration resolution complete!"
