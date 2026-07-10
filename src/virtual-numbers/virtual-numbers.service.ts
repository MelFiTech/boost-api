import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FleexaSmsServer,
  Prisma,
  VirtualNumberProductType,
  VirtualNumberRentalStatus,
  WalletTransactionCategory,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FeaturesService } from '../features/features.service';
import { PinService } from '../pin/pin.service';
import { WalletService } from '../wallet/wallet.service';
import { FleexaVirtualNumberProvider } from './fleexa/fleexa-virtual-number.provider';
import { FleexaSmsServerSlug } from './fleexa/fleexa.types';
import {
  fleexaServerToSlug,
  slugToFleexaServer,
} from './virtual-number.provider.types';
import { VirtualNumberProviderRegistryService } from './virtual-number.registry';

export interface BuySmsOtpDto {
  server?: FleexaSmsServerSlug;
  countryName: string;
  appName: string;
  countryId: string;
  projectId: string;
  operator?: string;
  maxPrice?: number;
  pin: string;
}

@Injectable()
export class VirtualNumbersService {
  private readonly logger = new Logger(VirtualNumbersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly featuresService: FeaturesService,
    private readonly pinService: PinService,
    private readonly registry: VirtualNumberProviderRegistryService,
    private readonly fleexa: FleexaVirtualNumberProvider,
    private readonly config: ConfigService,
  ) {}

  private async assertEnabled() {
    if (!(await this.featuresService.isEnabled('virtual_numbers'))) {
      throw new ForbiddenException('Virtual numbers are currently unavailable');
    }
    const provider = await this.registry.getActiveProvider();
    if (provider.slug === 'fleexa' && !this.fleexa.isConfigured()) {
      throw new BadRequestException('Fleexa provider is not configured');
    }
  }

