import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const authCookieName =
      configService.get<string>('AUTH_COOKIE_NAME') || 'access_token';

    const extractJwtFromCookie = (req: { headers?: { cookie?: string } }) => {
      const rawCookie = req?.headers?.cookie;
      if (!rawCookie) return null;

      const parts = rawCookie.split(';');
      for (const part of parts) {
        const [key, ...rest] = part.trim().split('=');
        if (key === authCookieName) {
          const value = rest.join('=');
          return value ? decodeURIComponent(value) : null;
        }
      }
      return null;
    };

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractJwtFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback-secret',
    });
  }

  async validate(payload: JwtPayload) {
    return this.authService.validateUser(payload);
  }
}
