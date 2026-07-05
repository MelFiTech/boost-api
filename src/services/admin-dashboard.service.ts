import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, PaymentStatus, TransactionStatus } from '@prisma/client';
import { NyraApiService } from '../providers/nyra/nyra-api.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { SmmstoneService } from '../smmstone/smmstone.service';
import {
  LOW_PROVIDER_BALANCE_ISSUE,
  parseSmmstoneBalance,
} from '../smmstone/smmstone-balance.util';

export type DashboardPeriod = 'today' | 'week' | 'month' | 'all' | 'custom';

export interface DashboardDateRange {
  period: DashboardPeriod;
  from: string;
  to: string;
  label: string;
}

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smmstoneService: SmmstoneService,
    private readonly nyraApi: NyraApiService,
    private readonly appSettingsService: AppSettingsService,
  ) {}

  resolveDateRange(
    period: DashboardPeriod = 'week',
    startDate?: string,
    endDate?: string,
  ): DashboardDateRange {
    const now = new Date();
    const to = endDate ? new Date(endDate) : new Date(now);
    to.setHours(23, 59, 59, 999);

    let from: Date;
    let label: string;

    switch (period) {
      case 'today':
        from = new Date(now);
        from.setHours(0, 0, 0, 0);
        label = 'Today';
        break;
      case 'week':
        from = new Date(now);
        from.setDate(from.getDate() - 7);
        from.setHours(0, 0, 0, 0);
        label = 'Last 7 days';
        break;
      case 'month':
        from = new Date(now);
        from.setDate(from.getDate() - 30);
        from.setHours(0, 0, 0, 0);
        label = 'Last 30 days';
        break;
      case 'custom':
        from = startDate ? new Date(startDate) : new Date(now);
        from.setHours(0, 0, 0, 0);
        label = startDate && endDate ? `${startDate} – ${endDate}` : 'Custom range';
        break;
      case 'all':
      default:
        from = new Date(0);
        label = 'All time';
        break;
    }

    return {
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      label,
    };
  }

  async getAnalytics(
    period: DashboardPeriod = 'week',
    startDate?: string,
    endDate?: string,
  ) {
    const range = this.resolveDateRange(period, startDate, endDate);
    const from = new Date(range.from);
    const to = new Date(range.to);
    const exchangeRate = await this.appSettingsService.getUsdtExchangeRate();
    const dateFilter = { gte: from, lte: to };

    const [
      walletAgg,
      totalUsers,
      newUsers,
      verifiedUsers,
      pendingKyc,
      walletTxCount,
      fundingAgg,
      withdrawalAgg,
      billAgg,
      smmOrderWalletAgg,
      ordersInPeriod,
      completedOrdersInPeriod,
      pendingOrders,
      processingOrders,
      providerBalances,
      completedOrdersForMarkup,
      withdrawalTxForFees,
      fundingTxForFees,
      legacyPaymentTxCount,
      activeWallets,
      billPaymentCount,
    ] = await Promise.all([
      this.prisma.wallet.aggregate({ _sum: { balance: true }, _count: true }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: dateFilter } }),
      this.prisma.user.count({ where: { isVerified: true } }),
      this.prisma.userKyc.count({ where: { status: 'PENDING' } }),
      this.prisma.walletTransaction.count({ where: { createdAt: dateFilter } }),
      this.prisma.walletTransaction.aggregate({
        where: {
          category: 'FUNDING',
          type: 'CREDIT',
          status: TransactionStatus.COMPLETED,
          createdAt: dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.walletTransaction.aggregate({
        where: {
          category: 'WITHDRAWAL',
          type: 'DEBIT',
          status: TransactionStatus.COMPLETED,
          createdAt: dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.walletTransaction.aggregate({
        where: {
          category: 'BILL_PAYMENT',
          type: 'DEBIT',
          status: TransactionStatus.COMPLETED,
          createdAt: dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.walletTransaction.aggregate({
        where: {
          category: 'SMM_ORDER',
          type: 'DEBIT',
          status: TransactionStatus.COMPLETED,
          createdAt: dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.order.count({ where: { createdAt: dateFilter } }),
      this.prisma.order.count({
        where: { status: OrderStatus.COMPLETED, createdAt: dateFilter },
      }),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.prisma.order.count({ where: { status: OrderStatus.PROCESSING } }),
      this.fetchProviderBalances(),
      this.prisma.order.findMany({
        where: { status: OrderStatus.COMPLETED, createdAt: dateFilter },
        include: { service: true },
      }),
      this.prisma.walletTransaction.findMany({
        where: {
          category: 'WITHDRAWAL',
          status: TransactionStatus.COMPLETED,
          createdAt: dateFilter,
        },
        select: { metadata: true },
      }),
      this.prisma.walletTransaction.findMany({
        where: {
          category: 'FUNDING',
          status: TransactionStatus.COMPLETED,
          createdAt: dateFilter,
        },
        select: { metadata: true },
      }),
      this.prisma.transaction.count({ where: { createdAt: dateFilter } }),
      this.prisma.wallet.count({ where: { active: true, balance: { gt: 0 } } }),
      this.prisma.billPayment.count({ where: { createdAt: dateFilter } }),
    ]);

    const orderRevenueAgg = await this.prisma.order.aggregate({
      where: {
        status: OrderStatus.COMPLETED,
        createdAt: dateFilter,
        payment: { status: PaymentStatus.COMPLETED },
      },
      _sum: { price: true },
    });

    const platformMarkup = completedOrdersForMarkup.reduce((sum, order) => {
      const price = parseFloat(order.price.toString());
      const providerRate = order.service?.providerRate
        ? parseFloat(order.service.providerRate.toString())
        : 0;
      const providerCostNgn = ((providerRate / 1000) * order.quantity) * exchangeRate;
      return sum + Math.max(0, price - providerCostNgn);
    }, 0);

    const withdrawalFees = withdrawalTxForFees.reduce((sum, tx) => {
      const meta = tx.metadata as { platformFee?: number; nyra?: { charge?: number } } | null;
      return sum + Math.abs(meta?.platformFee ?? 0);
    }, 0);

    const fundingFees = fundingTxForFees.reduce((sum, tx) => {
      const meta = tx.metadata as { platformFee?: number } | null;
      return sum + Math.abs(meta?.platformFee ?? 0);
    }, 0);

    const totalFees = platformMarkup + withdrawalFees + fundingFees;
    const orderRevenue = parseFloat((orderRevenueAgg._sum.price ?? 0).toString());
    const walletFundingVolume = parseFloat((fundingAgg._sum.amount ?? 0).toString());
    const withdrawalVolume = parseFloat((withdrawalAgg._sum.amount ?? 0).toString());
    const billVolume = parseFloat((billAgg._sum.amount ?? 0).toString());
    const walletSmmVolume = parseFloat((smmOrderWalletAgg._sum.amount ?? 0).toString());
    const totalWalletBalance = parseFloat((walletAgg._sum.balance ?? 0).toString());

    return {
      success: true,
      range,
      providers: providerBalances,
      wallets: {
        totalBalance: totalWalletBalance,
        totalBalanceUSDT: parseFloat((totalWalletBalance / exchangeRate).toFixed(2)),
        walletCount: walletAgg._count,
        activeWithBalance: activeWallets,
      },
      users: {
        total: totalUsers,
        newInPeriod: newUsers,
        verified: verifiedUsers,
        pendingKyc,
      },
      transactions: {
        walletTxCount,
        legacyPaymentTxCount,
        ordersInPeriod,
        billPaymentsInPeriod: billPaymentCount,
        fundingCount: fundingAgg._count,
        withdrawalCount: withdrawalAgg._count,
        smmWalletDebits: smmOrderWalletAgg._count,
      },
      volume: {
        orderRevenue,
        orderRevenueUSDT: parseFloat((orderRevenue / exchangeRate).toFixed(2)),
        walletFunding: walletFundingVolume,
        withdrawals: withdrawalVolume,
        billPayments: billVolume,
        walletSmmOrders: walletSmmVolume,
        grossVolume:
          orderRevenue + walletFundingVolume + billVolume + walletSmmVolume,
      },
      fees: {
        total: parseFloat(totalFees.toFixed(2)),
        platformMarkup: parseFloat(platformMarkup.toFixed(2)),
        withdrawalFees: parseFloat(withdrawalFees.toFixed(2)),
        fundingFees: parseFloat(fundingFees.toFixed(2)),
      },
      orders: {
        pending: pendingOrders,
        processing: processingOrders,
        completedInPeriod: completedOrdersInPeriod,
        createdInPeriod: ordersInPeriod,
      },
      exchangeRate,
    };
  }

  private async fetchProviderBalances() {
    const lowBalanceThreshold = parseFloat(
      process.env.SMMSTONE_LOW_BALANCE_THRESHOLD || '10',
    );

    const pendingDueToLowBalance = await this.prisma.order.count({
      where: {
        status: 'PENDING',
        providerOrderId: null,
        fulfillmentError: { contains: LOW_PROVIDER_BALANCE_ISSUE },
        payment: { status: PaymentStatus.COMPLETED },
      },
    });

    const smmstone = await this.smmstoneService
      .getBalance()
      .then((data) => {
        const balance = parseSmmstoneBalance(data);
        const lowBalance =
          balance != null ? balance < lowBalanceThreshold : false;
        return {
          balance,
          currency: data?.currency || 'USD',
          lowBalance,
          lowBalanceThreshold,
          pendingDueToLowBalance,
          error: null as string | null,
        };
      })
      .catch((err) => {
        this.logger.warn(`SMMStone balance fetch failed: ${err.message}`);
        return {
          balance: null,
          currency: 'USD',
          lowBalance: false,
          lowBalanceThreshold,
          pendingDueToLowBalance,
          error: err.message,
        };
      });

    const nyraMaster = await this.nyraApi
      .getBusinessWalletBalance()
      .then((data) => ({
        businessId: data.businessId,
        businessName: data.businessName,
        balance: data.balance,
        availableBalance: data.available_balance,
        unsettledBalance: data.unsettled_balance,
        settlementEnabled: data.settlement_enabled,
        currency: 'NGN',
        error: null as string | null,
      }))
      .catch((err) => {
        this.logger.warn(`Nyra master wallet balance fetch failed: ${err.message}`);
        return {
          businessId: null,
          businessName: null,
          balance: null,
          availableBalance: null,
          unsettledBalance: null,
          settlementEnabled: null,
          currency: 'NGN',
          error: err.message,
        };
      });

    const nyraFloat = await this.nyraApi
      .listFloatWallets()
      .then((wallets) => {
        const business =
          wallets.find((w) => w.is_business_float === true) || wallets[0];
        const totalAvailable = wallets.reduce(
          (sum, w) => sum + (Number(w.available_balance) || 0),
          0,
        );
        return {
          balance: business?.available_balance ?? totalAvailable ?? null,
          totalFloatBalance: totalAvailable,
          currency: 'NGN',
          accountNumber: business?.account_number ?? null,
          accountName: business?.account_name ?? null,
          bankName: business?.bank_name ?? null,
          walletCount: wallets.length,
          error: null as string | null,
        };
      })
      .catch((err) => {
        this.logger.warn(`Nyra float balance fetch failed: ${err.message}`);
        return {
          balance: null,
          totalFloatBalance: null,
          currency: 'NGN',
          accountNumber: null,
          accountName: null,
          bankName: null,
          walletCount: 0,
          error: err.message,
        };
      });

    return { smmstone, nyraMaster, nyraFloat };
  }
}
