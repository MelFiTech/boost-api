import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KycStatus, Prisma } from '@prisma/client';
import { isKycDevMode } from '../common/utils/kyc-mode.util';
import { hashSensitiveValue, normalizeNameTokens } from '../common/utils/name-matching.util';
import { EmailService } from '../emails/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { NyraApiService } from '../providers/nyra/nyra-api.service';
import { NyraBvnBasicIdentity, NyraNinIdentity } from '../providers/nyra/nyra.types';

export interface SubmitKycInput {
  bvn: string;
  nin: string;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nyraApi: NyraApiService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  isDevMode(): boolean {
    return isKycDevMode(this.configService);
  }

  async getStatus(userId: string) {
    const record = await this.prisma.userKyc.findUnique({ where: { userId } });
    if (!record) {
      return {
        status: KycStatus.NOT_STARTED,
        bvnSubmitted: false,
        ninSubmitted: false,
        rejectionReason: null,
      };
    }

    return {
      status: record.status,
      bvnSubmitted: true,
      ninSubmitted: true,
      rejectionReason: record.rejectionReason,
    };
  }

  async submitKyc(userId: string, input: SubmitKycInput) {
    if (!/^\d{11}$/.test(input.bvn)) {
      throw new BadRequestException('BVN must be exactly 11 digits');
    }
    if (!/^\d{11}$/.test(input.nin)) {
      throw new BadRequestException('NIN must be exactly 11 digits');
    }

    const devMode = this.isDevMode();
    const identity = devMode
      ? this.buildDevIdentity(input)
      : await this.verifyCustomerIdentityProd(input);

    const data = {
      bvn: input.bvn,
      nin: input.nin,
      bvnHash: hashSensitiveValue(input.bvn),
      ninHash: hashSensitiveValue(input.nin),
      bvnLast4: input.bvn.slice(-4),
      ninLast4: input.nin.slice(-4),
      bvnFullName: identity.bvnFullName,
      ninFullName: identity.ninFullName,
      bvnIdentityData: identity.bvnIdentityData,
      ninIdentityData: identity.ninIdentityData,
      status: identity.status,
      bvnNames: identity.bvnNames,
      ninNames: identity.ninNames,
      rejectionReason: identity.rejectionReason,
      adminNote: null,
      reviewedBy: null,
      reviewedAt: null,
      verificationMode: devMode ? 'dev' : 'prod',
    };

    await this.prisma.userKyc.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    if (identity.status === KycStatus.REJECTED) {
      void this.notifyKycDecision(userId, 'declined', identity.rejectionReason || undefined);
    }

    this.logger.log(
      `KYC submitted for user ${userId} → ${identity.status} (${devMode ? 'dev' : 'prod'})`,
    );
    return { status: identity.status };
  }

  async requireVerified(userId: string) {
    const record = await this.prisma.userKyc.findUnique({ where: { userId } });
    if (!record || record.status !== KycStatus.VERIFIED) {
      throw new BadRequestException(
        'KYC must be approved before continuing. Please wait for admin verification.',
      );
    }
    return record;
  }

