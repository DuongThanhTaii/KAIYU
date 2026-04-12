import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { tokenManager } from '../api';

const getResponseRejectedHandler = () => {
    const handlers = (api.interceptors.response as any).handlers as Array<{ rejected?: (error: any) => Promise<never> }>;
    const rejected = [...(handlers || [])].reverse().find((h) => typeof h?.rejected === 'function')?.rejected;

    if (!rejected) {
        throw new Error('Response rejected interceptor not found');
    }

    return rejected;
};

describe('API Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.getItem = vi.fn();
        localStorage.setItem = vi.fn();
        localStorage.removeItem = vi.fn();
    });

    describe('tokenManager', () => {
        it('should not persist access token in localStorage', () => {
            const token = tokenManager.getToken();

            expect(localStorage.getItem).not.toHaveBeenCalledWith('auth_token');
            expect(token).toBeNull();
        });

        it('should ignore setToken calls (cookie-based auth)', () => {
            const mockToken = 'new-token-456';

            tokenManager.setToken(mockToken);

            expect(localStorage.setItem).not.toHaveBeenCalledWith('auth_token', mockToken);
        });

        it('should remove token from localStorage', () => {
            tokenManager.removeToken();

            expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
        });

        it('should clear all auth data', () => {
            tokenManager.clearAuth();

            expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
            expect(localStorage.removeItem).toHaveBeenCalledWith('auth_user');
        });

        it('should parse user from localStorage', () => {
            const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' };
            (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockUser));

            const user = tokenManager.getUser();

            expect(user).toEqual(mockUser);
        });

        it('should return null for invalid user JSON', () => {
            (localStorage.getItem as any).mockReturnValue('invalid-json');

            const user = tokenManager.getUser();

            expect(user).toBeNull();
        });
    });
});

describe('Axios Instance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.getItem = vi.fn();
        localStorage.setItem = vi.fn();
        localStorage.removeItem = vi.fn();
    });

    it('should export axios instance as default', () => {
        expect(api).toBeDefined();
        expect(api.defaults).toBeDefined();
    });

    it('should have correct default headers', () => {
        expect(api.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('should have 120 second timeout', () => {
        expect(api.defaults.timeout).toBe(120000);
    });

    it('should clear auth on normal 401 response', async () => {
        const rejected = getResponseRejectedHandler();

        await expect(
            rejected({
                response: { status: 401, data: { message: 'Unauthorized' } },
                config: {},
                message: 'Unauthorized',
            })
        ).rejects.toBeInstanceOf(Error);

        expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
        expect(localStorage.removeItem).toHaveBeenCalledWith('auth_user');
    });

    it('should not clear auth on 401 when skipAuthRedirect is true', async () => {
        const rejected = getResponseRejectedHandler();

        await expect(
            rejected({
                response: { status: 401, data: { message: 'Unauthorized' } },
                config: { skipAuthRedirect: true },
                message: 'Unauthorized',
            })
        ).rejects.toBeInstanceOf(Error);

        expect(localStorage.removeItem).not.toHaveBeenCalled();
    });
});
