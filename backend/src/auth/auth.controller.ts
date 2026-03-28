import { Controller, Post, Body, Get, Put, UseGuards, HttpCode, HttpStatus, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ChangePasswordDto, AuthResponseDto, UpdateProfileDto, ForgotPasswordDto, ResetPasswordDto } from './dto';
import { CurrentUser } from './decorators';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) { }

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDto })
    @ApiResponse({ status: 409, description: 'Email already registered' })
    async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
        return this.authService.register(dto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with email and password' })
    @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
        return this.authService.login(dto);
    }

    @Get('me')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'User profile' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getProfile(@CurrentUser() user: any) {
        return this.authService.getProfile(user.id);
    }

    @Put('profile')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update user profile' })
    @ApiResponse({ status: 200, description: 'Profile updated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async updateProfile(
        @CurrentUser() user: any,
        @Body() dto: UpdateProfileDto,
    ) {
        return this.authService.updateProfile(user.id, dto);
    }

    @Put('password')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Change password' })
    @ApiResponse({ status: 200, description: 'Password changed successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized or incorrect current password' })
    async changePassword(
        @CurrentUser() user: any,
        @Body() dto: ChangePasswordDto,
    ): Promise<{ message: string }> {
        return this.authService.changePassword(user.id, dto);
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Request password reset email' })
    @ApiResponse({ status: 200, description: 'Reset instructions sent if email exists' })
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
    async googleAuthCallback(@Req() req: any, @Res() res: any) {
        // Get the auth result from the request (set by GoogleStrategy)
        const { accessToken, user, isNewUser } = req.user;

        // Get frontend URLs from config
        const frontendUrlConfig = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
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
        res.redirect(`${frontendUrl}${redirectPath}?token=${accessToken}&user=${userJson}`);
    }
}

