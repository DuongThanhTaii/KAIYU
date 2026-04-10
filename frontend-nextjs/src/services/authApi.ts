import api, { tokenManager } from "./api";

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  hskLevel: number;
  streak: number;
  xp: number;
  dailyGoalMinutes: number;
  isPremium: boolean;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  hskLevel?: number;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileData {
  name?: string;
  avatarUrl?: string;
  dailyGoalMinutes?: number;
  hskLevel?: number;
}

// Auth API
export const authApi = {
  /**
   * Login with email and password
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/login", data);
    const { accessToken, user } = response.data;

    // Store token and user
    tokenManager.setToken(accessToken);
    tokenManager.setUser(user);

    return response.data;
  },

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<any> {
    const response = await api.post<any>("/auth/register", data);

    // If backend returned an access token (legacy immediate registration or
    // a registration completed flow), store it. Otherwise it may return
    // an object like { registrationRequestId } for OTP flow.
    if (response.data && response.data.accessToken) {
      const { accessToken, user } = response.data;
      tokenManager.setToken(accessToken);
      tokenManager.setUser(user);
      return response.data as AuthResponse;
    }

    return response.data;
  },

  async registerVerify(
    registrationRequestId: string,
    otp: string,
  ): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/register/verify", {
      registrationRequestId,
      otp,
    });
    const { accessToken, user } = response.data;
    tokenManager.setToken(accessToken);
    tokenManager.setUser(user);
    return response.data;
  },

  async registerResend(
    registrationRequestId: string,
  ): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      "/auth/register/resend",
      { registrationRequestId },
    );
    return response.data;
  },

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    const response = await api.get<User>("/auth/me", {
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0",
        Pragma: "no-cache",
      },
    });
    tokenManager.setUser(response.data);
    return response.data;
  },

  /**
   * Change password
   */
  async changePassword(data: ChangePasswordData): Promise<{ message: string }> {
    const response = await api.put<{ message: string }>("/auth/password", data);
    return response.data;
  },

  /**
   * Update user profile
   */
  async updateProfile(data: UpdateProfileData): Promise<User> {
    const response = await api.put<User>("/auth/profile", data);
    tokenManager.setUser(response.data);
    return response.data;
  },

  /**
   * Logout - clear local storage
   */
  logout(): void {
    tokenManager.clearAuth();
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!tokenManager.getToken();
  },

  /**
   * Get stored user
   */
  getStoredUser(): User | null {
    const storedUser = tokenManager.getUser();
    if (!storedUser) return null;
    return storedUser as User;
  },

  /**
   * Initiate Google OAuth login
   * Redirects to backend Google OAuth endpoint
   */
  googleLogin(): void {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    window.location.href = `${apiUrl}/auth/google`;
  },

  /**
   * Handle Google OAuth callback
   * Called when redirected back from Google OAuth
   */
  handleGoogleCallback(token: string, userJson: string): AuthResponse | null {
    try {
      const user = JSON.parse(decodeURIComponent(userJson));
      tokenManager.setToken(token);
      tokenManager.setUser(user);
      return { accessToken: token, user };
    } catch (error) {
      console.error("Failed to parse Google callback data:", error);
      return null;
    }
  },

  /**
   * Request password reset email
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      "/auth/forgot-password",
      { email },
    );
    return response.data;
  },

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      "/auth/reset-password",
      { token, newPassword },
    );
    return response.data;
  },
};

export default authApi;
