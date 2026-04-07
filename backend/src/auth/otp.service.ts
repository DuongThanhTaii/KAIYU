import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';

interface PendingRegistration {
  email: string;
  otpHash: string;
  createdAt: number;
  attempts: number;
  payload: any;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private OTP_TTL = Number(process.env.OTP_TTL_SECONDS || 300);
  private OTP_DIGITS = Number(process.env.OTP_DIGITS || 6);

  constructor(private readonly redis: RedisService) {}

  private generateOtp(): string {
    const max = 10 ** this.OTP_DIGITS;
    const n = Math.floor(Math.random() * max)
      .toString()
      .padStart(this.OTP_DIGITS, '0');
    return n;
  }

  private async sendEmail(to: string, otp: string) {
    try {
      const host = process.env.SMTP_HOST;
      if (!host) {
        this.logger.warn('No SMTP_HOST configured — skipping email send (dev)');
        return;
      }
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Boolean(process.env.SMTP_SECURE === 'true'),
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@example.com',
        to,
        subject: 'Mã xác thực đăng ký KAIYU',
        text: `Mã xác thực của bạn là: ${otp}. Mã có hiệu lực trong ${this.OTP_TTL} giây.`,
        html: `<p>Mã xác thực của bạn là: <strong>${otp}</strong></p><p>Mã có hiệu lực trong ${this.OTP_TTL} giây.</p>`,
      });
    } catch (err) {
      this.logger.error('Failed to send OTP email', err as any);
    }
  }

  async createRegistrationRequest(payload: any) {
    const id = randomUUID();
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const key = `otp:reg:${id}`;
    // Do not store plaintext password. If a password is provided, hash it
    // and store as `passwordHash` in the payload before persisting.
    const storedPayload = { ...payload };
    if (storedPayload.password) {
      const pwdHash = await bcrypt.hash(storedPayload.password, 10);
      storedPayload.passwordHash = pwdHash;
      delete storedPayload.password;
    }

    const value: PendingRegistration = {
      email: storedPayload.email,
      otpHash,
      createdAt: Date.now(),
      attempts: 0,
      payload: storedPayload,
    };

    await this.redis.set(key, JSON.stringify(value), this.OTP_TTL);
    // send email (best-effort)
    await this.sendEmail(payload.email, otp);
    return { registrationRequestId: id };
  }

  async verifyRegistration(registrationRequestId: string, otp: string) {
    const key = `otp:reg:${registrationRequestId}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new Error('OTP expired or invalid');
    }
    const data: PendingRegistration = JSON.parse(raw);
    if (data.attempts >= Number(process.env.OTP_ATTEMPT_LIMIT || 5)) {
      await this.redis.del(key);
      throw new Error('OTP attempt limit exceeded');
    }

    const ok = await bcrypt.compare(otp, data.otpHash);
    if (!ok) {
      data.attempts = (data.attempts || 0) + 1;
      await this.redis.set(key, JSON.stringify(data), this.OTP_TTL);
      const remaining =
        Number(process.env.OTP_ATTEMPT_LIMIT || 5) - data.attempts;
      throw new Error(`Invalid OTP. Remaining attempts: ${remaining}`);
    }

    // success: return payload and cleanup
    await this.redis.del(key);
    return data.payload;
  }

  async resendRegistrationOtp(registrationRequestId: string) {
    const key = `otp:reg:${registrationRequestId}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new Error('Registration request not found');
    const data: PendingRegistration = JSON.parse(raw);
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    data.otpHash = otpHash;
    data.attempts = 0;
    data.createdAt = Date.now();
    await this.redis.set(key, JSON.stringify(data), this.OTP_TTL);
    await this.sendEmail(data.email, otp);
    return { message: 'OTP resent' };
  }
}

export default OtpService;
