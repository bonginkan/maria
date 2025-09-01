/**
 * BaseCommand Authentication Guard Tests
 * Tests for the authentication guard system in BaseCommand
 */

import { BaseCommand, CommandMeta, CommandResult, CommandContext } from '../../../slash-commands/shared/BaseCommand';
import { authManager, User, AuthenticationRequiredError, QuotaExceededError, PlanRestrictedError, ERROR_MESSAGES } from '../../../services/cli-auth';
import { mockUser } from '../../../../tests/auth/setup';

// Mock authentication manager
jest.mock('../../../services/cli-auth');

// Test command implementation
class TestCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'test',
    description: 'Test command',
    category: 'test',
    requiresAuth: true,
    planRestrictions: ['advanced-feature']
  };

  async execute(): Promise<CommandResult> {
    return await this.executeWithGuards(async (user: User) => {
      return this.success(`Test executed for ${user.email}`);
    });
  }
}

// Test command without auth requirement
class PublicTestCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'help',
    description: 'Public command',
    category: 'core'
  };

  async execute(): Promise<CommandResult> {
    return await this.executeWithGuards(async (user: User) => {
      return this.success('Public command executed');
    });
  }
}

// Test quota-consuming command
class QuotaCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'code',
    description: 'Quota consuming command',
    category: 'code',
    requiresAuth: true
  };

  async execute(): Promise<CommandResult> {
    return await this.executeWithGuards(async (user: User) => {
      return this.success('Code generated');
    });
  }
}

