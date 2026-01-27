const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const r = await p.reporter.findFirst({ 
    where: { id: 'cmkwv7yee01ferd23nica0f47' },
    include: { payments: true }
  });
  if (r) {
    console.log(JSON.stringify({
      id: r.id,
      idCardCharge: r.idCardCharge,
      monthlySubscriptionAmount: r.monthlySubscriptionAmount,
      subscriptionActive: r.subscriptionActive,
      payments: r.payments.map(p => ({ type: p.type, status: p.status, amount: p.amount, razorpayOrderId: p.razorpayOrderId }))
    }, null, 2));
  } else {
    console.log('Reporter not found');
  }
  await p.$disconnect();
})();
