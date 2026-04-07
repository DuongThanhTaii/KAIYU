import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Header,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  AuthResponseDto,
  UpdateProfileDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import { CurrentUser } from './decorators';

type AuthenticatedUser = {
  id: string;
};

type GoogleCallbackRequest = Request & {
  user: {
    accessToken: string;
    user: unknown;
    isNewUser: boolean;
  };
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto): Promise<any> {
    // Feature-flag: enable OTP-based email registration when
    // `ENABLE_OTP_REGISTRATION` is set to 'true'. Otherwise use legacy flow.
    const enableOtp = process.env.ENABLE_OTP_REGISTRATION === 'true';
    if (!enableOtp) {
      return this.authService.register(dto);
    }

    // Create OTP registration request (will send OTP email).
    return this.otpService.createRegistrationRequest(dto);
  }

  @Post('register/verify')
  @ApiOperation({ summary: 'Verify OTP and finalize registration' })
  @ApiResponse({
    status: 200,
    description: 'Registration verified',
    type: AuthResponseDto,
  })
  async verifyRegistration(
    @Body() body: { registrationRequestId: string; otp: string },
  ): Promise<AuthResponseDto> {
    const payload = await this.otpService.verifyRegistration(
      body.registrationRequestId,
      body.otp,
    );

    // Expect payload to contain email, passwordHash (hashed), name, hskLevel
    const res = await this.authService.createUserWithHash({
      email: payload.email,
      passwordHash: payload.passwordHash,
      name: payload.name,
      hskLevel: payload.hskLevel,
    });

    return res;
  }

  @Post('register/resend')
  @ApiOperation({ summary: 'Resend OTP for registration request' })
  async resendRegistrationOtp(@Body() body: { registrationRequestId: string }) {
    return this.otpService.resendRegistrationOtp(body.registrationRequestId);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }

  @Put('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Put('password')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized or incorrect current password',
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({
    status: 200,
    description: 'Reset instructions sent if email exists',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // Google OAuth routes
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleAuth() {
    // This route initiates the Google OAuth flow
    // The actual redirect is handled by Passport
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(
    @Req() req: GoogleCallbackRequest,
    @Res() res: Response,
  ) {
    // Get the auth result from the request (set by GoogleStrategy)
    const { accessToken, user, isNewUser } = req.user;

    // Get frontend URLs from config
    const frontendUrlConfig =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const frontendUrls = frontendUrlConfig.split(',');

    // Try to determine which frontend the user came from
    // If not possible, default to the first one (or the new one if you prefer)
    let frontendUrl = frontendUrls[0];

    // If we want to prioritize the new domain for all redirects:
    if (frontendUrls.length > 1) {
      frontendUrl = frontendUrls[frontendUrls.length - 1]; // Pick the new domain
    }

    // Redirect to onboarding for brand-new Google users to match email register flow.
    const redirectPath = isNewUser ? '/onboarding/goals' : '/dashboard';

    // Redirect to frontend with token and user info
    const userJson = encodeURIComponent(JSON.stringify(user));
    res.redirect(
      `${frontendUrl}${redirectPath}?token=${accessToken}&user=${userJson}`,
    );
  }
}
