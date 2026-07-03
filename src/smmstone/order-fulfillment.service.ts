import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  isSmmstoneInsufficientBalanceError,
  isSmmstoneLowBalance,
  LOW_PROVIDER_BALANCE_ISSUE,
  parseSmmstoneBalance,
} from './smmstone-balance.util';
import { SmmstoneService } from './smmstone.service';

export interface FulfillmentResult {
  submitted: boolean;
  providerOrderId?: string;
  error?: string;
  issue?: string;
}

/**
 * Hands paid orders straight to SMMStone — no admin approval step.
 * If submission fails the order stays PENDING with a completed payment,
 * which surfaces it on the admin "needs attention" list for refire/refund.
 */
@Injectable()
export class OrderFulfillmentService {
  private readonly logger = new Logger(OrderFulfillmentService.name);
  private readonly lowBalanceThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly smmstoneService: SmmstoneService,
    private readonly configService: ConfigService,
  ) {
    this.lowBalanceThreshold = parseFloat(
      this.configService.get<string>('SMMSTONE_LOW_BALANCE_THRESHOLD') || '10',
    );
  }

  async fulfillOrder(orderId: string): Promise<FulfillmentResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { service: true },
    });

    if (!order) {
      return { submitted: false, error: 'Order not found' };
    }
    if (order.providerOrderId) {
      return { submitted: true, providerOrderId: order.providerOrderId };
    }

    const balanceCheck = await this.smmstoneService.getBalanceStatus(this.lowBalanceThreshold);
    if (balanceCheck.lowBalance) {
      const message = `SMMStone balance is low ($${balanceCheck.balance?.toFixed(2) ?? '0.00'}). Top up the provider account to submit orders.`;
      await this.markFulfillmentFailure(order.id, message, LOW_PROVIDER_BALANCE_ISSUE);
      this.logger.warn(
        `Order ${order.id} queued — SMMStone balance low ($${balanceCheck.balance}). Threshold: $${this.lowBalanceThreshold}`,
      );
      return {
        submitted: false,
        error: message,
        issue: LOW_PROVIDER_BALANCE_ISSUE,
      };
    }

    try {
      const response = await this.smmstoneService.submitOrder({
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

      this.logger.log(`Order ${order.id} submitted to SMMStone as #${providerOrderId}`);
      return { submitted: true, providerOrderId };
    } catch (error) {
      const message = error?.message || 'Unknown fulfillment error';
      const issue = isSmmstoneInsufficientBalanceError(message)
        ? LOW_PROVIDER_BALANCE_ISSUE
        : 'NOT_SUBMITTED';

      await this.markFulfillmentFailure(order.id, message, issue);

      if (issue === LOW_PROVIDER_BALANCE_ISSUE) {
        this.logger.warn(
          `Order ${order.id} queued — SMMStone rejected submission (insufficient provider balance): ${message}`,
        );
      } else {
        this.logger.error(`Auto-fulfillment failed for order ${order.id}: ${message}`);
      }

      return { submitted: false, error: message, issue };
    }
  }

  private async markFulfillmentFailure(
    orderId: string,
    message: string,
    issue: string,
  ) {
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentError: `[${issue}] ${message}`.slice(0, 500),
      },
    });
  }
}
