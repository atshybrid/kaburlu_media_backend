-- CreateEnum
CREATE TYPE "public"."DomainKind" AS ENUM ('NEWS', 'EPAPER');

-- CreateEnum
CREATE TYPE "public"."BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "public"."BillingCurrency" AS ENUM ('INR', 'USD');

-- CreateEnum
CREATE TYPE "public"."BillingComponent" AS ENUM ('NEWS_DOMAIN', 'EPAPER_SUBDOMAIN', 'NEWSPAPER_DESIGN_PAGE');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "public"."BillingInvoiceKind" AS ENUM ('SUBSCRIPTION', 'TOPUP');

-- AlterTable
ALTER TABLE "public"."Domain" ADD COLUMN     "kind" "public"."DomainKind" NOT NULL DEFAULT 'NEWS';

-- CreateTable
CREATE TABLE "public"."BillingPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "public"."BillingCurrency" NOT NULL DEFAULT 'INR',
    "cycle" "public"."BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "baseAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillingPlanComponent" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "component" "public"."BillingComponent" NOT NULL,
    "includedUnits" INTEGER NOT NULL DEFAULT 0,
    "unitAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlanComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TenantSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillingUsageEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "component" "public"."BillingComponent" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillingCreditBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "component" "public"."BillingComponent" NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingCreditBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillingInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "kind" "public"."BillingInvoiceKind" NOT NULL DEFAULT 'SUBSCRIPTION',
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" "public"."BillingCurrency" NOT NULL DEFAULT 'INR',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "meta" JSONB,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillingInvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "component" "public"."BillingComponent",
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "amountMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingInvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingPlan_isActive_createdAt_idx" ON "public"."BillingPlan"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "BillingPlanComponent_component_idx" ON "public"."BillingPlanComponent"("component");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPlanComponent_planId_component_key" ON "public"."BillingPlanComponent"("planId", "component");

-- CreateIndex
CREATE INDEX "TenantSubscription_tenantId_status_idx" ON "public"."TenantSubscription"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TenantSubscription_planId_idx" ON "public"."TenantSubscription"("planId");

-- CreateIndex
CREATE INDEX "BillingUsageEvent_tenantId_occurredAt_idx" ON "public"."BillingUsageEvent"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "BillingUsageEvent_subscriptionId_occurredAt_idx" ON "public"."BillingUsageEvent"("subscriptionId", "occurredAt");

-- CreateIndex
CREATE INDEX "BillingUsageEvent_component_occurredAt_idx" ON "public"."BillingUsageEvent"("component", "occurredAt");

-- CreateIndex
CREATE INDEX "BillingCreditBalance_tenantId_idx" ON "public"."BillingCreditBalance"("tenantId");

-- CreateIndex
CREATE INDEX "BillingCreditBalance_component_idx" ON "public"."BillingCreditBalance"("component");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCreditBalance_tenantId_component_key" ON "public"."BillingCreditBalance"("tenantId", "component");

-- CreateIndex
CREATE INDEX "BillingInvoice_tenantId_periodStart_periodEnd_idx" ON "public"."BillingInvoice"("tenantId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "BillingInvoice_status_createdAt_idx" ON "public"."BillingInvoice"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoice_razorpayOrderId_key" ON "public"."BillingInvoice"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "BillingInvoiceLineItem_invoiceId_idx" ON "public"."BillingInvoiceLineItem"("invoiceId");

-- AddForeignKey
ALTER TABLE "public"."BillingPlanComponent" ADD CONSTRAINT "BillingPlanComponent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."BillingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingUsageEvent" ADD CONSTRAINT "BillingUsageEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingUsageEvent" ADD CONSTRAINT "BillingUsageEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."TenantSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingCreditBalance" ADD CONSTRAINT "BillingCreditBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingInvoice" ADD CONSTRAINT "BillingInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingInvoice" ADD CONSTRAINT "BillingInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."TenantSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingInvoiceLineItem" ADD CONSTRAINT "BillingInvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."BillingInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
