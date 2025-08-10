// src/utils/jwt.ts
import * as crypto from "crypto";
function generateNeo4jJWT(userEmail, options) {
  const { secret, expiryMinutes = 15, role = "editor" } = options;
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const now = Math.floor(Date.now() / 1e3);
  const payload = {
    iss: "maria-platform",
    sub: userEmail,
    exp: now + expiryMinutes * 60,
    iat: now,
    nbf: now,
    role,
    permissions: role === "editor" ? ["read", "write", "execute"] : ["read"]
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
function verifyNeo4jJWT(token, secret) {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !signature) {
      return null;
    }
    const expectedSignature = crypto.createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
    if (signature !== expectedSignature) {
      return null;
    }
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString()
    );
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
function getNeo4jBloomURL(instanceId, jwt, query) {
  const baseURL = `https://${instanceId}.databases.neo4j.io/bloom/`;
  const params = new URLSearchParams({
    jwt,
    _ga: `2.${Date.now()}.${Math.random()}.${Date.now()}`
  });
  if (query) {
    params.append("query", query);
    params.append("run", "true");
  }
  return `${baseURL}?${params.toString()}`;
}
export {
  generateNeo4jJWT,
  getNeo4jBloomURL,
  verifyNeo4jJWT
};
//# sourceMappingURL=index.js.map