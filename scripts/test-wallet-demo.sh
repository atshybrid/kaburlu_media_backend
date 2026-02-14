#!/bin/bash
# Test Script: Wallet System with Small Amounts & Activation Dates
# This script demonstrates the complete flow with sample data

BASE_URL="http://localhost:3000/api/v1"
TENANT_ID="tenant_chr_001"
SUPER_ADMIN_TOKEN="your_super_admin_jwt_token"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏦 Wallet System Demo - Small Amounts + Activation Dates"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ==============================================================================
# STEP 1: Set Pricing (Effective from 1st February 2025)
# ==============================================================================
echo "📋 Step 1: Creating Pricing Configuration"
echo "   - Service: ePaper"
echo "   - Min Pages: 8"
echo "   - Price: ₹2,000/page"
echo "   - Activation Date: 2025-02-01"
echo ""

curl -X POST "${BASE_URL}/admin/tenants/${TENANT_ID}/pricing" \
  -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "EPAPER",
    "minEpaperPages": 8,
    "pricePerPageMinor": 200000,
    "discount6MonthPercent": 5.0,
    "discount12MonthPercent": 15.0,
    "effectiveFrom": "2025-02-01T00:00:00Z"
  }'

echo ""
echo "✅ Pricing activated from: 2025-02-01"
echo ""
sleep 2

# ==============================================================================
# STEP 2: Multiple Small Top-ups (Any Amount)
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💰 Step 2: Adding Multiple Small Amounts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Top-up 1: ₹5,000
echo "📥 Top-up #1: ₹5,000"
curl -X POST "${BASE_URL}/admin/tenants/${TENANT_ID}/wallet/topup" \
  -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "amountMinor": 500000,
    "description": "First payment - ₹5,000"
  }'

echo ""
echo "   Balance after: ₹5,000"
echo ""
sleep 1

# Top-up 2: ₹3,500
echo "📥 Top-up #2: ₹3,500"
curl -X POST "${BASE_URL}/admin/tenants/${TENANT_ID}/wallet/topup" \
  -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "amountMinor": 350000,
    "description": "Second payment - ₹3,500"
  }'

echo ""
echo "   Balance after: ₹8,500"
echo ""
sleep 1

# Top-up 3: ₹7,500
echo "📥 Top-up #3: ₹7,500"
curl -X POST "${BASE_URL}/admin/tenants/${TENANT_ID}/wallet/topup" \
  -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "amountMinor": 750000,
    "description": "Third payment - ₹7,500"
  }'

echo ""
echo "   Balance after: ₹16,000"
echo ""
sleep 1

# Top-up 4: ₹32,000
echo "📥 Top-up #4: ₹32,000"
curl -X POST "${BASE_URL}/admin/tenants/${TENANT_ID}/wallet/topup" \
  -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "amountMinor": 3200000,
    "description": "Final payment - ₹32,000"
  }'

echo ""
echo "   Balance after: ₹48,000 (3 months advance ✅)"
echo ""
sleep 2

# ==============================================================================
# STEP 3: Check Current Balance
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Step 3: Balance Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

curl -X GET "${BASE_URL}/admin/tenants/${TENANT_ID}/wallet" \
  -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}"

echo ""
echo ""
sleep 2

# ==============================================================================
# STEP 4: View Transaction History
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📜 Step 4: Transaction History"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

curl -X GET "${BASE_URL}/tenant/wallet/transactions?page=1&pageSize=10" \
  -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}"

echo ""
echo ""
sleep 2

# ==============================================================================
# STEP 5: Set Future Pricing (Discount from April 2025)
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔮 Step 5: Future Pricing Setup (Discount)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   Setting discounted rate from April 1st, 2025"
echo "   New Rate: ₹1,800/page (10% discount)"
echo ""

curl -X POST "${BASE_URL}/admin/tenants/${TENANT_ID}/pricing" \
  -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "EPAPER",
    "minEpaperPages": 8,
    "pricePerPageMinor": 180000,
    "discount6MonthPercent": 5.0,
    "discount12MonthPercent": 15.0,
    "effectiveFrom": "2025-04-01T00:00:00Z"
  }'

echo ""
echo "✅ New pricing will activate on: 2025-04-01"
echo ""
sleep 2

# ==============================================================================
# STEP 6: View All Pricing (Current + Future)
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 6: View Pricing Timeline"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

curl -X GET "${BASE_URL}/admin/tenants/${TENANT_ID}/pricing" \
  -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}"

echo ""
echo ""

# ==============================================================================
# Summary
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Demo Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Summary:"
echo "  ✅ Added 4 different amounts (₹5k, ₹3.5k, ₹7.5k, ₹32k)"
echo "  ✅ Total Balance: ₹48,000"
echo "  ✅ Current Pricing: ₹2,000/page (Feb-Mar 2025)"
echo "  ✅ Future Pricing: ₹1,800/page (Apr 2025 onwards)"
echo "  ✅ All transactions tracked with timestamps"
echo "  ✅ Activation dates set correctly"
echo ""
echo "Next Steps:"
echo "  1. Upload ePaper PDFs → Auto page tracking"
echo "  2. Wait for month-end → Auto billing"
echo "  3. April 1st → New pricing activates automatically"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
