/**
 * Authentication Manager Comprehensive Tests
 * Advanced tests covering all authentication scenarios
 */

import { AuthenticationManager } from '../../../services/cli-auth/AuthenticationManager';
import { TokenStorage } from '../../../services/cli-auth/TokenStorage';
import { AuthenticationRequiredError, QuotaExceededError, PlanRestrictedError, ERROR_MESSAGES } from '../../../services/cli-auth/types';
import { mockTokens, mockUser, mockExpiredTokens } from '../../../../tests/auth/setup';
import { createServer } from 'http';

// Mock dependencies
jest.mock('../../../services/cli-auth/TokenStorage');
jest.mock('open');
jest.mock('http');

describe('AuthenticationManager', () => {
  let authManager: AuthenticationManager;
  let mockTokenStorage: jest.Mocked<TokenStorage>;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    global.resetAuthMocks();
    
    // Mock TokenStorage
    mockTokenStorage = new TokenStorage() as jest.Mocked<TokenStorage>;
    
    // Create auth manager instance
    authManager = new AuthenticationManager();
    
    // Override the token storage with our mock
    (authManager as any).tokenStorage = mockTokenStorage;
    
    // Get the mocked fetch
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  });

  describe('isAuthenticated', () => {
    it('should return false when no tokens exist', async () => {
      mockTokenStorage.load.mockResolvedValue(null);
      
      const result = await authManager.isAuthenticated();
      
      expect(result).toBe(false);
    });

    it('should return true when valid tokens exist', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      
      const result = await authManager.isAuthenticated();
      
      expect(result).toBe(true);
    });

    it('should attempt refresh when token expires soon', async () => {
      const expiringTokens = {
        ...mockTokens,
        expiresAt: Date.now() + 2 * 60 * 1000 // 2 minutes (needs refresh)
      };
      
      mockTokenStorage.load.mockResolvedValue(expiringTokens);
      
      // Mock successful refresh
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        id_token: 'new-id-token',
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      }), { status: 200 }));

      mockTokenStorage.save.mockResolvedValue();
      
      const result = await authManager.isAuthenticated();
      
      expect(result).toBe(true);
      expect(mockTokenStorage.save).toHaveBeenCalled();
    });

    it('should return false when token is expired and refresh fails', async () => {
      mockTokenStorage.load.mockResolvedValue(mockExpiredTokens);
      
      // Mock failed refresh
      mockFetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
      
      const result = await authManager.isAuthenticated();
      
      expect(result).toBe(false);
    });

    it('should handle network errors during refresh', async () => {
      mockTokenStorage.load.mockResolvedValue(mockExpiredTokens);
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const result = await authManager.isAuthenticated();
      
      expect(result).toBe(false);
    });
  });

  describe('requireUser', () => {
    it('should throw AuthenticationRequiredError when not authenticated', async () => {
      mockTokenStorage.load.mockResolvedValue(null);
      
      await expect(authManager.requireUser()).rejects.toThrow(AuthenticationRequiredError);
      await expect(authManager.requireUser()).rejects.toThrow(ERROR_MESSAGES.AUTH_REQUIRED);
    });

    it('should return user when authenticated', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      
      mockFetch.mockResolvedValue(new Response(JSON.stringify(mockUser), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
      
      const result = await authManager.requireUser();
      
      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/profile'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockTokens.accessToken}`,
            'User-Agent': expect.stringContaining('maria-cli')
          })
        })
      );
    });

    it('should handle 401 response with token expired error', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockFetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
      
      await expect(authManager.requireUser()).rejects.toThrow(AuthenticationRequiredError);
      await expect(authManager.requireUser()).rejects.toThrow(ERROR_MESSAGES.TOKEN_EXPIRED);
    });

    it('should handle 402 response with quota exceeded error', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockFetch.mockResolvedValue(new Response('Quota exceeded', { status: 402 }));
      
      await expect(authManager.requireUser()).rejects.toThrow(QuotaExceededError);
    });

    it('should handle network errors gracefully', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      
      await expect(authManager.requireUser()).rejects.toThrow(ERROR_MESSAGES.NETWORK_ERROR);
    });

    it('should handle server errors (5xx)', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockFetch.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));
      
      await expect(authManager.requireUser()).rejects.toThrow('Failed to fetch user profile');
    });
  });

  describe('login', () => {
    it('should return existing user when already authenticated and not forced', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockFetch.mockResolvedValue(new Response(JSON.stringify(mockUser), { status: 200 }));
      
      const result = await authManager.login();
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it('should force re-authentication when force option is true', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      
      // Mock the private loginWithPKCEFlow method to avoid complex HTTP server mocking
      jest.spyOn(authManager as any, 'loginWithPKCEFlow').mockResolvedValue({
        ...mockTokens,
        expiresAt: Date.now() + 3600000
      });
      
      mockTokenStorage.save.mockResolvedValue();
      mockFetch.mockResolvedValue(new Response(JSON.stringify(mockUser), { status: 200 }));
      
      const result = await authManager.login({ force: true });
      
      expect(result.success).toBe(true);
      expect(mockTokenStorage.save).toHaveBeenCalled();
    });

    it('should fallback to device flow when PKCE fails', async () => {
      mockTokenStorage.load.mockResolvedValue(null);
      
      // Mock PKCE failure
      jest.spyOn(authManager as any, 'loginWithPKCEFlow').mockRejectedValue(new Error('Browser launch failed'));
      
      // Mock device flow success
      const deviceStartResponse = {
        verificationUri: 'https://auth.example.com/device',
        userCode: 'ABCD-1234',
        deviceCode: 'device-code-123',
        interval: 5,
        expiresIn: 600
      };
      
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(deviceStartResponse), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          id_token: 'device-id-token',
          access_token: 'device-access-token',
          refresh_token: 'device-refresh-token',
          expires_in: 3600
        }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockUser), { status: 200 }));
      
      mockTokenStorage.save.mockResolvedValue();
      
      const result = await authManager.login();
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it('should handle device flow timeout', async () => {
      mockTokenStorage.load.mockResolvedValue(null);
      
      jest.spyOn(authManager as any, 'loginWithPKCEFlow').mockRejectedValue(new Error('PKCE failed'));
      jest.spyOn(authManager as any, 'loginWithDeviceFlow').mockRejectedValue(new Error(ERROR_MESSAGES.LOGIN_TIMEOUT));
      
      const result = await authManager.login();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('logout', () => {
    it('should clear tokens and revoke on server', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockTokenStorage.clear.mockResolvedValue();
      
      // Mock successful token revocation
      mockFetch.mockResolvedValue(new Response('', { status: 200 }));
      
      await authManager.logout();
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/revoke'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockTokens.accessToken}`
          }),
          body: JSON.stringify({
            refresh_token: mockTokens.refreshToken,
            all_devices: false
          })
        })
      );
      expect(mockTokenStorage.clear).toHaveBeenCalled();
    });

    it('should support all devices logout', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockTokenStorage.clear.mockResolvedValue();
      mockFetch.mockResolvedValue(new Response('', { status: 200 }));
      
      await authManager.logout({ all: true });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/revoke'),
        expect.objectContaining({
          body: JSON.stringify({
            refresh_token: mockTokens.refreshToken,
            all_devices: true
          })
        })
      );
    });

    it('should force clear tokens even if server revocation fails', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockTokenStorage.clear.mockResolvedValue();
      
      // Mock failed token revocation
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      await authManager.logout({ force: true });
      
      expect(mockTokenStorage.clear).toHaveBeenCalled();
    });

    it('should handle logout when not authenticated', async () => {
      mockTokenStorage.load.mockResolvedValue(null);
      mockTokenStorage.clear.mockResolvedValue();
      
      await authManager.logout();
      
      expect(mockFetch).not.toHaveBeenCalled(); // No server call needed
      expect(mockTokenStorage.clear).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      mockTokenStorage.load.mockResolvedValue(mockExpiredTokens);
      mockTokenStorage.save.mockResolvedValue();
      
      // Mock successful token refresh
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        id_token: 'new-id-token',
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      }), { status: 200 }));
      
      const result = await authManager.refreshToken();
      
      expect(result).toBe(true);
      expect(mockTokenStorage.save).toHaveBeenCalledWith(expect.objectContaining({
        idToken: 'new-id-token',
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: expect.any(Number)
      }));
    });

    it('should return false when refresh fails', async () => {
      const invalidTokens = {
        ...mockTokens,
        refreshToken: 'invalid-refresh-token'
      };
      
      mockTokenStorage.load.mockResolvedValue(invalidTokens);
      
      // Mock failed token refresh
      mockFetch.mockResolvedValue(new Response('Invalid refresh token', { status: 401 }));
      
      const result = await authManager.refreshToken();
      
      expect(result).toBe(false);
    });

    it('should return false when no tokens exist', async () => {
      mockTokenStorage.load.mockResolvedValue(null);
      
      const result = await authManager.refreshToken();
      
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reuse existing refresh token when new one not provided', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockTokenStorage.save.mockResolvedValue();
      
      // Mock refresh response without new refresh token
      mockFetch.mockResolvedValue(new Response(JSON.stringify({
        id_token: 'new-id-token',
        access_token: 'new-access-token',
        expires_in: 3600
        // No refresh_token in response
      }), { status: 200 }));
      
      const result = await authManager.refreshToken();
      
      expect(result).toBe(true);
      expect(mockTokenStorage.save).toHaveBeenCalledWith(expect.objectContaining({
        refreshToken: mockTokens.refreshToken // Original refresh token reused
      }));
    });
  });

  describe('checkPlanAccess', () => {
    beforeEach(() => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
    });

    it('should allow free features for free plan users', async () => {
      const freeUser = { ...mockUser, plan: 'FREE' };
      mockFetch.mockResolvedValue(new Response(JSON.stringify(freeUser), { status: 200 }));
      
      await expect(authManager.checkPlanAccess('code')).resolves.not.toThrow();
    });

    it('should block restricted features for free plan users', async () => {
      const freeUser = { ...mockUser, plan: 'FREE' };
      mockFetch.mockResolvedValue(new Response(JSON.stringify(freeUser), { status: 200 }));
      
      await expect(authManager.checkPlanAccess('image')).rejects.toThrow(PlanRestrictedError);
      await expect(authManager.checkPlanAccess('video')).rejects.toThrow(PlanRestrictedError);
      await expect(authManager.checkPlanAccess('voice')).rejects.toThrow(PlanRestrictedError);
    });

    it('should allow all features for paid plan users', async () => {
      const proUser = { ...mockUser, plan: 'PRO' };
      mockFetch.mockResolvedValue(new Response(JSON.stringify(proUser), { status: 200 }));
      
      await expect(authManager.checkPlanAccess('image')).resolves.not.toThrow();
      await expect(authManager.checkPlanAccess('video')).resolves.not.toThrow();
      await expect(authManager.checkPlanAccess('voice')).resolves.not.toThrow();
    });
  });

  describe('getUsageStats', () => {
    it('should return usage stats with quota status', async () => {
      const userWithUsage = {
        ...mockUser,
        usage: {
          requests: 50,
          requestLimit: 100,
          tokens: 5000,
          tokenLimit: 10000,
          resetDate: '2025-09-01'
        }
      };
      
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockFetch.mockResolvedValue(new Response(JSON.stringify(userWithUsage), { status: 200 }));
      
      const result = await authManager.getUsageStats();
      
      expect(result.usage).toEqual(userWithUsage.usage);
      expect(result.withinQuota).toBe(true); // 50 < 100
    });

    it('should detect quota exceeded status', async () => {
      const userOverQuota = {
        ...mockUser,
        usage: {
          requests: 100,
          requestLimit: 100,
          tokens: 10000,
          tokenLimit: 10000,
          resetDate: '2025-09-01'
        }
      };
      
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockFetch.mockResolvedValue(new Response(JSON.stringify(userOverQuota), { status: 200 }));
      
      const result = await authManager.getUsageStats();
      
      expect(result.usage).toEqual(userOverQuota.usage);
      expect(result.withinQuota).toBe(false); // 100 >= 100
    });
  });

  describe('error handling edge cases', () => {
    it('should handle malformed API responses', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockFetch.mockResolvedValue(new Response('invalid json', { status: 200 }));
      
      await expect(authManager.getCurrentUser()).rejects.toThrow();
    });

    it('should handle empty API responses', async () => {
      mockTokenStorage.load.mockResolvedValue(mockTokens);
      mockFetch.mockResolvedValue(new Response('', { status: 200 }));
      
      await expect(authManager.getCurrentUser()).rejects.toThrow();
    });

    it('should handle corrupted token storage', async () => {
      mockTokenStorage.load.mockRejectedValue(new Error('Corrupted data'));
      
      const result = await authManager.isAuthenticated();
      
      expect(result).toBe(false);
    });
  });
});