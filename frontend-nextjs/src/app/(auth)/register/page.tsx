'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/common/Icon';
import { useLogo } from '@/hooks/useLogo';

export default function RegisterPage() {
    const router = useRouter();
    const { register, googleLogin, error, clearError, isLoading } = useAuth();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        hskLevel: 1,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { logoUrl } = useLogo();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setFormError(null);
        clearError();
    };

    const validateForm = (): boolean => {
        if (!formData.name.trim()) {
            setFormError('Vui lòng nhập tên của bạn');
            return false;
        }
        if (!formData.email.trim()) {
            setFormError('Vui lòng nhập email');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setFormError('Email không hợp lệ');
            return false;
        }
        if (formData.password.length < 6) {
            setFormError('Mật khẩu phải có ít nhất 6 ký tự');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setFormError('Mật khẩu xác nhận không khớp');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsSubmitting(true);
        try {
            await register({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                hskLevel: Number(formData.hskLevel),
            });
            // Redirect to onboarding or dashboard
            router.push('/onboarding/goals');
        } catch (err) {
            // Error is handled by AuthContext
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleLogin = () => {
        googleLogin();
    };

    const displayError = formError || error;

    return (
        <div className="min-h-screen bg-gradient-to-br from-background-dark via-surface-dark to-background-dark flex items-center justify-center p-4">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 text-[200px] text-primary/5 font-bold select-none">学</div>
                <div className="absolute bottom-20 right-10 text-[200px] text-primary/5 font-bold select-none">習</div>
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2">
                        {logoUrl ? (
                            <div className="h-12 flex items-center">
                                <img src={logoUrl} alt="Logo" className="max-h-full object-contain" />
                            </div>
                        ) : (
                            <>
                                <div className="size-12 rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center">
                                    <span className="text-2xl font-bold text-on-primary">中</span>
                                </div>
                                <span className="text-2xl font-bold text-white">KAIYU</span>
                            </>
                        )}
                    </Link>
                </div>

                {/* Register Card */}
                <div className="bg-surface-dark/80 backdrop-blur-xl rounded-2xl border border-border-color p-8 shadow-2xl">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-white mb-2">Tạo tài khoản</h1>
                        <p className="text-text-secondary">Bắt đầu hành trình học tiếng Trung</p>
                    </div>

                    {/* Error Message */}
                    {displayError && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <p className="text-sm text-red-400">{displayError}</p>
                        </div>
                    )}

                    {/* Register Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Họ và tên
                            </label>
                            <div className="relative">
                                <Icon
                                    name="person"
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
                                />
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Nguyễn Văn A"
                                    className="w-full pl-12 pr-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <Icon
                                    name="mail"
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
                                />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="email@example.com"
                                    className="w-full pl-12 pr-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Mật khẩu
                            </label>
                            <div className="relative">
                                <Icon
                                    name="lock"
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
                                />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Ít nhất 6 ký tự"
                                    className="w-full pl-12 pr-12 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white transition-colors"
                                >
                                    <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Xác nhận mật khẩu
                            </label>
                            <div className="relative">
                                <Icon
                                    name="lock"
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
                                />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Nhập lại mật khẩu"
                                    className="w-full pl-12 pr-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Trình độ HSK hiện tại
                            </label>
                            <select
                                name="hskLevel"
                                value={formData.hskLevel}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white focus:outline-none focus:border-primary transition-colors"
                            >
                                <option value="1">HSK 1 - Người mới bắt đầu</option>
                                <option value="2">HSK 2 - Sơ cấp</option>
                                <option value="3">HSK 3 - Trung cấp</option>
                                <option value="4">HSK 4 - Trung cấp cao</option>
                                <option value="5">HSK 5 - Cao cấp</option>
                                <option value="6">HSK 6 - Thành thạo</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || isLoading}
                            className="w-full py-3 bg-gradient-to-r from-primary to-primary-hover text-on-primary font-bold rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Icon name="sync" className="animate-spin" />
                                    Đang tạo tài khoản...
                                </span>
                            ) : (
                                'Đăng ký'
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-border-color" />
                        <span className="text-sm text-text-secondary">hoặc</span>
                        <div className="flex-1 h-px bg-border-color" />
                    </div>

                    {/* Google Sign In */}
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full py-3 bg-white text-gray-800 font-medium rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-3"
                    >
                        <svg className="size-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Đăng ký với Google
                    </button>

                    {/* Login Link */}
                    <p className="text-center text-text-secondary mt-6">
                        Đã có tài khoản?{' '}
                        <Link href="/login" className="text-primary hover:text-primary-hover font-medium">
                            Đăng nhập
                        </Link>
                    </p>
                </div>

                {/* Terms */}
                <p className="text-center text-xs text-text-secondary mt-4">
                    Bằng việc đăng ký, bạn đồng ý với{' '}
                    <Link href="/terms" className="text-primary hover:underline">Điều khoản dịch vụ</Link>
                    {' '}và{' '}
                    <Link href="/privacy" className="text-primary hover:underline">Chính sách bảo mật</Link>
                </p>
            </div>
        </div>
    );
}
