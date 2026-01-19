'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

/**
 * ProtectedRoute - Requires authentication
 * Redirects to /login if user is not authenticated
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace('/login');
        }
    }, [isLoading, isAuthenticated, router]);

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-text-secondary">Đang tải...</p>
                </div>
            </div>
        );
    }

    // Don't render children if not authenticated
    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
};

interface AdminRouteProps {
    children: React.ReactNode;
}

/**
 * AdminRoute - Requires admin role
 * Redirects to /dashboard if user is not admin
 */
export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                router.replace('/login');
            } else if (user?.role !== 'admin') {
                router.replace('/dashboard');
            }
        }
    }, [isLoading, isAuthenticated, user, router]);

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-text-secondary">Đang tải...</p>
                </div>
            </div>
        );
    }

    // Don't render if not authenticated or not admin
    if (!isAuthenticated || user?.role !== 'admin') {
        return null;
    }

    return <>{children}</>;
};

interface GuestRouteProps {
    children: React.ReactNode;
}

/**
 * GuestRoute - Only for non-authenticated users
 * Redirects to /dashboard if user is already logged in
 */
export const GuestRoute: React.FC<GuestRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            router.replace('/dashboard');
        }
    }, [isLoading, isAuthenticated, router]);

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-text-secondary">Đang tải...</p>
                </div>
            </div>
        );
    }

    // Don't render if authenticated
    if (isAuthenticated) {
        return null;
    }

    return <>{children}</>;
};

