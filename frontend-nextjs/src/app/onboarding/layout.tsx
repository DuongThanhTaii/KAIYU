'use client';

import { AuthProvider } from '@/contexts/AuthContext';

export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AuthProvider>{children}</AuthProvider>;
}
