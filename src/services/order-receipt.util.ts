import { PrismaService } from '../prisma/prisma.service';

export interface OrderReceiptRecipient {
  email: string;
  userId?: string;
  userName: string;
}

/** Resolve where to send SMM web / order receipt emails. */
export async function resolveOrderReceiptEmail(
  prisma: PrismaService,
  orderId: string,
): Promise<OrderReceiptRecipient | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      user: { select: { id: true, email: true, username: true } },
      payment: {
        select: {
          customerEmail: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { customerEmail: true },
          },
        },
      },
    },
  });

  if (!order) return null;

  const email =
    order.user?.email ||
    order.payment?.customerEmail ||
    order.payment?.transactions[0]?.customerEmail ||
    null;

  if (!email) return null;

  return {
    email,
    userId: order.user?.id,
    userName: order.user?.username || email.split('@')[0],
  };
}
