import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  BillType,
  Prisma,
  TransactionStatus,
  WalletTransactionCategory,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FeaturesService } from '../features/features.service';
import { PinService } from '../pin/pin.service';
import { NyraVasApiService } from '../providers/nyra/nyra-vas-api.service';
import {
  NyraVasValidateElectricityResult,
  NyraVasValidateTvResult,
} from '../providers/nyra/nyra-vas.types';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { PayBillResult } from '../providers/provider.types';
import { WalletService } from '../wallet/wallet.service';

export interface PayBillInput {
  billType: BillType;
  customerIdentifier: string;
  billerCode?: string;
  billerName?: string;
  amount: number;
  network?: string;
  bundleId?: string;
  packageId?: string;
  pin: string;
}

@Injectable()
export class BillsService {
  private readonly logger = new Logger(BillsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly providerRegistry: ProviderRegistryService,
    private readonly featuresService: FeaturesService,
    private readonly nyraVas: NyraVasApiService,
    private readonly pinService: PinService,
  ) {}

  private mapProviderStatus(status: PayBillResult['status']): TransactionStatus {
    switch (status) {
      case 'COMPLETED':
        return TransactionStatus.COMPLETED;
      case 'FAILED':
        return TransactionStatus.FAILED;
      case 'PROCESSING':
      default:
        return TransactionStatus.PROCESSING;
    }
  }

  async payBill(userId: string, input: PayBillInput) {
    if (!(await this.featuresService.isEnabled('bills'))) {
      throw new ForbiddenException('Bill payments are currently unavailable');
    }
    if (input.amount < 100) {
      throw new BadRequestException('Minimum bill amount is ₦100');
    }
    if (input.billType === BillType.ELECTRICITY && input.amount < 1000) {
      throw new BadRequestException('Minimum electricity amount is ₦1000');
    }

    this.validatePayInput(input);

    await this.pinService.requireValidPin(userId, input.pin);

    const provider = await this.providerRegistry.getBillsProvider();

    const debit = await this.walletService.applyLedgerEntry({
      userId,
      type: WalletTransactionType.DEBIT,
      category: WalletTransactionCategory.BILL_PAYMENT,
      amount: input.amount,
      narration: `${input.billType} payment for ${input.customerIdentifier}`,
      provider: provider.name,
      referencePrefix: 'bill',
      metadata: {
        billType: input.billType,
        billerName: input.billerName,
        network: input.network,
      },
    });

    const billPayment = await this.prisma.billPayment.create({
      data: {
        userId,
        walletTransactionId: debit.id,
        billType: input.billType,
        provider: provider.name,
        customerIdentifier: input.customerIdentifier,
        billerCode: input.billerCode || input.network || input.bundleId || input.packageId,
        amount: new Prisma.Decimal(input.amount.toFixed(2)),
        status: TransactionStatus.PROCESSING,
      },
    });

    try {
      const result = await provider.payBill({
        billType: input.billType,
        customerIdentifier: input.customerIdentifier,
        billerCode: input.billerCode,
        amount: input.amount,
        reference: debit.reference,
        network: input.network,
        bundleId: input.bundleId,
        packageId: input.packageId,
      });

      return await this.prisma.billPayment.update({
        where: { id: billPayment.id },
        data: {
          status: this.mapProviderStatus(result.status),
          providerRef: result.providerRef,
          metadata: result.metadata,
        },
      });
    } catch (error) {
      this.logger.error(`Bill payment failed, refunding wallet: ${error.message}`);
      await this.refundBillPayment(userId, input.amount, provider.name, billPayment.id, error.message);
      throw new BadRequestException(`Bill payment failed: ${error.message}`);
    }
  }

  async refundBillPayment(
    userId: string,
    amount: number,
    providerName: string,
    billPaymentId: string,
    reason: string,
  ) {
    await this.walletService.applyLedgerEntry({
      userId,
      type: WalletTransactionType.CREDIT,
      category: WalletTransactionCategory.REFUND,
      amount,
      narration: `Refund for failed bill payment`,
      provider: providerName,
      referencePrefix: 'rfd',
      metadata: { billPaymentId, reason },
    });
    await this.prisma.billPayment.update({
      where: { id: billPaymentId },
      data: { status: TransactionStatus.REFUNDED, metadata: { error: reason } },
    });
  }

  private validatePayInput(input: PayBillInput) {
    switch (input.billType) {
      case BillType.AIRTIME:
        if (!(input.network || input.billerCode)) {
          throw new BadRequestException('network is required for airtime (MTN, AIRTEL, GLO, 9MOBILE)');
        }
        break;
      case BillType.DATA:
        if (!(input.bundleId || input.billerCode)) {
          throw new BadRequestException('bundleId is required for data purchase');
        }
        break;
      case BillType.TV:
      case BillType.ELECTRICITY:
        if (!(input.packageId || input.billerCode)) {
          throw new BadRequestException('packageId is required for TV and electricity payments');
        }
        break;
      default:
        throw new BadRequestException(`Bill type ${input.billType} is not supported`);
    }
  }

  async getHistory(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.billPayment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.billPayment.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  }

  // ---------- Nyra VAS discovery (proxied) ----------

  listVasServices() {
    return this.nyraVas.listServices();
  }

  listVasBillers(serviceId: string) {
    return this.nyraVas.listBillers(serviceId);
  }

  listDataPlans(network: string) {
    return this.nyraVas.listDataPlansByNetwork(network);
  }

  listTvPackages(billerId: string) {
    return this.nyraVas.listTvItems(billerId);
  }

  listElectricityPackages(billerId: string) {
    return this.nyraVas.listElectricityItems(billerId);
  }

  private normalizeVasValidation(
    data: NyraVasValidateTvResult | NyraVasValidateElectricityResult,
    identifierLabel: string,
  ) {
    const record = data as Record<string, unknown>;
    const customerName = [
      data.customer_name,
      record.customerName,
      record.name,
      record.account_name,
      record.accountName,
      data.customer_info,
      record.customerInfo,
    ]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .find((value) => value.length > 0);

    if (!customerName) {
      throw new BadRequestException(`Could not resolve customer name for this ${identifierLabel}`);
    }

    return {
      customerName,
      customerInfo:
        typeof data.customer_info === 'string' && data.customer_info.trim()
          ? data.customer_info.trim()
          : null,
      outstanding: data.outstanding ?? null,
      amount: data.amount ?? null,
    };
  }

  async validateTv(smartCardNumber: string, packageId: string) {
    const data = await this.nyraVas.validateTv(smartCardNumber, packageId);
    return this.normalizeVasValidation(data, 'smartcard number');
  }

  async validateElectricity(meterNumber: string, packageId: string) {
    const data = await this.nyraVas.validateElectricity(meterNumber, packageId);
    return this.normalizeVasValidation(data, 'meter number');
  }

  getTransactionStatus(transactionId: string) {
    return this.nyraVas.getTransaction(transactionId);
  }
}
