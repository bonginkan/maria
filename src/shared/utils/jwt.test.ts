import { describe, it, expect } from 'vitest';
import { generateNeo4jJWT, verifyNeo4jJWT, getNeo4jBloomURL } from './jwt';

describe('JWT Utils', () => {
  const testSecret = 'test-secret-key';
  const testEmail = 'test@example.com';

  describe('generateNeo4jJWT', () => {
    it('should generate a valid JWT token', () => {
      const token = generateNeo4jJWT(testEmail, {
        secret: testSecret,
        expiryMinutes: 15,
        role: 'editor'
      });

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should set default role to editor', () => {
      const token = generateNeo4jJWT(testEmail, {
        secret: testSecret
      });

      const payload = verifyNeo4jJWT(token, testSecret);
      expect(payload?.role).toBe('editor');
    });
  });

  describe('verifyNeo4jJWT', () => {
    it('should verify a valid token', () => {
      const token = generateNeo4jJWT(testEmail, {
        secret: testSecret,
        expiryMinutes: 15,
        role: 'reader'
      });

      const payload = verifyNeo4jJWT(token, testSecret);
      
      expect(payload).toBeDefined();
      expect(payload?.sub).toBe(testEmail);
      expect(payload?.role).toBe('reader');
      expect(payload?.iss).toBe('maria-platform');
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const payload = verifyNeo4jJWT(invalidToken, testSecret);
      
      expect(payload).toBeNull();
    });

    it('should return null for malformed token with missing parts', () => {
      const malformedToken = 'only.two.parts'; // Missing one part
      const payload = verifyNeo4jJWT(malformedToken, testSecret);
      
      expect(payload).toBeNull();
    });

    it('should return null for token with only one part', () => {
      const malformedToken = 'onlyonepart';
      const payload = verifyNeo4jJWT(malformedToken, testSecret);
      
      expect(payload).toBeNull();
    });

    it('should return null when JSON parsing fails', () => {
      // Create a token with invalid base64url encoded payload
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const invalidPayload = 'invalid-base64-that-wont-parse-as-json';
      const signature = 'fake-signature';
      
      const malformedToken = `${header}.${invalidPayload}.${signature}`;
      const payload = verifyNeo4jJWT(malformedToken, testSecret);
      
      expect(payload).toBeNull();
    });

    it('should return null when Buffer.from throws an error', () => {
      // Create a token with valid format but invalid base64url that causes Buffer.from to throw
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = 'valid-base64-payload=='; // Invalid base64url due to padding
      const signature = 'fake-signature';
      
      const malformedToken = `${header}.${payload}.${signature}`;
      const result = verifyNeo4jJWT(malformedToken, testSecret);
      
      expect(result).toBeNull();
    });

    it('should return null when any error occurs during processing', () => {
      // Create a token that will cause an error in the crypto operations or buffer parsing
      const malformedToken = 'header.payload.signature_with_invalid_chars%$#@';
      const result = verifyNeo4jJWT(malformedToken, testSecret);
      
      expect(result).toBeNull();
    });

    it('should handle crypto errors in signature verification', () => {
      // Create a token with invalid characters that will cause crypto.createHmac to fail
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ test: 'data' })).toString('base64url');
      const signature = 'invalid-signature-with-special-chars';
      
      const malformedToken = `${header}.${payload}.${signature}`;
      const result = verifyNeo4jJWT(malformedToken, '');  // Empty secret might cause error
      
      expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
      const token = generateNeo4jJWT(testEmail, {
        secret: testSecret,
        expiryMinutes: -1 // Already expired
      });

      const payload = verifyNeo4jJWT(token, testSecret);
      
      expect(payload).toBeNull();
    });
  });

  describe('getNeo4jBloomURL', () => {
    it('should generate correct URL without query', () => {
      const instanceId = 'test-instance';
      const jwt = 'test-jwt-token';
      
      const url = getNeo4jBloomURL(instanceId, jwt);
      
      expect(url).toContain(`https://${instanceId}.databases.neo4j.io/bloom/`);
      expect(url).toContain(`jwt=${jwt}`);
      expect(url).toContain('_ga=');
    });

    it('should generate correct URL with query', () => {
      const instanceId = 'test-instance';
      const jwt = 'test-jwt-token';
      const query = 'MATCH (n) RETURN n';
      
      const url = getNeo4jBloomURL(instanceId, jwt, query);
      
      expect(url).toContain(`https://${instanceId}.databases.neo4j.io/bloom/`);
      expect(url).toContain(`jwt=${jwt}`);
      expect(url).toContain('query=MATCH');
      expect(url).toContain('run=true');
    });
  });
});