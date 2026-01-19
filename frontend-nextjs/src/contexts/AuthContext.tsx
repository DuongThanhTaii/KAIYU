"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi, type User, type LoginData, type RegisterData, type AuthResponse, type UpdateProfileData } from '../services/authApi';
import { tokenManager } from '../services/api';

// Context types
interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    login: (data: LoginData) => Promise<AuthResponse>;
    register: (data: RegisterData) => Promise<AuthResponse>;
    logout: () => void;
    googleLogin: () => void;
    refreshProfile: () => Promise<void>;
    updateProfile: (data: UpdateProfileData) => Promise<User>;
    clearError: () => void;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider props
interface AuthProviderProps {
    children: ReactNode;
}

// Auth Provider Component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Check for existing auth on mount
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // Check for Google OAuth callback parameters
                const urlParams = new URLSearchParams(window.location.search);
                const token = urlParams.get('token');
                const userParam = urlParams.get('user');

                if (token && userParam) {
                    // Handle Google OAuth callback
                    const result = authApi.handleGoogleCallback(token, userParam);
                    if (result) {
                        setUser(result.user);
                        // Clean URL
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                    setIsLoading(false);
                    return;
                }

                // Check for existing token
                const existingToken = tokenManager.getToken();
                if (existingToken) {
                    // Try to get fresh profile
                    try {
                        const profile = await authApi.getProfile();
                        setUser(profile);
                    } catch {
                        // Token invalid, clear it
                        tokenManager.clearAuth();
                    }
                }
            } catch (err) {
                console.error('Auth initialization error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();
    }, []);

    // Login
    const login = useCallback(async (data: LoginData): Promise<AuthResponse> => {
        setError(null);
        try {
            const response = await authApi.login(data);
            setUser(response.user);
            return response;
        } catch (err: any) {
            const message = err.message || 'Login failed';
            setError(message);
            throw err;
        }
    }, []);

    // Register
    const register = useCallback(async (data: RegisterData): Promise<AuthResponse> => {
        setError(null);
        try {
            const response = await authApi.register(data);
            setUser(response.user);
            return response;
        } catch (err: any) {
            const message = err.message || 'Registration failed';
            setError(message);
            throw err;
        }
    }, []);

    // Logout
    const logout = useCallback(() => {
        authApi.logout();
        setUser(null);
        setError(null);
    }, []);

    // Google OAuth
    const googleLogin = useCallback(() => {
        authApi.googleLogin();
    }, []);

    // Refresh profile
    const refreshProfile = useCallback(async () => {
        try {
            const profile = await authApi.getProfile();
            setUser(profile);
        } catch (err) {
            console.error('Failed to refresh profile:', err);
        }
    }, []);

    // Update profile
    const updateProfile = useCallback(async (data: UpdateProfileData): Promise<User> => {
        setError(null);
        try {
            const updatedUser = await authApi.updateProfile(data);
            setUser(updatedUser);
            return updatedUser;
        } catch (err: any) {
            const message = err.message || 'Failed to update profile';
            setError(message);
            throw err;
        }
    }, []);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        googleLogin,
        refreshProfile,
        updateProfile,
        clearError,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
