import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // First find the payment to get its ID
  const payment = await prisma.reporterPayment.findFirst({
    where: { razorpayOrderId: 'order_S937H93DNb0GoN' },
  });
  
  if (!payment) { 
    console.log('Payment not found'); 
    return; 
  }
  
  console.log('Found payment:', payment.id, 'Status:', payment.status);
  
  // Fix the payment record using ID
  await prisma.reporterPayment.update({
    where: { id: payment.id },
    data: { status: 'PAID' },
  });
  console.log('Payment updated to PAID');
  
  // Also update the reporter
  const subscriptionExpiry = new Date();
  subscriptionExpiry.setFullYear(subscriptionExpiry.getFullYear() + 1);
  
  await prisma.reporter.update({
    where: { id: payment.reporterId },
    data: { 
      paymentStatus: 'PAID',
      subscriptionExpiry,
    },
  });
  
  console.log('Reporter updated to PAID with 1 year subscription');
  console.log('Done! The reporter can now login.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
