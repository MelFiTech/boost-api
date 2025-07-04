import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ResendService } from '../services/resend.service';
import { GeminiService } from '../services/gemini.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly resendService: ResendService,
    private readonly geminiService: GeminiService,
  ) {}

  private generateOTP(): string {
    // Generate a 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async generateUniqueUsername(email: string): Promise<string> {
    let username = await this.geminiService.generateUsername(email);
    let attempts = 0;
    const maxAttempts = 5;

    // Check if username is unique, if not, modify it
    while (attempts < maxAttempts) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username },
      });

      if (!existingUser) {
        return username;
      }

      // Add random suffix to make it unique
      const randomSuffix = Math.random().toString(36).substring(2, 4);
      username = username.length > 17 
        ? username.substring(0, 17) + randomSuffix 
        : username + randomSuffix;
      
      attempts++;
    }

    // If still not unique after max attempts, use timestamp
    const timestamp = Date.now().toString().slice(-4);
    username = username.substring(0, 16) + timestamp;
    
    return username;
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

      // Generate username for new users
      let username: string | undefined;
      if (isNewUser) {
        try {
          username = await this.generateUniqueUsername(email);
          this.logger.log(`Generated username: ${username} for new user: ${email}`);
        } catch (error) {
          this.logger.warn(`Failed to generate username for ${email}, will create without username:`, error);
        }
      }

      // Create or update user with new OTP
      const user = await this.prisma.user.upsert({
        where: { email },
        update: {
          otp,
          otpExpiry,
        },
        create: {
          email,
          username,
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

  async adminLogin(email: string, password: string) {
    try {
      this.logger.debug(`Admin login attempt for email: ${email}`);

      // Hardcoded admin credentials
      const ADMIN_EMAIL = 'admin@boost.com';
      const ADMIN_PASSWORD = 'Boost2025';

      if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        throw new UnauthorizedException('Invalid admin credentials');
      }

      // Generate admin token with admin role
      const payload = { 
        email: ADMIN_EMAIL, 
        sub: 'admin', 
        role: 'admin',
        isAdmin: true 
      };

      this.logger.log(`Admin login successful for: ${email}`);

      return {
        access_token: this.jwtService.sign(payload),
        admin: {
          id: 'admin',
          email: ADMIN_EMAIL,
          role: 'admin',
          loginAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Admin login failed for ${email}:`, error);
      throw error;
    }
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