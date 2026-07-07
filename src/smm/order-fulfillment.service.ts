import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  isSmmstoneInsufficientBalanceError,
  LOW_PROVIDER_BALANCE_ISSUE,
} from '../smmstone/smmstone-balance.util';
import { SmmProviderRegistryService } from './smm-provider.registry';

export interface FulfillmentResult {
  submitted: boolean;
  providerOrderId?: string;
  error?: string;
  issue?: string;
}

/**
 * Hands paid orders to the active SMM provider — no admin approval step.
 * Low-balance threshold is dashboard-only; the provider API decides if funds are enough.
 */
@Injectable()
export class OrderFulfillmentService {
  private readonly logger = new Logger(OrderFulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smmRegistry: SmmProviderRegistryService,
  ) {}

  async fulfillOrder(orderId: string): Promise<FulfillmentResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { service: { include: { provider: true } } },
    });

    if (!order) {
      return { submitted: false, error: 'Order not found' };
    }
    if (order.providerOrderId) {
      return { submitted: true, providerOrderId: order.providerOrderId };
    }

    const providerSlug = order.service?.provider?.slug || (await this.smmRegistry.getActiveSlug());
    const provider = this.smmRegistry.getProvider(providerSlug);

    try {
      const response = await provider.submitOrder({
        service: parseInt(order.service.serviceId, 10),
        link: order.link,
        quantity: order.quantity,
      });

      const providerOrderId = String(response.order);
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PROCESSING',
          providerOrderId,
          fulfillmentError: null,
        },
      });

      this.logger.log(
        `Order ${order.id} submitted to ${provider.displayName} as #${providerOrderId}`,
      );
      return { submitted: true, providerOrderId };
    } catch (error) {
      const err = error as { message?: string };
      const message = err?.message || 'Unknown fulfillment error';
      const issue = isSmmstoneInsufficientBalanceError(message)
        ? LOW_PROVIDER_BALANCE_ISSUE
        : 'NOT_SUBMITTED';

      await this.markFulfillmentFailure(order.id, message, issue);

      if (issue === LOW_PROVIDER_BALANCE_ISSUE) {
        this.logger.warn(
          `Order ${order.id} queued — ${provider.displayName} rejected submission (insufficient balance): ${message}`,
        );
      } else {
        this.logger.error(`Auto-fulfillment failed for order ${order.id}: ${message}`);
      }

      return { submitted: false, error: message, issue };
    }
  }

  private async markFulfillmentFailure(orderId: string, message: string, issue: string) {
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentError: `[${issue}] ${message}`.slice(0, 500),
      },
    });
  }
}