describe('BaseCommand Authentication Guards', () => {
  let mockAuthManager: jest.Mocked<typeof authManager>;
  let testCommand: TestCommand;
  let publicCommand: PublicTestCommand;
  let quotaCommand: QuotaCommand;

  beforeEach(() => {
    global.resetAuthMocks();
    
    mockAuthManager = authManager as jest.Mocked<typeof authManager>;
    
    testCommand = new TestCommand();
    publicCommand = new PublicTestCommand();
    quotaCommand = new QuotaCommand();
  });

  describe('requireAuth', () => {
    it('should return user when authenticated', async () => {
      mockAuthManager.requireUser.mockResolvedValue(mockUser);

      const result = await testCommand['requireAuth']();

      expect(result).toEqual(mockUser);
      expect(mockAuthManager.requireUser).toHaveBeenCalled();
    });

    it('should throw AuthenticationRequiredError when not authenticated', async () => {
      mockAuthManager.requireUser.mockRejectedValue(new AuthenticationRequiredError());

      await expect(testCommand['requireAuth']()).rejects.toThrow(AuthenticationRequiredError);
    });

    it('should wrap generic errors in AuthenticationRequiredError', async () => {
      mockAuthManager.requireUser.mockRejectedValue(new Error('Network error'));

      await expect(testCommand['requireAuth']()).rejects.toThrow(AuthenticationRequiredError);
      await expect(testCommand['requireAuth']()).rejects.toThrow(ERROR_MESSAGES.AUTH_REQUIRED);
    });
  });

  describe('checkAuth', () => {
    it('should return user when authenticated', async () => {
      mockAuthManager.isAuthenticated.mockResolvedValue(true);
      mockAuthManager.getCurrentUser.mockResolvedValue(mockUser);

      const result = await testCommand['checkAuth']();

      expect(result).toEqual(mockUser);
    });

    it('should return null when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockResolvedValue(false);

      const result = await testCommand['checkAuth']();

      expect(result).toBeNull();
    });

    it('should return null when authentication check fails', async () => {
      mockAuthManager.isAuthenticated.mockRejectedValue(new Error('Network error'));

      const result = await testCommand['checkAuth']();

      expect(result).toBeNull();
    });
  });

  describe('checkQuota', () => {
    it('should pass when user has quota remaining', async () => {
      const userWithQuota = {
        ...mockUser,
        usage: {
          requests: 50,
          requestLimit: 100,
          tokens: 5000,
          tokenLimit: 10000,
          resetDate: '2025-09-01'
        }
      };
      
      mockAuthManager.requireUser.mockResolvedValue(userWithQuota);

      await expect(testCommand['checkQuota']()).resolves.not.toThrow();
    });

    it('should throw QuotaExceededError when quota exhausted', async () => {
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
      
      mockAuthManager.requireUser.mockResolvedValue(userOverQuota);

      await expect(testCommand['checkQuota']()).rejects.toThrow(QuotaExceededError);
      await expect(testCommand['checkQuota']()).rejects.toThrow(ERROR_MESSAGES.QUOTA_EXCEEDED);
    });
  });

  describe('checkPlanAccess', () => {
    it('should allow access for features not restricted', async () => {
      mockAuthManager.requireUser.mockResolvedValue(mockUser);

      await expect(testCommand['checkPlanAccess']('basic-feature')).resolves.not.toThrow();
    });

    it('should block restricted features for free plan users', async () => {
      const freeUser = { ...mockUser, plan: 'FREE' };
      mockAuthManager.requireUser.mockResolvedValue(freeUser);

      await expect(testCommand['checkPlanAccess']('image')).rejects.toThrow(PlanRestrictedError);
      await expect(testCommand['checkPlanAccess']('video')).rejects.toThrow(PlanRestrictedError);
      await expect(testCommand['checkPlanAccess']('voice')).rejects.toThrow(PlanRestrictedError);
    });

    it('should allow all features for paid plan users', async () => {
      const proUser = { ...mockUser, plan: 'PRO' };
      mockAuthManager.requireUser.mockResolvedValue(proUser);

      await expect(testCommand['checkPlanAccess']('image')).resolves.not.toThrow();
      await expect(testCommand['checkPlanAccess']('video')).resolves.not.toThrow();
      await expect(testCommand['checkPlanAccess']('voice')).resolves.not.toThrow();
    });
  });

  describe('executeWithGuards', () => {
    it('should skip auth checks for public commands', async () => {
      const result = await publicCommand.execute();

      expect(result.endReason).toBe('success');
      expect(result.message).toBe('Public command executed');
      expect(mockAuthManager.requireUser).not.toHaveBeenCalled();
    });

    it('should enforce auth for protected commands', async () => {
      mockAuthManager.requireUser.mockResolvedValue(mockUser);

      const result = await testCommand.execute();

      expect(result.endReason).toBe('success');
      expect(mockAuthManager.requireUser).toHaveBeenCalled();
    });

    it('should check quota for quota-consuming commands', async () => {
      const userWithQuota = {
        ...mockUser,
        usage: {
          requests: 50,
          requestLimit: 100,
          tokens: 5000,
          tokenLimit: 10000,
          resetDate: '2025-09-01'
        }
      };
      
      mockAuthManager.requireUser.mockResolvedValue(userWithQuota);

      const result = await quotaCommand.execute();

      expect(result.endReason).toBe('success');
      expect(result.usage).toMatchObject({
        requestsLeft: 50,
        resetDate: '2025-09-01'
      });
    });

    it('should block quota-consuming commands when quota exceeded', async () => {
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
      
      mockAuthManager.requireUser.mockResolvedValue(userOverQuota);

      const result = await quotaCommand.execute();

      expect(result.endReason).toBe('error');
      expect(result.error).toBe(ERROR_MESSAGES.QUOTA_EXCEEDED);
      expect(result.code).toBe('QUOTA_EXCEEDED');
    });

    it('should handle authentication errors in guards', async () => {
      mockAuthManager.requireUser.mockRejectedValue(new AuthenticationRequiredError());

      const result = await testCommand.execute();

      expect(result.endReason).toBe('error');
      expect(result.error).toBe(ERROR_MESSAGES.AUTH_REQUIRED);
      expect(result.code).toBe('AUTH_REQUIRED');
    });

    it('should handle plan restriction errors', async () => {
      const freeUser = { ...mockUser, plan: 'FREE' };
      mockAuthManager.requireUser.mockResolvedValue(freeUser);
      mockAuthManager.checkPlanAccess.mockRejectedValue(new PlanRestrictedError());

      // Create command with plan restrictions
      const restrictedCommand = new class extends BaseCommand {
        readonly meta: CommandMeta = {
          name: 'restricted',
          description: 'Restricted command',
          category: 'test',
          planRestrictions: ['premium-feature']
        };

        async execute(): Promise<CommandResult> {
          return await this.executeWithGuards(async (user: User) => {
            return this.success('Should not reach here');
          });
        }
      }();

      const result = await restrictedCommand.execute();

      expect(result.endReason).toBe('error');
      expect(result.error).toBe(ERROR_MESSAGES.PLAN_RESTRICTED);
      expect(result.code).toBe('PLAN_RESTRICTED');
    });
  });

  describe('usage information injection', () => {
    it('should add usage info to successful command results', async () => {
      const userWithUsage = {
        ...mockUser,
        usage: {
          requests: 25,
          requestLimit: 100,
          tokens: 2500,
          tokenLimit: 10000,
          resetDate: '2025-09-01'
        },
        models: ['gemini-flash-lite', 'gemini-2.0-flash']
      };
      
      mockAuthManager.requireUser.mockResolvedValue(userWithUsage);

      const result = await testCommand.execute();

      expect(result.endReason).toBe('success');
      expect(result.usage).toMatchObject({
        requestsLeft: 75, // 100 - 25
        resetDate: '2025-09-01',
        modelsAvailable: ['gemini-flash-lite', 'gemini-2.0-flash']
      });
    });

    it('should handle missing usage data gracefully', async () => {
      const userWithoutUsage = {
        ...mockUser,
        usage: undefined,
        models: []
      };
      
      mockAuthManager.requireUser.mockResolvedValue(userWithoutUsage);

      const result = await testCommand.execute();

      expect(result.endReason).toBe('success');
      expect(result.usage).toMatchObject({
        modelsAvailable: []
      });
    });
  });
});