  private getMarkupPercent(): number {
    const raw = this.config.get<string>('FLEEXA_MARKUP_PERCENT') || '0';
    const value = parseFloat(raw);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  retailPrice(providerPriceNgn: number): number {
    const markup = this.getMarkupPercent();
    return Math.ceil(providerPriceNgn * (1 + markup / 100));
  }

  private normalizeServer(server?: FleexaSmsServerSlug): FleexaSmsServerSlug {
    if (!server || server === 'sms') return 'sms';
    if (server === 'sms2' || server === 'sms3') return server;
    throw new BadRequestException('server must be sms, sms2, or sms3');
  }

  private getFleexaClient() {
    return this.fleexa.getClient();
  }

  async getProviderBalance() {
    await this.assertEnabled();
    return { provider: 'fleexa', balance: await this.fleexa.getBalance() };
  }

  async listSmsCountries(serverInput?: FleexaSmsServerSlug) {
    await this.assertEnabled();
    const server = this.normalizeServer(serverInput);
    const countries = await this.getFleexaClient().listSmsCountries(server);
    return { server, countries };
  }

  async listSmsApps(
    countryId: string,
    serverInput?: FleexaSmsServerSlug,
    page?: number,
    limit?: number,
    search?: string,
  ) {
    await this.assertEnabled();
    const server = this.normalizeServer(serverInput);
    const result = await this.getFleexaClient().listSmsApps(
      server,
      countryId,
      page,
      limit,
      search,
    );
    const markup = this.getMarkupPercent();
    const apps = result.apps.map((app) => {
      const providerPrice = parseFloat(app.price_ngn || '0');
      return {
        ...app,
        provider_price_ngn: providerPrice,
        price_ngn: String(this.retailPrice(providerPrice)),
        markup_percent: markup,
      };
    });
    return {
      server,
      apps,
      pagination: result.pagination,
      exchange_rate: result.exchangeRate,
      markup_percent: markup,
    };
  }

  async getSmsPrices(countryId: string) {
    await this.assertEnabled();
    const prices = await this.getFleexaClient().getSmsPrices('sms', countryId);
    const markup = this.getMarkupPercent();
    const data = Object.fromEntries(
      Object.entries(prices).map(([key, app]) => {
        const providerPrice = parseFloat(
          (app as { cost_ngn?: string; price_ngn?: string }).cost_ngn ||
            (app as { price_ngn?: string }).price_ngn ||
            '0',
        );
        return [
          key,
          {
            ...app,
            provider_price_ngn: providerPrice,
            price_ngn: String(this.retailPrice(providerPrice)),
            markup_percent: markup,
          },
        ];
      }),
    );
    return { server: 'sms' as const, data, markup_percent: markup };
  }

  async buySmsOtp(userId: string, input: BuySmsOtpDto) {
    await this.assertEnabled();
    await this.pinService.requireValidPin(userId, input.pin);

    const server = this.normalizeServer(input.server);
    const smsServer = slugToFleexaServer(server);
    const client = this.getFleexaClient();

    const { apps } = await client.listSmsApps(server, input.countryId);
    const app = apps.find(
      (a) =>
        String(a.id) === String(input.projectId) ||
        String(a.name).toLowerCase() === input.appName.toLowerCase(),
    );
    if (!app) {
      throw new BadRequestException('Selected app/service is not available for this country');
    }

    const stock = app.qty ?? app.quantity ?? 0;
    if (stock <= 0) {
      throw new BadRequestException('No stock for this service in the selected country');
    }

    const providerPrice = parseFloat(app.price_ngn || '0');
    if (!providerPrice || providerPrice <= 0) {
      throw new BadRequestException('Could not resolve price for this service');
    }

    const chargeAmount = this.retailPrice(providerPrice);

    const debit = await this.walletService.applyLedgerEntry({
      userId,
      type: WalletTransactionType.DEBIT,
      category: WalletTransactionCategory.VIRTUAL_NUMBER,
      amount: chargeAmount,
      narration: `SMS OTP · ${input.appName} · ${input.countryName}`,
      provider: 'fleexa',
      referencePrefix: 'vno',
      metadata: {
        productType: VirtualNumberProductType.SMS_OTP,
        server,
        countryName: input.countryName,
        appName: input.appName,
        providerPrice,
      },
    });

    const rental = await this.prisma.virtualNumberRental.create({
      data: {
        userId,
        productType: VirtualNumberProductType.SMS_OTP,
        smsServer,
        provider: 'fleexa',
        walletTransactionId: debit.id,
        countryName: input.countryName,
        countryId: input.countryId,
        appName: input.appName,
        projectId: input.projectId,
        amountCharged: new Prisma.Decimal(chargeAmount.toFixed(2)),
        status: VirtualNumberRentalStatus.PENDING,
        metadata: {
          server,
          providerPrice,
          markupPercent: this.getMarkupPercent(),
        },
      },
    });

    try {
      const purchase = await client.buySms(server, {
        countryName: input.countryName,
        appName: input.appName,
        countryId: input.countryId,
        projectId: input.projectId,
        operator: input.operator,
        maxPrice: input.maxPrice,
      });

      const updated = await this.prisma.virtualNumberRental.update({
        where: { id: rental.id },
        data: {
          providerRequestId: purchase.requestId,
          phoneNumber: purchase.number,
          providerCost: new Prisma.Decimal(String(purchase.amount_paid ?? providerPrice)),
          status: VirtualNumberRentalStatus.WAITING,
          metadata: {
            ...(rental.metadata as object),
            fleexaStatus: purchase.status,
          },
        },
      });

      return this.summarizeRental(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Fleexa buy failed for rental ${rental.id}: ${message}`);
      await this.refundRental(userId, rental.id, chargeAmount, message);
      throw new BadRequestException(`Could not purchase number: ${message}`);
    }
  }

  async syncRentalStatus(rentalId: string, userId?: string) {
    const rental = await this.prisma.virtualNumberRental.findFirst({
      where: userId ? { id: rentalId, userId } : { id: rentalId },
    });
    if (!rental) throw new NotFoundException('Rental not found');
    if (!rental.providerRequestId) {
      return this.summarizeRental(rental);
    }

    const terminal = new Set<VirtualNumberRentalStatus>([
      VirtualNumberRentalStatus.RECEIVED,
      VirtualNumberRentalStatus.CANCELLED,
      VirtualNumberRentalStatus.EXPIRED,
      VirtualNumberRentalStatus.FAILED,
      VirtualNumberRentalStatus.REFUNDED,
    ]);
    if (terminal.has(rental.status)) {
      return this.summarizeRental(rental);
    }

    const server = fleexaServerToSlug(rental.smsServer);
    const check = await this.getFleexaClient().checkSms(server, rental.providerRequestId);
    const status = this.mapFleexaStatus(check.code);

    const smsBody = check.sms || check.message || null;
    const smsCode =
      check.code_received ||
      (status === VirtualNumberRentalStatus.RECEIVED ? this.extractCode(smsBody) : null);

    let updated = await this.prisma.virtualNumberRental.update({
      where: { id: rental.id },
      data: {
        status,
        smsBody,
        smsCode,
        metadata: {
          ...(rental.metadata as object),
          lastCheckCode: check.code,
        },
      },
    });

    if (
      (status === VirtualNumberRentalStatus.CANCELLED ||
        status === VirtualNumberRentalStatus.EXPIRED) &&
      rental.status !== VirtualNumberRentalStatus.REFUNDED
    ) {
      await this.refundRental(
        rental.userId,
        rental.id,
        Number(rental.amountCharged),
        `Provider status: ${check.code}`,
      );
      updated = await this.prisma.virtualNumberRental.findUniqueOrThrow({
        where: { id: rental.id },
      });
    }

    return this.summarizeRental(updated);
  }

  async cancelRental(userId: string, rentalId: string, pin: string) {
    await this.assertEnabled();
    await this.pinService.requireValidPin(userId, pin);

    const rental = await this.prisma.virtualNumberRental.findFirst({
      where: { id: rentalId, userId },
    });
    if (!rental) throw new NotFoundException('Rental not found');
    if (!rental.providerRequestId) {
      throw new BadRequestException('Rental was not submitted to the provider');
    }
    if (
      rental.status === VirtualNumberRentalStatus.RECEIVED ||
      rental.status === VirtualNumberRentalStatus.REFUNDED
    ) {
      throw new BadRequestException(`Cannot cancel a ${rental.status.toLowerCase()} rental`);
    }

    const server = fleexaServerToSlug(rental.smsServer);
    await this.getFleexaClient().cancelSms(server, rental.providerRequestId);

    await this.refundRental(
      userId,
      rental.id,
      Number(rental.amountCharged),
      'Cancelled by user',
      VirtualNumberRentalStatus.CANCELLED,
    );

    const updated = await this.prisma.virtualNumberRental.findUniqueOrThrow({
      where: { id: rental.id },
    });

    return this.summarizeRental(updated);
  }

  async getRental(userId: string, rentalId: string) {
    const rental = await this.prisma.virtualNumberRental.findFirst({
      where: { id: rentalId, userId },
    });
    if (!rental) throw new NotFoundException('Rental not found');

    if (
      rental.status === VirtualNumberRentalStatus.WAITING ||
      rental.status === VirtualNumberRentalStatus.PENDING
    ) {
      return this.syncRentalStatus(rental.id, userId);
    }

    return this.summarizeRental(rental);
  }

  async getHistory(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.virtualNumberRental.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.virtualNumberRental.count({ where: { userId } }),
    ]);

    return {
      items: items.map((item) => this.summarizeRental(item)),
      total,
      page,
      limit,
    };
  }

  private mapFleexaStatus(code: string): VirtualNumberRentalStatus {
    switch (String(code || '').toUpperCase()) {
      case 'RECEIVED':
        return VirtualNumberRentalStatus.RECEIVED;
      case 'CANCELED':
      case 'CANCELLED':
        return VirtualNumberRentalStatus.CANCELLED;
      case 'EXPIRED':
        return VirtualNumberRentalStatus.EXPIRED;
      case 'WAITING':
      case 'PENDING':
        return VirtualNumberRentalStatus.WAITING;
      default:
        return VirtualNumberRentalStatus.WAITING;
    }
  }

  private extractCode(sms: string | null | undefined): string | null {
    if (!sms) return null;
    const match = sms.match(/\b(\d{4,8})\b/);
    return match?.[1] || sms.trim() || null;
  }

  async refundRental(
    userId: string,
    rentalId: string,
    amount: number,
    reason: string,
    status: VirtualNumberRentalStatus = VirtualNumberRentalStatus.REFUNDED,
  ) {
    const rental = await this.prisma.virtualNumberRental.findUnique({
      where: { id: rentalId },
    });
    if (!rental || rental.status === VirtualNumberRentalStatus.REFUNDED) return;

    await this.walletService.applyLedgerEntry({
      userId,
      type: WalletTransactionType.CREDIT,
      category: WalletTransactionCategory.REFUND,
      amount,
      narration: 'Refund for virtual number rental',
      provider: rental.provider,
      referencePrefix: 'rfd',
      metadata: { rentalId, reason },
    });

    await this.prisma.virtualNumberRental.update({
      where: { id: rentalId },
      data: {
        status,
        metadata: {
          ...(rental.metadata as object),
          refundReason: reason,
        },
      },
    });
  }

  summarizeRental(rental: {
    id: string;
    productType: VirtualNumberProductType;
    smsServer: FleexaSmsServer;
    provider: string;
    providerRequestId: string | null;
    countryName: string | null;
    countryId: string | null;
    appName: string | null;
    projectId: string | null;
    phoneNumber: string | null;
    amountCharged: Prisma.Decimal;
    providerCost: Prisma.Decimal | null;
    status: VirtualNumberRentalStatus;
    smsCode: string | null;
    smsBody: string | null;
    createdAt: Date;
    updatedAt: Date;
    metadata?: unknown;
  }) {
    const meta = (rental.metadata || {}) as Record<string, unknown>;
    return {
      id: rental.id,
      productType: rental.productType,
      server: fleexaServerToSlug(rental.smsServer),
      provider: rental.provider,
      requestId: rental.providerRequestId,
      countryName: rental.countryName,
      countryId: rental.countryId,
      appName: rental.appName,
      projectId: rental.projectId,
      phoneNumber: rental.phoneNumber,
      amountCharged: Number(rental.amountCharged),
      providerCost: rental.providerCost ? Number(rental.providerCost) : null,
      status: rental.status,
      smsCode: rental.smsCode,
      smsBody: rental.smsBody,
      createdAt: rental.createdAt,
      updatedAt: rental.updatedAt,
      markupPercent: meta.markupPercent ?? this.getMarkupPercent(),
    };
  }
}
