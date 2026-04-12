import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

declare module "axios" {
  interface AxiosRequestConfig {
    skipAuthRedirect?: boolean;
  }

  interface InternalAxiosRequestConfig {
    skipAuthRedirect?: boolean;
  }
}

// API Base URL - will be replaced in production
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 120000, // 120 seconds (needed for heavy AI Quiz generations)
});

// Token storage keys
const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

interface StoredUser {
  id: string;
  email: string;
  name: string;
}

export interface ApiClientError extends Error {
  status?: number;
  originalError?: unknown;
}

// Token management
export const tokenManager = {
  getToken: (): string | null => {
    return null;
  },

  setToken: (_token: string): void => {
    // Access token is now managed in HttpOnly cookie by backend.
  },

  removeToken: (): void => {
    localStorage.removeItem(TOKEN_KEY);
  },

  getUser: (): StoredUser | null => {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr) as StoredUser;
      } catch {
        return null;
      }
    }
    return null;
  },

  setUser: (user: StoredUser): void => {
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

api.interceptors.request.use((config: InternalAxiosRequestConfig) => config);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; error?: string }>) => {
    const shouldSkipAuthRedirect = Boolean(error.config?.skipAuthRedirect);

    if (error.response?.status === 401 && !shouldSkipAuthRedirect) {
      tokenManager.clearAuth();

      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        const search = window.location.search;
        const isAuthRoute =
          path.startsWith("/login") || path.startsWith("/register");

        // Redirect to login if not already on an auth route.
        if (!isAuthRoute) {
          const redirectTo = `${path}${search}`;
          window.location.assign(
            `/login?redirect=${encodeURIComponent(redirectTo)}`,
          );
        }
      }
    }

    // Extract error message
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "An unexpected error occurred";

    // Create custom error
    const customError = new Error(message);
    const typedError = customError as ApiClientError;
    typedError.status = error.response?.status;
    typedError.originalError = error;

    return Promise.reject(typedError);
  },
);

export default api;
