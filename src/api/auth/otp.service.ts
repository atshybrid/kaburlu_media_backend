import { RequestOtpDto, VerifyOtpDto, SetMpinDto } from './otp.dto';
import * as bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { sendToUser } from '../../lib/fcm';
import { config } from '../../config/env';
import { sendWhatsappOtpTemplate } from '../../lib/whatsapp';
import { getRazorpayClientForTenant } from '../reporterPayments/razorpay.service';

export class OtpService {
    async requestOtp(data: RequestOtpDto) {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Save OTP log to DB
        const otpLog = await prisma.otpLog.create({
            data: {
                mobileNumber: data.mobileNumber,
                otp,
                expiresAt,
            },
        });

        // Check if the mobile number is already registered
        const user = await prisma.user.findUnique({ where: { mobileNumber: data.mobileNumber } });
        const isRegistered = !!user;

        // Derive purpose label for template (best-effort).
        const purpose = isRegistered && user?.mpin ? 'reset mpin' : 'login';

        // Optional: deliver OTP via push notification to existing user's devices
        let notification: { successCount: number; failureCount: number } | undefined;
        if (user) {
            try {
                const resp = await sendToUser(user.id, {
                    title: 'Your verification code',
                    body: `OTP: ${otp}`,
                    data: { type: 'OTP', mobileNumber: data.mobileNumber },
                });
                notification = { successCount: resp.successCount, failureCount: resp.failureCount } as any;
            } catch (e) {
                // log and continue; OTP can still be verified via server-side
                console.warn('FCM push failed for OTP:', (e as Error).message);
            }
        }

        // Optional: deliver OTP via WhatsApp Cloud API template
        let whatsapp: any | undefined;
        if (config.whatsapp.enabled) {
            const supportMobile = config.whatsapp.supportMobile || data.mobileNumber;
            const ttlText = config.whatsapp.ttlText || '10 minutes';
            const resp = await sendWhatsappOtpTemplate({
                toMobileNumber: data.mobileNumber,
                otp,
                purpose,
                ttlText,
                supportMobile,
                templateName: config.whatsapp.otpTemplateName,
                templateLang: config.whatsapp.otpTemplateLang,
                defaultCountryCode: config.whatsapp.defaultCountryCode,
                phoneNumberId: config.whatsapp.phoneNumberId,
                accessToken: config.whatsapp.accessToken,
            });
            whatsapp = resp.ok
                ? { ok: true, messageId: resp.messageId }
                : { ok: false, error: resp.error, details: resp.details };
        }

        // In a real application, you would also send the OTP via SMS.
        console.log(`OTP for ${data.mobileNumber} is ${otp}`);
        return { success: true, id: otpLog.id, isRegistered, notification, whatsapp };
    }

    async verifyOtp(data: VerifyOtpDto) {
        // Find OTP by id and otp, ensure not expired
        const record = await prisma.otpLog.findFirst({
            where: { id: data.id, otp: data.otp },
        });
        if (!record) {
            throw new Error('Invalid OTP');
        }
        if (new Date(record.expiresAt).getTime() < Date.now()) {
            // Cleanup expired record
            await prisma.otpLog.delete({ where: { id: record.id } }).catch(() => {});
            throw new Error('OTP expired');
        }

        // Consume OTP (delete after successful verification)
        await prisma.otpLog.delete({ where: { id: record.id } }).catch(() => {});
        return { success: true };
    }

    async setMpin(data: SetMpinDto) {
        // Hash the MPIN from the request
        const saltRounds = 10;
        const hashedMpin = await bcrypt.hash(data.mpin, saltRounds);
        const user = await prisma.user.findUnique({
            where: { mobileNumber: data.mobileNumber },
        });
        if (!user) {
            throw new Error('User not found');
        }
        await prisma.user.update({
            where: { id: user.id },
            data: { mpin: hashedMpin },
        });
        return { success: true };
    }

