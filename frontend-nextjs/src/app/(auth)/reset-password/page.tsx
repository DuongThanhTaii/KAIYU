'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import LandingNavbar from '@/components/layout/LandingNavbar';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import Card from '@/components/common/Card';
import { authApi } from '@/services/authApi';

function ResetPasswordPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('Token không hợp lệ. Vui lòng yêu cầu đặt lại mật khẩu mới.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }

        // Validate password length
        if (newPassword.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }

        if (!token) {
            setError('Token không hợp lệ');
            return;
        }

        setIsLoading(true);

        try {
            await authApi.resetPassword(token, newPassword);
            setIsSuccess(true);
        } catch (err: unknown) {
            const errorObj = err as { response?: { data?: { message?: string } } };
            setError(errorObj.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-background-dark text-white font-display min-h-screen">
            <LandingNavbar />

            <div className="flex items-center justify-center min-h-screen px-4 py-20">
                <Card variant="elevated" padding="lg" className="w-full max-w-md">
                    {!isSuccess ? (
                        <>
                            {/* Header */}
                            <div className="text-center mb-8">
                                <div className="size-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Icon name="password" className="text-primary text-3xl" />
                                </div>
                                <h1 className="text-2xl font-black mb-2">Đặt lại mật khẩu</h1>
                                <p className="text-text-secondary">
                                    Nhập mật khẩu mới cho tài khoản của bạn.
                                </p>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            {/* Form */}
                            {token ? (
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-2">
                                            Mật khẩu mới
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full px-4 py-3 pr-12 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
                                                placeholder="Ít nhất 6 ký tự"
                                                required
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white transition-colors"
                                            >
                                                <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-2">
                                            Xác nhận mật khẩu
                                        </label>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
                                            placeholder="Nhập lại mật khẩu"
                                            required
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        fullWidth
                                        size="lg"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
                                    </Button>
                                </form>
                            ) : (
                                <div className="text-center">
                                    <Link href="/forgot-password">
                                        <Button variant="primary" fullWidth>
                                            Yêu cầu đặt lại mật khẩu
                                        </Button>
                                    </Link>
                                </div>
                            )}

                            {/* Back to login */}
                            <div className="text-center mt-6">
                                <Link
                                    href="/login"
                                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    <Icon name="arrow_back" size="sm" />
                                    Quay lại đăng nhập
                                </Link>
                            </div>
                        </>
                    ) : (
                        /* Success State */
                        <div className="text-center py-6">
                            <div className="size-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Icon name="check_circle" className="text-green-400 text-4xl" />
                            </div>
                            <h2 className="text-2xl font-bold mb-3">Thành công!</h2>
                            <p className="text-text-secondary mb-8">
                                Mật khẩu của bạn đã được đặt lại. Bạn có thể đăng nhập bằng mật khẩu mới.
                            </p>
                            <Button
                                variant="primary"
                                fullWidth
                                onClick={() => router.push('/login')}
                            >
                                Đăng nhập
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

// Loading fallback for Suspense
function ResetPasswordPageLoading() {
    return (
        <div className="bg-background-dark text-white font-display min-h-screen flex items-center justify-center">
            <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<ResetPasswordPageLoading />}>
            <ResetPasswordPageContent />
        </Suspense>
    );
}
