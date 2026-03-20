'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import { getProgress, type RecentProgress } from '@/services/progressStorage';

function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login, googleLogin, error, clearError, isLoading } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [savedProgress, setSavedProgress] = useState<RecentProgress | null>(null);


    // Get redirect path
    const from = searchParams.get('from') || '/dashboard';

    // Load saved progress from localStorage
    useEffect(() => {
        const progress = getProgress();
        setSavedProgress(progress);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        clearError();

        if (!email.trim()) {
            setFormError('Vui lòng nhập email');
            return;
        }
        if (!password.trim()) {
            setFormError('Vui lòng nhập mật khẩu');
            return;
        }

        setIsSubmitting(true);
        try {
            await login({ email, password });
            router.push(from);
        } catch {
            // Error is handled by AuthContext
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleLogin = () => {
        googleLogin();
    };

    const displayError = formError || error;

    // Get display values from saved progress or defaults
    const displayHsk = savedProgress?.hskLevel ?? 1;
    const displayVocabPercent = savedProgress?.vocabPercent ?? 0;
    const displayStreak = savedProgress?.streak ?? 0;
    const hasProgress = savedProgress !== null;

    return (
        <div className="bg-[var(--color-background-dark)] text-text-base font-display min-h-screen flex flex-col overflow-x-hidden selection:bg-primary selection:text-on-primary transition-colors duration-300">
            {/* Navigation */}
            <header className="flex items-center justify-between px-6 lg:px-10 py-4 border-b border-border-color bg-[var(--color-background-dark)]/80 backdrop-blur-md sticky top-0 z-50">
                <Link href="/" className="flex items-center gap-3">
                    <div className="size-9 flex items-center justify-center shrink-0">
                        <Image src="/images/logo_nentrang.png" alt="KAIYU Logo" width={36} height={36} className="object-contain rounded-full" />
                    </div>
                    <div className="hidden sm:flex flex-col leading-none">
                        <span className="font-extrabold text-lg tracking-widest text-text-base uppercase">KAIYU</span>
                        <span className="text-[8px] font-semibold tracking-[0.18em] text-text-secondary uppercase">CHINESE LANGUAGE SYSTEM</span>
                    </div>
                </Link>
                <div className="flex items-center gap-4">
                    <span className="hidden sm:block text-sm font-medium text-text-secondary">Chưa có tài khoản?</span>
                    <Link href="/register">
                        <Button variant="outline" size="sm">
                            Đăng ký
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Main Layout */}
            <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
                <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                    {/* Left Panel: Visual/Decorative */}
                    <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between overflow-hidden rounded-2xl bg-surface-dark border border-border-color p-8 group">
                        {/* Background texture */}
                        <div
                            className="absolute inset-0 z-0 transition-all duration-300 pointer-events-none"
                            style={{
                                backgroundImage: `url('/images/texture-pattern.png')`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                filter: 'var(--texture-filter)',
                                mixBlendMode: 'var(--texture-mix-blend)' as any,
                                opacity: 'var(--texture-opacity)' as any
                            }}
                        />

                        {/* Content */}
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="space-y-6">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 backdrop-blur-md border border-primary/20 w-fit">
                                    <Icon name="local_fire_department" className="text-primary" size="sm" />
                                    <span className="text-xs font-bold text-text-base uppercase tracking-wider">
                                        {hasProgress ? `Day ${displayStreak} Streak` : 'Bắt đầu ngay'}
                                    </span>
                                </div>
                                <div>
                                    <h1 className="text-4xl font-black text-text-base leading-tight tracking-tight mb-2">
                                        Học tiếng Trung <br /> <span className="text-primary">Tự nhiên.</span>
                                    </h1>
                                    <p className="text-text-secondary text-lg">
                                        {hasProgress
                                            ? 'Chào mừng trở lại! Tiếp tục hành trình của bạn.'
                                            : 'Tham gia cùng 10,000+ học viên chinh phục tiếng Trung.'
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Progress Card */}
                            <div className="mt-8 bg-surface-dark/80 backdrop-blur-sm p-4 rounded-xl border border-border-color shadow-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-text-secondary uppercase">
                                        {hasProgress ? 'Tiến độ gần đây' : 'Mục tiêu'}
                                    </span>
                                    <span className="text-xs font-bold text-primary">HSK {displayHsk}</span>
                                </div>
                                <div className="h-2 w-full bg-[var(--color-background-dark)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(32,167,223,0.5)] transition-all duration-500"
                                        style={{ width: `${displayVocabPercent}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between mt-2 text-xs text-text-base">
                                    <span>Từ vựng</span>
                                    <span>{displayVocabPercent}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Login Form */}
                    <div className="col-span-1 lg:col-span-7 bg-[var(--color-background-dark)] rounded-2xl border border-border-color p-6 md:p-10 lg:p-12 shadow-2xl relative overflow-hidden">
                        {/* Gradient Glow */}
                        <div className="absolute top-[-50%] right-[-10%] w-[300px] h-[300px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

                        <div className="relative z-10 max-w-md mx-auto flex flex-col h-full justify-center">
                            {/* Header */}
                            <div className="mb-10">
                                <p className="text-3xl md:text-4xl font-black text-text-base leading-tight tracking-[-0.02em] mb-2">
                                    Chào mừng trở lại
                                </p>
                                <p className="text-text-secondary text-base">Đăng nhập để tiếp tục hành trình.</p>
                            </div>

                            {/* Error Message */}
                            {displayError && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                    <p className="text-sm text-red-400">{displayError}</p>
                                </div>
                            )}

                            {/* Form */}
                            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                                {/* Email Field */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-text-base ml-2" htmlFor="email">
                                        Email
                                    </label>
                                    <div className="relative group/input">
                                        <input
                                            type="email"
                                            id="email"
                                            className="w-full h-14 pl-5 pr-12 bg-surface-dark border border-border-color rounded-xl text-text-base placeholder-text-secondary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                                            placeholder="name@example.com"
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                setFormError(null);
                                                clearError();
                                            }}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none group-focus-within/input:text-primary transition-colors flex items-center justify-center">
                                            <Icon name="mail" size="md" />
                                        </span>
                                    </div>
                                </div>

                                {/* Password Field */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center ml-2">
                                        <label className="block text-sm font-bold text-text-base" htmlFor="password">
                                            Mật khẩu
                                        </label>
                                        <Link href="/forgot-password" className="text-sm font-bold text-primary hover:underline transition-colors">
                                            Quên mật khẩu?
                                        </Link>
                                    </div>
                                    <div className="relative group/input">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            id="password"
                                            className="w-full h-14 pl-5 pr-12 bg-surface-dark border border-border-color rounded-xl text-text-base placeholder-text-secondary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                                            placeholder="Nhập mật khẩu"
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value);
                                                setFormError(null);
                                                clearError();
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-base transition-colors flex items-center justify-center"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            <Icon name={showPassword ? 'visibility_off' : 'visibility'} size="md" />
                                        </button>
                                    </div>
                                </div>

                                {/* Login Button */}
                                <Button
                                    type="submit"
                                    variant="primary"
                                    fullWidth
                                    size="lg"
                                    className="mt-2"
                                    disabled={isSubmitting || isLoading}
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Icon name="sync" className="animate-spin" />
                                            Đang đăng nhập...
                                        </span>
                                    ) : (
                                        'Đăng nhập'
                                    )}
                                </Button>
                            </form>

                            {/* Divider */}
                            <div className="relative flex py-8 items-center">
                                <div className="flex-grow border-t border-border-color"></div>
                                <span className="flex-shrink-0 mx-4 text-text-secondary text-sm">Hoặc</span>
                                <div className="flex-grow border-t border-border-color"></div>
                            </div>

                            {/* Social Login */}
                            <button
                                onClick={handleGoogleLogin}
                                className="flex items-center justify-center gap-3 h-12 rounded-full border border-border-color bg-surface-dark hover:bg-surface-highlight text-text-base transition-all w-full"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                                    <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4" />
                                    <path d="M12.24 24.0008C15.4765 24.0008 18.2058 22.9382 20.1945 21.1039L16.3275 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.24 24.0008Z" fill="#34A853" />
                                    <path d="M5.50253 14.3003C5.00236 12.8099 5.00236 11.1961 5.50253 9.70575V6.61481H1.5166C-0.18551 10.0056 -0.18551 14.0004 1.5166 17.3912L5.50253 14.3003Z" fill="#FBBC05" />
                                    <path d="M12.24 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.24 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50253 9.70575C6.45064 6.86173 9.10947 4.74966 12.24 4.74966Z" fill="#EA4335" />
                                </svg>
                                <span className="text-sm font-bold">Đăng nhập với Google</span>
                            </button>

                            {/* Footer */}
                            <div className="mt-8 text-center">
                                <p className="text-text-secondary text-sm">
                                    Chưa có tài khoản?
                                    <Link href="/register" className="font-bold text-primary hover:underline ml-1">
                                        Đăng ký ngay
                                    </Link>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="text-center py-6 text-text-secondary text-xs opacity-50">
                © 2025 Duong Thanh Tai. All rights reserved.
            </footer>
        </div>
    );
}

// Loading fallback for Suspense
function LoginPageLoading() {
    return (
        <div className="bg-[var(--color-background-dark)] text-text-base font-display min-h-screen flex items-center justify-center">
            <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<LoginPageLoading />}>
            <LoginPageContent />
        </Suspense>
    );
}