  async listForAdmin(status?: KycStatus, page = 1, limit = 20) {
    const where = status ? { status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.userKyc.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, email: true, username: true } },
        },
      }),
      this.prisma.userKyc.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toAdminResponse(item)),
      total,
      page,
      limit,
    };
  }

  async getForAdmin(id: string) {
    const record = await this.prisma.userKyc.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, username: true, createdAt: true } },
      },
    });
    if (!record) {
      throw new NotFoundException('KYC record not found');
    }
    return this.toAdminResponse(record);
  }

  async approveKyc(id: string, reviewedBy: string, adminNote?: string) {
    const record = await this.prisma.userKyc.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException('KYC record not found');
    }
    if (record.status === KycStatus.REJECTED) {
      throw new BadRequestException('Cannot approve a rejected KYC submission. User must re-submit.');
    }

    const updated = await this.prisma.userKyc.update({
      where: { id },
      data: {
        status: KycStatus.VERIFIED,
        rejectionReason: null,
        adminNote: adminNote?.trim() || record.adminNote,
        reviewedBy,
        reviewedAt: new Date(),
      },
      include: {
        user: { select: { id: true, email: true, username: true } },
      },
    });

    this.logger.log(`KYC ${id} approved by ${reviewedBy}`);
    void this.notifyKycDecision(updated.userId, 'approved');
    return this.toAdminResponse(updated);
  }

  async rejectKyc(id: string, reviewedBy: string, reason: string, adminNote?: string) {
    const record = await this.prisma.userKyc.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException('KYC record not found');
    }

    const updated = await this.prisma.userKyc.update({
      where: { id },
      data: {
        status: KycStatus.REJECTED,
        rejectionReason: reason.trim(),
        adminNote: adminNote?.trim() || record.adminNote,
        reviewedBy,
        reviewedAt: new Date(),
      },
      include: {
        user: { select: { id: true, email: true, username: true } },
      },
    });

    this.logger.log(`KYC ${id} rejected by ${reviewedBy}`);
    void this.notifyKycDecision(updated.userId, 'declined', reason.trim());
    return this.toAdminResponse(updated);
  }

  async revokeKyc(id: string, reviewedBy: string, reason: string, adminNote?: string) {
    return this.rejectKyc(id, reviewedBy, reason || 'KYC approval revoked by admin', adminNote);
  }

  private async notifyKycDecision(
    userId: string,
    status: 'approved' | 'declined',
    rejectionReason?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) return;

    try {
      const result = await this.emailService.sendKycVerificationEmail({
        email: user.email,
        userId,
        status,
        rejectionReason,
        reviewedAt: new Date(),
      });
      if (result.skipped) {
        this.logger.debug(`KYC ${status} email skipped for ${userId} (opted out)`);
      }
    } catch (error) {
      this.logger.warn(`KYC ${status} email failed for ${userId}: ${error.message}`);
    }
  }

  private buildDevIdentity(input: SubmitKycInput) {
    const bvnNames = ['test', 'user'];
    const ninNames = ['test', 'user'];

    return {
      status: KycStatus.PENDING,
      bvnNames,
      ninNames,
      bvnFullName: 'Test User',
      ninFullName: 'Test User',
      bvnIdentityData: { mode: 'dev', bvnLast4: input.bvn.slice(-4) } as Prisma.InputJsonValue,
      ninIdentityData: { mode: 'dev', ninLast4: input.nin.slice(-4) } as Prisma.InputJsonValue,
      rejectionReason: null,
    };
  }

  private async verifyCustomerIdentityProd(input: SubmitKycInput) {
    try {
      const [bvn, nin] = await Promise.all([
        this.nyraApi.verifyBvnBasic(input.bvn),
        this.nyraApi.verifyNin(input.nin),
      ]);

      const bvnNames = this.extractBvnNames(bvn);
      const ninNames = this.extractNinNames(nin);
      const bvnFullName = this.formatIdentityName(bvn);
      const ninFullName = this.formatIdentityName(nin);

      if (bvnNames.length < 2 || ninNames.length < 2) {
        return {
          status: KycStatus.REJECTED,
          bvnNames,
          ninNames,
          bvnFullName,
          ninFullName,
          bvnIdentityData: this.sanitizeIdentityData(bvn),
          ninIdentityData: this.sanitizeIdentityData(nin),
          rejectionReason: 'Could not verify enough name details from BVN/NIN',
        };
      }

      return {
        status: KycStatus.PENDING,
        bvnNames,
        ninNames,
        bvnFullName,
        ninFullName,
        bvnIdentityData: this.sanitizeIdentityData(bvn),
        ninIdentityData: this.sanitizeIdentityData(nin),
        rejectionReason: null,
      };
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'BVN/NIN verification failed';

      this.logger.warn(`Customer KYC verification failed: ${message}`);

      return {
        status: KycStatus.REJECTED,
        bvnNames: [] as string[],
        ninNames: [] as string[],
        bvnFullName: null,
        ninFullName: null,
        bvnIdentityData: null,
        ninIdentityData: null,
        rejectionReason: message,
      };
    }
  }

  private sanitizeIdentityData(data: NyraBvnBasicIdentity | NyraNinIdentity): Prisma.InputJsonValue {
    const copy = { ...(data as Record<string, unknown>) };
    delete copy.base64_image;
    delete copy.photo;
    return copy as Prisma.InputJsonValue;
  }

  private formatIdentityName(identity: {
    first_name?: string;
    middle_name?: string;
    last_name?: string;
  }): string {
    return [identity.first_name, identity.middle_name, identity.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private extractBvnNames(identity: NyraBvnBasicIdentity): string[] {
    return normalizeNameTokens(this.formatIdentityName(identity));
  }

  private extractNinNames(identity: NyraNinIdentity): string[] {
    return normalizeNameTokens(this.formatIdentityName(identity));
  }

  private toAdminResponse(record: {
    id: string;
    userId: string;
    bvn: string | null;
    nin: string | null;
    bvnLast4: string;
    ninLast4: string;
    bvnFullName: string | null;
    ninFullName: string | null;
    bvnIdentityData: unknown;
    ninIdentityData: unknown;
    status: KycStatus;
    bvnNames: string[];
    ninNames: string[];
    rejectionReason: string | null;
    adminNote: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    verificationMode: string | null;
    createdAt: Date;
    updatedAt: Date;
    user?: { id: string; email: string; username: string; createdAt?: Date };
  }) {
    return {
      id: record.id,
      userId: record.userId,
      user: record.user,
      bvn: record.bvn,
      nin: record.nin,
      bvnLast4: record.bvnLast4,
      ninLast4: record.ninLast4,
      bvnFullName: record.bvnFullName,
      ninFullName: record.ninFullName,
      bvnIdentityData: record.bvnIdentityData,
      ninIdentityData: record.ninIdentityData,
      status: record.status,
      bvnNames: record.bvnNames,
      ninNames: record.ninNames,
      rejectionReason: record.rejectionReason,
      adminNote: record.adminNote,
      reviewedBy: record.reviewedBy,
      reviewedAt: record.reviewedAt?.toISOString() ?? null,
      verificationMode: record.verificationMode,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
