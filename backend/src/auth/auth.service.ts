import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { XpStreakService } from '../xp-streak/xp-streak.service';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  AuthResponseDto,
  UpdateProfileDto,
} from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private xpStreak: XpStreakService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email đã được đăng ký');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        hskLevel: dto.hskLevel || 1,
      },
    });

    // Generate token
    const accessToken = this.generateToken(user.id, user.email, user.role);

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  // Create user when passwordHash is already available (used by OTP flow)
  async createUserWithHash(data: {
    email: string;
    passwordHash: string;
    name: string;
    hskLevel?: number;
  }): Promise<AuthResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('Email đã được đăng ký');
    }

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
        hskLevel: data.hskLevel || 1,
      },
    });

    const accessToken = this.generateToken(user.id, user.email, user.role);

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Email không tồn tại');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Mật khẩu không đúng');
    }

    // Update streak on login (Duolingo style)
    const streakResult = await this.xpStreak.updateStreak(user.id);
    const userWithLatestStreak = {
      ...user,
      streak: streakResult.streak,
    };

    // Generate token
    const accessToken = this.generateToken(user.id, user.email, user.role);

    return {
      accessToken,
      user: this.sanitizeUser(userWithLatestStreak),
    };
  }

  async getProfile(userId: string) {
    await this.xpStreak.updateStreak(userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    return this.sanitizeUser(user);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Mật khẩu đã được thay đổi thành công' };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build update data - only include fields that are provided
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;
    if (dto.dailyGoalMinutes !== undefined)
      updateData.dailyGoalMinutes = dto.dailyGoalMinutes;
    if (dto.hskLevel !== undefined) updateData.hskLevel = dto.hskLevel;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return this.sanitizeUser(updatedUser);
  }

  // Forgot password - generate a reset token
  async forgotPassword(
    email: string,
  ): Promise<{ message: string; resetToken?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return {
        message:
          'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.',
      };
    }

    // Generate a reset token (expires in 1 hour)
    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'reset' },
      { expiresIn: '1h' },
    );

    // In production, send email with reset link
    // For development, log the token
    console.log('='.repeat(60));
    console.log('PASSWORD RESET TOKEN for', user.email);
    console.log('Token:', resetToken);
    console.log(
      'Reset URL: http://localhost:5173/reset-password?token=' + resetToken,
    );
    console.log('='.repeat(60));

    return {
      message:
        'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.',
      // Only return token in development mode for testing
      resetToken:
        process.env.NODE_ENV === 'development' ? resetToken : undefined,
    };
  }

  // Reset password with token
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    try {
      // Verify token
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'reset') {
        throw new UnauthorizedException('Token không hợp lệ');
      }

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new NotFoundException('Người dùng không tồn tại');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      return { message: 'Mật khẩu đã được đặt lại thành công' };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Token đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới.',
        );
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Token không hợp lệ');
      }
      throw error;
    }
  }

  async validateUser(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeUser(user);
  }

  private generateToken(userId: string, email: string, role: string): string {
    return this.jwtService.sign({
      sub: userId,
      email,
      role,
    });
  }

  // Google OAuth login
  async googleLogin(googleUser: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
  }): Promise<{ accessToken: string; user: any; isNewUser: boolean }> {
    // Check if user exists with this email
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });
    const isNewUser = !user;

    if (user) {
      // Update googleId if not set
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleUser.googleId,
            avatarUrl: googleUser.avatarUrl || user.avatarUrl,
          },
        });
      }
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          googleId: googleUser.googleId,
          avatarUrl: googleUser.avatarUrl,
          passwordHash: '', // No password for OAuth users
          authProvider: 'google',
        },
      });
    }

    // Keep streak in sync for first login of the day across OAuth flow as well.
    const streakResult = await this.xpStreak.updateStreak(user.id);
    const userWithLatestStreak = {
      ...user,
      streak: streakResult.streak,
    };

    const accessToken = this.generateToken(user.id, user.email, user.role);

    return {
      accessToken,
      user: this.sanitizeUser(userWithLatestStreak),
      isNewUser,
    };
  }

  private sanitizeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      hskLevel: user.hskLevel,
      streak: user.streak,
      xp: user.xp || 0,
      dailyGoalMinutes: user.dailyGoalMinutes,
      isPremium: user.isPremium,
      role: user.role,
    };
  }
}