    async getMpinStatus(mobileNumber: string) {
        const user = await prisma.user.findUnique({
            where: { mobileNumber },
            include: { 
                role: true,
                reporterProfile: {
                    include: {
                        payments: {
                            orderBy: { createdAt: 'desc' }
                        },
                        tenant: {
                            select: { id: true, name: true, slug: true }
                        }
                    }
                }
            },
        });

        if (!user) {
            return { mpinStatus: false, isRegistered: false, roleId: null, roleName: null };
        }

        const roleId = user.roleId || null;
        const roleName = user.role?.name || null;
        const reporter = user.reporterProfile;

        // Check for pending payment (reporter with outstanding payments - same logic as login)
        if (reporter && roleName !== 'SUPER_ADMIN') {
            const now = new Date();
            const currentYear = now.getUTCFullYear();
            const currentMonth = now.getUTCMonth() + 1;
            const outstanding: any[] = [];

            // Onboarding fee requirement
            if (typeof reporter.idCardCharge === 'number' && reporter.idCardCharge > 0) {
                const onboardingPaid = reporter.payments.find((p: any) => p.type === 'ONBOARDING' && p.status === 'PAID');
                if (!onboardingPaid) {
                    const existingOnboarding = reporter.payments.find((p: any) => p.type === 'ONBOARDING');
                    outstanding.push({
                        type: 'ONBOARDING',
                        amount: reporter.idCardCharge,
                        currency: 'INR',
                        status: existingOnboarding ? existingOnboarding.status : 'MISSING',
                        paymentId: existingOnboarding?.id || null,
                        razorpayOrderId: (existingOnboarding as any)?.razorpayOrderId || null
                    });
                }
            }

            // Monthly subscription requirement
            if (reporter.subscriptionActive && typeof reporter.monthlySubscriptionAmount === 'number' && reporter.monthlySubscriptionAmount > 0) {
                const monthlyPaid = reporter.payments.find((p: any) => 
                    p.type === 'MONTHLY_SUBSCRIPTION' && p.year === currentYear && p.month === currentMonth && p.status === 'PAID'
                );
                if (!monthlyPaid) {
                    const existingMonthly = reporter.payments.find((p: any) => 
                        p.type === 'MONTHLY_SUBSCRIPTION' && p.year === currentYear && p.month === currentMonth
                    );
                    outstanding.push({
                        type: 'MONTHLY_SUBSCRIPTION',
                        amount: reporter.monthlySubscriptionAmount,
                        currency: 'INR',
                        year: currentYear,
                        month: currentMonth,
                        status: existingMonthly ? existingMonthly.status : 'MISSING',
                        paymentId: existingMonthly?.id || null,
                        razorpayOrderId: (existingMonthly as any)?.razorpayOrderId || null
                    });
                }
            }

            if (outstanding.length > 0) {
                // Fetch tenant branding (theme + entity) for payment screen - same as login
                const [tenantTheme, tenantEntity] = await Promise.all([
                    (prisma as any).tenantTheme?.findUnique?.({
                        where: { tenantId: reporter.tenantId },
                        select: { logoUrl: true, faviconUrl: true, primaryColor: true }
                    }).catch(() => null),
                    (prisma as any).tenantEntity?.findUnique?.({
                        where: { tenantId: reporter.tenantId },
                        select: { nativeName: true, registrationTitle: true, publisherName: true }
                    }).catch(() => null),
                ]);

                // Calculate breakdown - same format as login 402 response
                const idCardAmountRupees = outstanding.find(o => o.type === 'ONBOARDING')?.amount || 0;
                const subscriptionAmountRupees = outstanding.find(o => o.type === 'MONTHLY_SUBSCRIPTION')?.amount || 0;
                const totalAmountRupees = outstanding.reduce((sum: number, o: any) => sum + (o.amount || 0), 0);
                const totalAmountPaise = totalAmountRupees * 100;

                // Create Razorpay order if not already created (same logic as auth.service.ts)
                let razorpayKeyId: string | null = null;
                let razorpayOrder: any = null;
                let reporterPaymentId: string | null = null;

                try {
                    // Get Razorpay config
                    const razorpayConfig = await (prisma as any).razorpayConfig.findFirst({
                        where: {
                            OR: [{ tenantId: reporter.tenantId }, { tenantId: null }],
                            active: true,
                        },
                        orderBy: { tenantId: 'desc' },
                        select: { keyId: true },
                    });

                    razorpayKeyId = razorpayConfig?.keyId || null;

                    if (razorpayKeyId) {
                        // Check if there's already a pending payment with a valid order
                        const existingPendingPayment = await (prisma as any).reporterPayment.findFirst({
                            where: {
                                reporterId: reporter.id,
                                tenantId: reporter.tenantId,
                                status: 'PENDING',
                                expiresAt: { gt: new Date() }
                            },
                            orderBy: { createdAt: 'desc' }
                        });

                        if (existingPendingPayment?.razorpayOrderId) {
                            // Reuse existing pending order
                            razorpayOrder = { id: existingPendingPayment.razorpayOrderId };
                            reporterPaymentId = existingPendingPayment.id;
                            console.log('[MpinStatus] Reusing existing Razorpay order:', razorpayOrder.id);
                        } else {
                            // Create new Razorpay order
                            const razorpay = await getRazorpayClientForTenant(reporter.tenantId);
                            const now = new Date();
                            const year = now.getUTCFullYear();
                            const month = now.getUTCMonth() + 1;

                            const shortReporterId = reporter.id.slice(0, 12);
                            let receipt = `REP-${shortReporterId}-${Date.now()}`;
                            if (receipt.length > 40) receipt = receipt.slice(0, 40);

                            // Determine payment type
                            const hasOnboarding = outstanding.some((o: any) => o.type === 'ONBOARDING');
                            const paymentType = hasOnboarding ? 'ONBOARDING' : 'MONTHLY_SUBSCRIPTION';

                            razorpayOrder = await (razorpay as any).orders.create({
                                amount: totalAmountPaise, // Razorpay expects amount in PAISE
                                currency: 'INR',
                                receipt,
                                notes: { tenantId: reporter.tenantId, reporterId: reporter.id, type: paymentType },
                            });

                            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

                            const paymentRecord = await (prisma as any).reporterPayment.create({
                                data: {
                                    reporterId: reporter.id,
                                    tenantId: reporter.tenantId,
                                    type: paymentType,
                                    year,
                                    month,
                                    amount: totalAmountRupees, // Store in rupees
                                    currency: 'INR',
                                    status: 'PENDING',
                                    razorpayOrderId: razorpayOrder.id,
                                    meta: razorpayOrder,
                                    expiresAt,
                                },
                            });

                            reporterPaymentId = paymentRecord.id;
                            console.log('[MpinStatus] Created Razorpay order:', razorpayOrder.id, 'for reporter:', reporter.id);

                            // Update outstanding array with the newly created order
                            outstanding.forEach((item: any) => {
                                if ((item.type === paymentType) || 
                                    (paymentType === 'ONBOARDING' && (item.type === 'ONBOARDING' || item.type === 'MONTHLY_SUBSCRIPTION'))) {
                                    item.razorpayOrderId = razorpayOrder.id;
                                    item.paymentId = paymentRecord.id;
                                    item.status = 'PENDING';
                                }
                            });
                        }
                    }
                } catch (rpErr) {
                    console.error('[MpinStatus] Failed to create Razorpay order:', rpErr);
                    // Continue without Razorpay order - frontend can call /payments/order manually
                }

                return {
                    paymentRequired: true,
                    code: 'PAYMENT_REQUIRED',
                    message: 'Reporter payments required before login',
                    roleId,
                    roleName,
                    reporter: { id: reporter.id, tenantId: reporter.tenantId },
                    tenant: {
                        id: reporter.tenant?.id || reporter.tenantId,
                        name: reporter.tenant?.name || null,
                        slug: reporter.tenant?.slug || null,
                        nativeName: tenantEntity?.nativeName || null,
                        registrationTitle: tenantEntity?.registrationTitle || null,
                        publisherName: tenantEntity?.publisherName || null,
                        logoUrl: tenantTheme?.logoUrl || null,
                        faviconUrl: tenantTheme?.faviconUrl || null,
                        primaryColor: tenantTheme?.primaryColor || null
                    },
                    outstanding,
                    breakdown: {
                        idCardCharge: {
                            label: 'ID Card / Onboarding Fee',
                            amount: idCardAmountRupees,
                            amountPaise: idCardAmountRupees * 100,
                            displayAmount: `₹${idCardAmountRupees.toFixed(2)}`
                        },
                        monthlySubscription: {
                            label: 'Monthly Subscription',
                            amount: subscriptionAmountRupees,
                            amountPaise: subscriptionAmountRupees * 100,
                            displayAmount: `₹${subscriptionAmountRupees.toFixed(2)}`,
                            year: outstanding.find((o: any) => o.type === 'MONTHLY_SUBSCRIPTION')?.year,
                            month: outstanding.find((o: any) => o.type === 'MONTHLY_SUBSCRIPTION')?.month
                        },
                        total: {
                            label: 'Total Amount',
                            amount: totalAmountRupees,
                            amountPaise: totalAmountPaise,
                            displayAmount: `₹${totalAmountRupees.toFixed(2)}`
                        }
                    },
                    // Include Razorpay details for mobile app
                    razorpay: {
                        keyId: razorpayKeyId,
                        orderId: razorpayOrder?.id || null,
                        amount: totalAmountPaise,
                        amountRupees: totalAmountRupees,
                        currency: 'INR',
                        reporterPaymentId: reporterPaymentId || null,
                        orderCreated: !!razorpayOrder
                    }
                };
            }
        }

        if (user.mpin) {
            return { mpinStatus: true, roleId, roleName };
        }
        return { mpinStatus: false, isRegistered: true, roleId, roleName };
    }
}
