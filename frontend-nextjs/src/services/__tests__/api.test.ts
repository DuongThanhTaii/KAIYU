import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { tokenManager } from '../api';

describe('API Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.getItem = vi.fn();
        localStorage.setItem = vi.fn();
        localStorage.removeItem = vi.fn();
    });

    describe('tokenManager', () => {
        it('should get token from localStorage', () => {
            const mockToken = 'test-token-123';
            (localStorage.getItem as any).mockReturnValue(mockToken);

            const token = tokenManager.getToken();

            expect(localStorage.getItem).toHaveBeenCalledWith('auth_token');
            expect(token).toBe(mockToken);
        });

        it('should set token to localStorage', () => {
            const mockToken = 'new-token-456';

            tokenManager.setToken(mockToken);

            expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', mockToken);
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
    it('should export axios instance as default', () => {
        expect(api).toBeDefined();
        expect(api.defaults).toBeDefined();
    });

    it('should have correct default headers', () => {
        expect(api.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('should have 30 second timeout', () => {
        expect(api.defaults.timeout).toBe(30000);
    });
});
