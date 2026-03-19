import { useState, useEffect, useCallback } from 'react';
import { getLogoUrl } from '@/services/emailApi';

// Simple global cache to prevent waterfall requests across different components mounted at the same time
let globalLogoUrl: string | null = null;
let globalLogoPromise: Promise<{ url: string | null }> | null = null;

export function useLogo() {
    return {
        logoUrl: '/images/logo_nentrang.png',
        logoWhite: '/images/logo_nentrang.png',
        logoTransparent: '/images/logo_xoanen.png',
        loading: false
    };
}
