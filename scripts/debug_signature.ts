import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get the config
  const config = await prisma.razorpayConfig.findFirst({
    where: { active: true },
  });
  
  if (!config) {
    console.log('No Razorpay config found!');
    return;
  }
  
  // Get the most recent payment
  const payment = await prisma.reporterPayment.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  
  if (!payment) {
    console.log('No payment record found!');
    return;
  }
  
  console.log('=== DEBUG SIGNATURE VERIFICATION ===');
  console.log('Order ID:', payment.razorpayOrderId);
  console.log('Payment ID:', payment.razorpayPaymentId);
  console.log('Key Secret Length:', config.keySecret?.length);
  console.log('Key Secret starts with:', config.keySecret?.substring(0, 10));
  console.log('Key Secret ends with:', config.keySecret?.substring(-5));
  console.log('Key Secret hex:', Buffer.from(config.keySecret || '').toString('hex'));
  
  if (payment.razorpayPaymentId) {
    const body = payment.razorpayOrderId + '|' + payment.razorpayPaymentId;
    console.log('Body string:', body);
    
    const sig = crypto
      .createHmac('sha256', config.keySecret!)
      .update(body)
      .digest('hex');
    console.log('Generated signature:', sig);
    console.log('Signature length:', sig.length);
  } else {
    console.log('No payment ID yet - payment not completed');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
