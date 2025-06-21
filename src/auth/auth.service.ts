import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ResendService } from '../services/resend.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly resendService: ResendService,
  ) {}

  private generateOTP(): string {
    // Generate a 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async requestOTP(email: string) {
    try {
      this.logger.debug(`Requesting OTP for email: ${email}`);

      // Validate email format
      if (!this.resendService.isValidEmail(email)) {
        throw new UnauthorizedException('Invalid email format');
      }

      const otp = this.generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

      // Check if user exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      const isNewUser = !existingUser;

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

      // Send OTP email
      const emailResult = await this.resendService.sendOtpEmail({
        email,
        otp,
        userName: user.username || undefined,
      });

      if (!emailResult.success) {
        this.logger.error(`Failed to send OTP email to ${email}: ${emailResult.error}`);
        throw new UnauthorizedException('Failed to send OTP email');
      }

      this.logger.log(`OTP sent successfully to ${email}. Message ID: ${emailResult.messageId}`);

      // If it's a new user, send welcome email after successful OTP send
      if (isNewUser) {
        try {
          await this.resendService.sendWelcomeEmail({
            email,
            userName: user.username || email.split('@')[0], // Use username or email prefix
          });
          this.logger.log(`Welcome email sent to new user: ${email}`);
        } catch (error) {
          // Don't fail the OTP request if welcome email fails
          this.logger.warn(`Failed to send welcome email to ${email}:`, error);
        }
      }

      return {
        message: 'OTP sent successfully',
        isNewUser,
        // Remove OTP from response in production
        ...(process.env.NODE_ENV === 'development' && { otp }),
      };
    } catch (error) {
      this.logger.error(`Error requesting OTP for ${email}:`, error);
      throw error;
    }
  }

  async verifyOTP(email: string, otp: string) {
    try {
      this.logger.debug(`Verifying OTP for email: ${email}`);

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
      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          otp: null,
          otpExpiry: null,
          isVerified: true,
        },
      });

      this.logger.log(`OTP verified successfully for user: ${email}`);

      return this.generateToken(updatedUser);
    } catch (error) {
      this.logger.error(`Error verifying OTP for ${email}:`, error);
      throw error;
    }
  }

  private generateToken(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    };
  }

  async createGuestToken() {
    const payload = { isGuest: true };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  /**
   * Resend OTP if the previous one expired or wasn't received
   */
  async resendOTP(email: string) {
    this.logger.debug(`Resending OTP for email: ${email}`);
    return this.requestOTP(email);
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updateData: { username?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        isVerified: true,
        createdAt: true,
      },
    });

    return user;
  }
} 