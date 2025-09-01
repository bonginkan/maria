/**
 * TokenStorage Comprehensive Tests
 * Tests secure token storage with keychain and file fallbacks
 */

import { TokenStorage } from '../../../services/cli-auth/TokenStorage';
import { AuthTokens } from '../../../services/cli-auth/types';
import { mockTokens, mockUser } from '../../../../tests/auth/setup';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// Mock keytar availability
let keytarMock: any;
jest.mock('keytar', () => keytarMock, { virtual: true });

describe('TokenStorage', () => {
  let tokenStorage: TokenStorage;
  const mockHomedir = '/mock/home';
  const expectedTokenFile = path.join(mockHomedir, '.maria', 'auth-tokens.json');

  beforeEach(() => {
    tokenStorage = new TokenStorage();
    jest.clearAllMocks();
    
    // Reset keytar mock
    keytarMock = {
      setPassword: jest.fn(),
      getPassword: jest.fn(),
      deletePassword: jest.fn()
    };
    
    (os.homedir as jest.Mock).mockReturnValue(mockHomedir);
  });

  describe('with keychain available', () => {
    beforeEach(() => {
      // Mock keytar as available
      jest.doMock('keytar', () => keytarMock);
    });

    it('should save tokens to keychain when available', async () => {
      keytarMock.setPassword.mockResolvedValue(undefined);

      await tokenStorage.save(mockTokens);

      expect(keytarMock.setPassword).toHaveBeenCalledWith(
        'maria-cli',
        'default',
        JSON.stringify(mockTokens)
      );
      expect(fs.writeFile).not.toHaveBeenCalled(); // Should not fallback to file
    });

    it('should load tokens from keychain when available', async () => {
      const tokenJson = JSON.stringify(mockTokens);
      keytarMock.getPassword.mockResolvedValue(tokenJson);

      const result = await tokenStorage.load();

      expect(keytarMock.getPassword).toHaveBeenCalledWith('maria-cli', 'default');
      expect(result).toEqual(mockTokens);
    });

    it('should clear tokens from keychain', async () => {
      keytarMock.deletePassword.mockResolvedValue(undefined);

      await tokenStorage.clear();

      expect(keytarMock.deletePassword).toHaveBeenCalledWith('maria-cli', 'default');
    });

    it('should fallback to file storage when keychain save fails', async () => {
      keytarMock.setPassword.mockRejectedValue(new Error('Keychain access denied'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await tokenStorage.save(mockTokens);

      expect(keytarMock.setPassword).toHaveBeenCalled();
      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(expectedTokenFile), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should fallback to file storage when keychain load fails', async () => {
      keytarMock.getPassword.mockRejectedValue(new Error('Keychain access failed'));
      const mockFileContent = JSON.stringify({
        iv: '1234567890abcdef',
        data: 'encrypted-data'
      });
      (fs.readFile as jest.Mock).mockResolvedValue(mockFileContent);

      // Mock crypto operations for file decryption
      const crypto = require('crypto');
      const mockDecipher = {
        update: jest.fn().mockReturnValue('{"test":'),
        final: jest.fn().mockReturnValue('"value"}')
      };
      jest.spyOn(crypto, 'createDecipher').mockReturnValue(mockDecipher);

      const result = await tokenStorage.load();

      expect(keytarMock.getPassword).toHaveBeenCalled();
      expect(fs.readFile).toHaveBeenCalledWith(expectedTokenFile, 'utf8');
      expect(result).toEqual({ test: 'value' });
    });
  });

  describe('without keychain (file storage)', () => {
    beforeEach(() => {
      // Mock keytar as unavailable
      keytarMock = null;
      jest.doMock('keytar', () => keytarMock);
    });

    it('should save tokens to encrypted file when keychain unavailable', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      // Mock crypto operations for file encryption
      const crypto = require('crypto');
      const mockCipher = {
        update: jest.fn().mockReturnValue('encrypted'),
        final: jest.fn().mockReturnValue('data')
      };
      jest.spyOn(crypto, 'createCipher').mockReturnValue(mockCipher);
      jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('1234567890abcdef'));

      await tokenStorage.save(mockTokens);

      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(expectedTokenFile), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        expectedTokenFile,
        expect.stringContaining('iv'),
        { mode: 0o600 }
      );
    });

    it('should load tokens from encrypted file when keychain unavailable', async () => {
      const mockFileContent = JSON.stringify({
        iv: '1234567890abcdef',
        data: 'encrypteddata'
      });
      (fs.readFile as jest.Mock).mockResolvedValue(mockFileContent);

      // Mock crypto operations for file decryption
      const crypto = require('crypto');
      const mockDecipher = {
        update: jest.fn().mockReturnValue(JSON.stringify(mockTokens).slice(0, -1)),
        final: jest.fn().mockReturnValue('}')
      };
      jest.spyOn(crypto, 'createDecipher').mockReturnValue(mockDecipher);

      const result = await tokenStorage.load();

      expect(fs.readFile).toHaveBeenCalledWith(expectedTokenFile, 'utf8');
      expect(result).toEqual(mockTokens);
    });

    it('should return null when file does not exist', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

      const result = await tokenStorage.load();

      expect(result).toBeNull();
    });

    it('should clear file tokens', async () => {
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await tokenStorage.clear();

      expect(fs.unlink).toHaveBeenCalledWith(expectedTokenFile);
    });

    it('should handle file deletion errors gracefully', async () => {
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(tokenStorage.clear()).resolves.not.toThrow();
    });
  });

  describe('encryption key generation', () => {
    it('should generate consistent encryption key for same machine', async () => {
      (os.hostname as jest.Mock).mockReturnValue('test-host');
      (os.platform as jest.Mock).mockReturnValue('linux');
      (os.arch as jest.Mock).mockReturnValue('x64');

      const storage1 = new TokenStorage();
      const storage2 = new TokenStorage();

      // Access private method for testing
      const key1 = await (storage1 as any).getEncryptionKey();
      const key2 = await (storage2 as any).getEncryptionKey();

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA256 hex string
    });

    it('should generate different keys for different machines', async () => {
      (os.hostname as jest.Mock).mockReturnValueOnce('host1');
      const key1 = await (tokenStorage as any).getEncryptionKey();

      (os.hostname as jest.Mock).mockReturnValueOnce('host2');
      const key2 = await (tokenStorage as any).getEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('TokenStorage.isKeychainAvailable', () => {
    it('should return true when keytar is available', () => {
      keytarMock = { test: 'available' };
      jest.doMock('keytar', () => keytarMock);

      // Need to create new instance to pick up the mock
      expect(TokenStorage.isKeychainAvailable()).toBe(true);
    });

    it('should return false when keytar is not available', () => {
      keytarMock = null;
      jest.doMock('keytar', () => keytarMock);

      expect(TokenStorage.isKeychainAvailable()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle corrupted file data gracefully', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('invalid-json');

      const result = await tokenStorage.load();

      expect(result).toBeNull();
    });

    it('should handle missing directory for file save', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(tokenStorage.save(mockTokens)).rejects.toThrow();
    });

    it('should handle crypto operations failure gracefully', async () => {
      const crypto = require('crypto');
      jest.spyOn(crypto, 'createHash').mockImplementation(() => {
        throw new Error('Crypto not available');
      });

      await expect(tokenStorage.save(mockTokens)).rejects.toThrow();
    });
  });

  describe('data validation', () => {
    it('should handle malformed token data', async () => {
      const invalidTokens = { invalid: 'data' } as any;
      keytarMock.setPassword.mockResolvedValue(undefined);

      await tokenStorage.save(invalidTokens);

      expect(keytarMock.setPassword).toHaveBeenCalledWith(
        'maria-cli',
        'default',
        JSON.stringify(invalidTokens)
      );
    });

    it('should handle empty token data', async () => {
      keytarMock.getPassword.mockResolvedValue('');

      const result = await tokenStorage.load();

      expect(result).toBeNull();
    });
  });
});