import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VirtualNumberRentalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VirtualNumbersService } from './virtual-numbers.service';

/** Poll Fleexa every 30s for rentals still waiting on SMS (docs recommend 20–30s). */
@Injectable()
export class VirtualNumberStatusService {
  private readonly logger = new Logger(VirtualNumberStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly virtualNumbersService: VirtualNumbersService,
  ) {}

  @Cron('*/30 * * * * *')
  async pollWaitingRentals() {
    try {
      const rentals = await this.prisma.virtualNumberRental.findMany({
        where: {
          status: { in: [VirtualNumberRentalStatus.PENDING, VirtualNumberRentalStatus.WAITING] },
          providerRequestId: { not: null },
        },
        orderBy: { updatedAt: 'asc' },
        take: 50,
      });

      if (!rentals.length) return;

      this.logger.debug(`Polling ${rentals.length} virtual number rental(s) for SMS`);

      for (const rental of rentals) {
        try {
          await this.virtualNumbersService.syncRentalStatus(rental.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Status poll failed for rental ${rental.id}: ${message}`);
        }
      }
    } catch (error) {
      this.logger.error('Virtual number status cron failed', error);
    }
  }
}
