import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BillsProvider, PayBillParams, PayBillResult } from '../provider.types';
import { NyraVasApiService } from './nyra-vas-api.service';

@Injectable()
export class NyraBillsProvider implements BillsProvider {
  readonly name = 'nyra';
  private readonly logger = new Logger(NyraBillsProvider.name);

  constructor(private readonly vasApi: NyraVasApiService) {}

  async payBill(params: PayBillParams): Promise<PayBillResult> {
    if (params.amount < 100) {
      throw new BadRequestException('Minimum bill amount is ₦100');
    }

    switch (params.billType) {
      case 'AIRTIME':
        return this.payAirtime(params);
      case 'DATA':
        return this.payData(params);
      case 'TV':
        return this.payTv(params);
      case 'ELECTRICITY':
        return this.payElectricity(params);
      default:
        throw new BadRequestException(`Bill type ${params.billType} is not supported by Nyra VAS`);
    }
  }

  private mapStatus(status: string): PayBillResult['status'] {
    const normalized = status.toLowerCase();
    if (normalized === 'delivered' || normalized === 'successful' || normalized === 'success') {
      return 'COMPLETED';
    }
    if (normalized === 'pending' || normalized === 'processing') {
      return 'PROCESSING';
    }
    return 'FAILED';
  }

  private payAirtime(params: PayBillParams): Promise<PayBillResult> {
    const network = (params.network || params.billerCode)?.toUpperCase();
    if (!network) {
      throw new BadRequestException('network is required for airtime (MTN, AIRTEL, GLO, 9MOBILE)');
    }

    return this.vasApi
      .purchaseAirtime(params.customerIdentifier, network, params.amount)
      .then((data) => ({
        providerRef: data.reference,
        status: this.mapStatus(data.status),
        metadata: data as unknown as Record<string, unknown>,
      }));
  }

  private payData(params: PayBillParams): Promise<PayBillResult> {
    const bundleId = params.bundleId || params.billerCode;
    if (!bundleId) {
      throw new BadRequestException('bundleId is required for data purchase');
    }

    return this.vasApi
      .purchaseData(params.customerIdentifier, bundleId, params.amount)
      .then((data) => ({
        providerRef: data.reference,
        status: this.mapStatus(data.status),
        metadata: data as unknown as Record<string, unknown>,
      }));
  }

  private payTv(params: PayBillParams): Promise<PayBillResult> {
    const packageId = params.packageId || params.billerCode;
    if (!packageId) {
      throw new BadRequestException('packageId is required for TV payment');
    }

    return this.vasApi
      .payTv(params.customerIdentifier, packageId, params.amount)
      .then((data) => ({
        providerRef: data.reference,
        status: this.mapStatus(data.status),
        metadata: data as unknown as Record<string, unknown>,
      }));
  }

  private payElectricity(params: PayBillParams): Promise<PayBillResult> {
    const packageId = params.packageId || params.billerCode;
    if (!packageId) {
      throw new BadRequestException('packageId is required for electricity payment');
    }

    if (params.customerIdentifier.replace(/\D/g, '').length < 10) {
      throw new BadRequestException('meter_number must be at least 10 digits');
    }

    return this.vasApi
      .payElectricity(params.customerIdentifier, packageId, params.amount)
      .then((data) => {
        this.logger.log(`Electricity payment pending: ref=${data.reference}`);
        return {
          providerRef: data.reference,
          status: this.mapStatus(data.status),
          metadata: data as unknown as Record<string, unknown>,
        };
      });
  }
}
