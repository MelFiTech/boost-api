import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private generateOTP(): string {
    // Generate a 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async requestOTP(email: string) {
    const otp = this.generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Create or update user with new OTP
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        otp,
        otpExpiry,
      },
      create: {
        email,
        otp,
        otpExpiry,
      },
    });

    // TODO: Send OTP via email
    // For development, return OTP in response
    return {
      message: 'OTP sent successfully',
      otp, // Remove this in production
    };
  }

  async verifyOTP(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.otp || !user.otpExpiry) {
      throw new UnauthorizedException('No OTP requested');
    }

    if (user.otpExpiry < new Date()) {
      throw new UnauthorizedException('OTP expired');
    }

    if (user.otp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Clear OTP and mark as verified
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otp: null,
        otpExpiry: null,
        isVerified: true,
      },
    });

    return this.generateToken(user);
  }

  private generateToken(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        isVerified: user.isVerified,
      },
    };
  }

  async createGuestToken() {
    const payload = { isGuest: true };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
} 