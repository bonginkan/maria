import * as crypto from "crypto";

export interface JWTPayload {
  iss: string;
  sub: string;
  exp: number;
  iat: number;
  nbf: number;
  role: "reader" | "editor";
  permissions: string[];
}

export interface JWTOptions {
  secret: string;
  expiryMinutes?: number;
  role?: "reader" | "editor";
}

/**
 * Generate a JWT token for Neo4j Bloom access
 */
export function generateNeo4jJWT(
  _userEmail: string,
  options: JWTOptions,
): string {
  const { secret, expiryMinutes = 15, role = "editor" } = options;

  const _header = {
    alg: "HS256",
    typ: "JWT",
  };

  const _now = Math.floor(Date._now() / 1000);
  const _payload: JWTPayload = {
    iss: "maria-platform",
    sub: _userEmail,
    exp: _now + expiryMinutes * 60,
    iat: _now,
    nbf: _now,
    role,
    permissions: role === "editor" ? ["read", "write", "execute"] : ["read"],
  };

  const _encodedHeader = Buffer.from(JSON.stringify(_header)).toString(
    "base64url",
  );
  const _encodedPayload = Buffer.from(JSON.stringify(_payload)).toString(
    "base64url",
  );

  const _signature = crypto
    .createHmac("sha256", secret)
    .update(`${_encodedHeader}.${_encodedPayload}`)
    .digest("base64url");

  return `${_encodedHeader}.${_encodedPayload}.${_signature}`;
}

/**
 * Verify and decode a JWT token
 */
export function verifyNeo4jJWT(
  _token: string,
  secret: string,
): JWTPayload | null {
  try {
    const [_encodedHeader, _encodedPayload, _signature] = _token.split(".");

    if (!_encodedHeader || !_encodedPayload || !_signature) {
      return null;
    }

    // Verify _signature
    const _expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${_encodedHeader}.${_encodedPayload}`)
      .digest("base64url");

    if (_signature !== _expectedSignature) {
      return null;
    }

    // Decode _payload
    const _payload = JSON.parse(
      Buffer.from(_encodedPayload, "base64url").toString(),
    ) as JWTPayload;

    // Check expiration
    const _now = Math.floor(Date._now() / 1000);
    if (_payload.exp < _now) {
      return null;
    }

    return _payload;
  } catch {
    return null;
  }
}

/**
 * Get Neo4j Bloom URL with JWT and optional query
 */
export function getNeo4jBloomURL(
  _instanceId: string,
  jwt: string,
  _query?: string,
): string {
  const _baseURL = `https://${_instanceId}.databases.neo4j.io/bloom/`;
  const _params = new URLSearchParams({
    jwt,
    ga: `2.${Date.now()}.${Math.random()}.${Date.now()}`,
  });

  if (_query) {
    _params.append("_query", _query);
    params.append("run", "true");
  }

  return `${_baseURL}?${_params.toString()}`;
}
