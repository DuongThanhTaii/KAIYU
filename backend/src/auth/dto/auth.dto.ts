import { IsEmail, IsString, MinLength, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'password123', minLength: 6 })
    @IsString()
    @MinLength(6)
    password: string;

    @ApiProperty({ example: 'John Doe' })
    @IsString()
    name: string;

    @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 6 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(6)
    hskLevel?: number;
}

export class LoginDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'password123' })
    @IsString()
    password: string;
}

export class ChangePasswordDto {
    @ApiProperty({ example: 'oldPassword123' })
    @IsString()
    currentPassword: string;

    @ApiProperty({ example: 'newPassword123', minLength: 6 })
    @IsString()
    @MinLength(6)
    newPassword: string;
}

export class AuthResponseDto {
    @ApiProperty()
    accessToken: string;

    @ApiProperty()
    user: {
        id: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        hskLevel: number;
        streak: number;
        dailyGoalMinutes: number;
        isPremium: boolean;
        role: string;
    };
}

export class UpdateProfileDto {
    @ApiPropertyOptional({ example: 'John Doe' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
    @IsOptional()
    @IsString()
    avatarUrl?: string;

    @ApiPropertyOptional({ example: 30 })
    @IsOptional()
    @IsInt()
    @Min(5)
    @Max(120)
    dailyGoalMinutes?: number;

    @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 6 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(6)
    hskLevel?: number;
}

export class ForgotPasswordDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email: string;
}

export class ResetPasswordDto {
    @ApiProperty({ description: 'Reset token from email' })
    @IsString()
    token: string;

    @ApiProperty({ example: 'newPassword123', minLength: 6 })
    @IsString()
    @MinLength(6)
    newPassword: string;
}

