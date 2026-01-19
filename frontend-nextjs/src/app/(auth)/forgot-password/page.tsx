'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import LandingNavbar from '@/components/layout/LandingNavbar';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import Card from '@/components/common/Card';
import { authApi } from '@/services/authApi';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await authApi.forgotPassword(email);
            setIsSubmitted(true);
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
                    {!isSubmitted ? (
                        <>
                            {/* Header */}
                            <div className="text-center mb-8">
                                <div className="size-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Icon name="lock_reset" className="text-primary text-3xl" />
                                </div>
                                <h1 className="text-2xl font-black mb-2">Quên mật khẩu?</h1>
                                <p className="text-text-secondary">
                                    Nhập email của bạn và chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.
                                </p>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-2">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
                                        placeholder="email@example.com"
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
                                    {isLoading ? 'Đang gửi...' : 'Gửi hướng dẫn'}
                                </Button>
                            </form>

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
                                <Icon name="mark_email_read" className="text-green-400 text-4xl" />
                            </div>
                            <h2 className="text-2xl font-bold mb-3">Kiểm tra email!</h2>
                            <p className="text-text-secondary mb-6">
                                Nếu email <strong className="text-white">{email}</strong> tồn tại trong hệ thống,
                                bạn sẽ nhận được email hướng dẫn đặt lại mật khẩu.
                            </p>
                            <p className="text-sm text-text-secondary mb-8">
                                Không nhận được email? Kiểm tra thư mục spam hoặc
                                <button
                                    onClick={() => setIsSubmitted(false)}
                                    className="text-primary hover:underline ml-1"
                                >
                                    thử lại
                                </button>
                            </p>
                            <Link href="/login">
                                <Button variant="outline" fullWidth>
                                    Quay lại đăng nhập
                                </Button>
                            </Link>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
