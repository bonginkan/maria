import * as crypto from 'crypto';

export interface JWTPayload {
  iss: string;
  sub: string;
  exp: number;
  iat: number;
  nbf: number;
  role: 'reader' | 'editor';
  permissions: string[];
}

export interface JWTOptions {
  secret: string;
  expiryMinutes?: number;
  role?: 'reader' | 'editor';
}

/**
 * Generate a JWT token for Neo4j Bloom access
 */
export function generateNeo4jJWT(
  userEmail: string,
  options: JWTOptions
): string {
  const { secret, expiryMinutes = 15, role = 'editor' } = options;
  
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    iss: 'maria-platform',
    sub: userEmail,
    exp: now + (expiryMinutes * 60),
    iat: now,
    nbf: now,
    role,
    permissions: role === 'editor' 
      ? ['read', 'write', 'execute'] 
      : ['read']
  };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode a JWT token
 */
export function verifyNeo4jJWT(token: string, secret: string): JWTPayload | null {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    
    if (!encodedHeader || !encodedPayload || !signature) {
      return null;
    }
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    // Decode payload
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString()
    ) as JWTPayload;
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get Neo4j Bloom URL with JWT and optional query
 */
export function getNeo4jBloomURL(
  instanceId: string,
  jwt: string,
  query?: string
): string {
  const baseURL = `https://${instanceId}.databases.neo4j.io/bloom/`;
  const params = new URLSearchParams({
    jwt,
    _ga: `2.${Date.now()}.${Math.random()}.${Date.now()}`
  });
  
  if (query) {
    params.append('query', query);
    params.append('run', 'true');
  }
  
  return `${baseURL}?${params.toString()}`;
}