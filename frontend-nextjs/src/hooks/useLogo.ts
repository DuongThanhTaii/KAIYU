import { useState, useEffect, useCallback } from 'react';
import { getLogoUrl } from '@/services/emailApi';

// Simple global cache to prevent waterfall requests across different components mounted at the same time
let globalLogoUrl: string | null = null;
let globalLogoPromise: Promise<{ url: string | null }> | null = null;

export function useLogo() {
    const [logoUrl, setLogoUrl] = useState<string | null>(globalLogoUrl);
    const [loading, setLoading] = useState<boolean>(!globalLogoUrl);

    const fetchLogo = useCallback(async () => {
        if (globalLogoUrl) {
            setLogoUrl(globalLogoUrl);
            setLoading(false);
            return;
        }

        if (!globalLogoPromise) {
            globalLogoPromise = getLogoUrl().catch(err => {
                console.warn('Failed to fetch logo for layout:', err);
                return { url: null };
            });
        }

        try {
            const data = await globalLogoPromise;
            globalLogoUrl = data.url;
            setLogoUrl(data.url);
        } catch {
            // Error already caught in promise creator
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogo();
    }, [fetchLogo]);

    return {
        logoUrl: logoUrl ? `${process.env.NEXT_PUBLIC_API_URL}${logoUrl}` : null,
        loading
    };
}
