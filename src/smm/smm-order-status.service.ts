import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../services/notification.service';
import { SmmProviderRegistryService } from './smm-provider.registry';

@Injectable()
export class SmmOrderStatusService {
  private readonly logger = new Logger(SmmOrderStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smmRegistry: SmmProviderRegistryService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron('*/15 * * * *')
  async checkAllOrderStatuses(): Promise<void> {
    try {
      this.logger.log('Running scheduled SMM order status check…');

      const processingOrders = await this.prisma.order.findMany({
        where: {
          status: 'PROCESSING',
          providerOrderId: { not: null },
        },
        include: {
          user: true,
          service: { include: { provider: true } },
        },
      });

      if (!processingOrders.length) {
        this.logger.log('No processing orders found to check');
        return;
      }

      const byProvider = new Map<string, typeof processingOrders>();
      for (const order of processingOrders) {
        const slug = order.service?.provider?.slug || 'smmstone';
        const list = byProvider.get(slug) || [];
        list.push(order);
        byProvider.set(slug, list);
      }

      for (const [slug, orders] of byProvider) {
        try {
          const provider = this.smmRegistry.getProvider(slug);
          const chunks = this.chunkArray(orders, 100);

          for (const chunk of chunks) {
            const orderIds = chunk.map((o) => parseInt(o.providerOrderId!, 10));
            const statuses = await provider.getMultipleOrderStatus(orderIds);

            for (const order of chunk) {
              const providerOrderId = parseInt(order.providerOrderId!, 10);
              const statusData = Array.isArray(statuses)
                ? (statuses as Array<{ order?: number }>).find((s) => s.order === providerOrderId)
                : (statuses as Record<number, unknown>)[providerOrderId];

              if (statusData) {
                await this.updateOrderStatus(order, statusData);
              }
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          this.logger.error(`Failed to check orders for provider ${slug}:`, error);
        }
      }

      this.logger.log('Completed scheduled SMM order status check');
    } catch (error) {
      this.logger.error('Error in scheduled SMM order status check:', error);
    }
  }

  private async updateOrderStatus(order: { id: string; status: string; user?: { id: string } | null }, statusData: unknown) {
    const data = statusData as { status?: string };
    let newStatus = order.status;
    let notificationMessage = '';
    let shouldNotify = false;

    switch (data.status?.toLowerCase()) {
      case 'completed':
        if (order.status !== 'COMPLETED') {
          newStatus = 'COMPLETED';
          notificationMessage = 'Your order has been completed successfully! 🎉';
          shouldNotify = true;
        }
        break;
      case 'processing':
      case 'in progress':
        break;
      case 'partial':
        if (order.status !== 'PROCESSING') {
          newStatus = 'PROCESSING';
          notificationMessage = 'Your order is partially completed and still processing. ⏳';
          shouldNotify = true;
        }
        break;
      case 'cancelled':
      case 'canceled':
        if (order.status !== 'CANCELLED') {
          newStatus = 'CANCELLED';
          notificationMessage =
            'Your order has been cancelled. If you have questions, please contact support. ❌';
          shouldNotify = true;
        }
        break;
      case 'failed':
        if (order.status !== 'FAILED') {
          newStatus = 'FAILED';
          notificationMessage =
            'Your order failed to process. Please contact our support team for assistance. ⚠️';
          shouldNotify = true;
        }
        break;
    }

    if (newStatus === order.status) return;

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: newStatus as never, updatedAt: new Date() },
    });

    this.logger.log(`Updated order ${order.id} status: ${order.status} → ${newStatus}`);

    if (!shouldNotify || !notificationMessage) return;

    try {
      const typeMap = {
        COMPLETED: 'order_completed' as const,
        CANCELLED: 'order_rejected' as const,
        FAILED: 'order_rejected' as const,
        PROCESSING: 'order_approved' as const,
      };
      const notifyType = typeMap[newStatus as keyof typeof typeMap];
      if (notifyType) {
        await this.notificationService.sendOrderNotification(order.id, notifyType);
      } else if (order.user) {
        await this.notificationService.sendNotification({
          title: 'Order Status Update',
          body: notificationMessage,
          type: NotificationType.ORDER_UPDATE,
          userIds: [order.user.id],
          orderId: order.id,
          data: { orderId: order.id, status: newStatus, type: 'order_update' },
        });
      }
    } catch (notificationError) {
      this.logger.error(`Failed to send notification for order ${order.id}:`, notificationError);
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
