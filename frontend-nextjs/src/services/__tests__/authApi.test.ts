import { describe, it, expect, vi, beforeEach } from "vitest";
import { authApi } from "../authApi";
import api, { tokenManager } from "../api";

// Mock axios api
vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  tokenManager: {
    setToken: vi.fn(),
    setUser: vi.fn(),
    removeToken: vi.fn(),
    clearAuth: vi.fn(),
    getToken: vi.fn(),
    getUser: vi.fn(),
  },
}));

describe("Auth API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("should login with email and password object", async () => {
      const mockResponse = {
        user: { id: "1", email: "test@example.com", name: "Test User" },
        accessToken: "jwt-token-123",
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      // authApi.login takes a LoginData object
      const result = await authApi.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(api.post).toHaveBeenCalledWith("/auth/login", {
        email: "test@example.com",
        password: "password123",
      });
      expect(tokenManager.setToken).toHaveBeenCalledWith("jwt-token-123");
      expect(result).toEqual(mockResponse);
    });
  });

  describe("register", () => {
    it("should register new user", async () => {
      const mockResponse = {
        user: { id: "1", email: "new@example.com", name: "New User" },
        accessToken: "new-token-456",
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await authApi.register({
        email: "new@example.com",
        password: "password123",
        name: "New User",
      });

      expect(api.post).toHaveBeenCalledWith("/auth/register", {
        email: "new@example.com",
        password: "password123",
        name: "New User",
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe("logout", () => {
    it("should clear auth data on logout", () => {
      authApi.logout();
      expect(tokenManager.clearAuth).toHaveBeenCalled();
    });
  });

  describe("forgotPassword", () => {
    it("should send forgot password request", async () => {
      const mockResponse = { message: "Reset email sent" };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await authApi.forgotPassword("test@example.com");

      expect(api.post).toHaveBeenCalledWith("/auth/forgot-password", {
        email: "test@example.com",
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe("resetPassword", () => {
    it("should reset password with token and newPassword", async () => {
      const mockResponse = { message: "Password reset successful" };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await authApi.resetPassword(
        "reset-token",
        "newpassword123",
      );

      expect(api.post).toHaveBeenCalledWith("/auth/reset-password", {
        token: "reset-token",
        newPassword: "newpassword123",
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe("getProfile", () => {
    it("should fetch current user profile from /auth/me", async () => {
      const mockUser = { id: "1", email: "test@example.com", name: "Test" };
      (api.get as any).mockResolvedValue({ data: mockUser });

      const result = await authApi.getProfile();

      expect(api.get).toHaveBeenCalledWith(
        "/auth/me",
        expect.objectContaining({
          validateStatus: expect.any(Function),
        }),
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe("updateProfile", () => {
    it("should update user profile", async () => {
      const updateData = { name: "Updated Name" };
      const mockUser = {
        id: "1",
        email: "test@example.com",
        name: "Updated Name",
      };
      (api.put as any).mockResolvedValue({ data: mockUser });

      const result = await authApi.updateProfile(updateData);

      expect(api.put).toHaveBeenCalledWith("/auth/profile", updateData);
      expect(result).toEqual(mockUser);
    });
  });

  describe("isAuthenticated", () => {
    it("should return true when token exists", () => {
      (tokenManager.getToken as any).mockReturnValue("some-token");
      expect(authApi.isAuthenticated()).toBe(true);
    });

    it("should return false when no token", () => {
      (tokenManager.getToken as any).mockReturnValue(null);
      expect(authApi.isAuthenticated()).toBe(false);
    });
  });
});
