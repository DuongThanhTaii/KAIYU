import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
    interface AxiosRequestConfig {
        skipAuthRedirect?: boolean;
    }

    interface InternalAxiosRequestConfig {
        skipAuthRedirect?: boolean;
    }
}

// API Base URL - will be replaced in production
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 120000, // 120 seconds (needed for heavy AI Quiz generations)
});

// Token storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Token management
export const tokenManager = {
    getToken: (): string | null => {
        return localStorage.getItem(TOKEN_KEY);
    },

    setToken: (token: string): void => {
        localStorage.setItem(TOKEN_KEY, token);
    },

    removeToken: (): void => {
        localStorage.removeItem(TOKEN_KEY);
    },

    getUser: (): any | null => {
        const userStr = localStorage.getItem(USER_KEY);
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch {
                return null;
            }
        }
        return null;
    },

    setUser: (user: any): void => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    removeUser: (): void => {
        localStorage.removeItem(USER_KEY);
    },

    clearAuth: (): void => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    },
};

// Request interceptor - add auth token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = tokenManager.getToken();
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle errors
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message?: string; error?: string }>) => {
        const shouldSkipAuthRedirect = Boolean(error.config?.skipAuthRedirect);

        // Handle 401 Unauthorized - auto logout
        if (error.response?.status === 401 && !shouldSkipAuthRedirect) {
            tokenManager.clearAuth();

            if (typeof window !== 'undefined') {
                const path = window.location.pathname;
                const search = window.location.search;
                const isAuthRoute = path.startsWith('/login') || path.startsWith('/register');

                // Redirect to login if not already on an auth route.
                if (!isAuthRoute) {
                    const redirectTo = `${path}${search}`;
                    window.location.assign(`/login?redirect=${encodeURIComponent(redirectTo)}`);
                }
            }
        }

        // Extract error message
        const message =
            error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            'An unexpected error occurred';

        // Create custom error
        const customError = new Error(message);
        (customError as any).status = error.response?.status;
        (customError as any).originalError = error;

        return Promise.reject(customError);
    }
);

export default api;
