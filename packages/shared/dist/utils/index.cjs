var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/index.ts
var utils_exports = {};
__export(utils_exports, {
  generateNeo4jJWT: () => generateNeo4jJWT,
  getNeo4jBloomURL: () => getNeo4jBloomURL,
  verifyNeo4jJWT: () => verifyNeo4jJWT
});
module.exports = __toCommonJS(utils_exports);

// src/utils/jwt.ts
var crypto = __toESM(require("crypto"), 1);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateNeo4jJWT,
  getNeo4jBloomURL,
  verifyNeo4jJWT
});
//# sourceMappingURL=index.cjs.map