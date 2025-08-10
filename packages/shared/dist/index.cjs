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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ActivitySchema: () => ActivitySchema,
  COLLECTIONS: () => COLLECTIONS,
  ChatSessionSchema: () => ChatSessionSchema,
  ExecutionStepSchema: () => ExecutionStepSchema,
  ProjectSchema: () => ProjectSchema,
  ProjectStatusSchema: () => ProjectStatusSchema,
  ProjectTypeSchema: () => ProjectTypeSchema,
  RTFStructureSchema: () => RTFStructureSchema,
  RTFTaskSchema: () => RTFTaskSchema,
  SOWDocumentSchema: () => SOWDocumentSchema,
  TaskPlanSchema: () => TaskPlanSchema,
  UserProfileSchema: () => UserProfileSchema,
  generateNeo4jJWT: () => generateNeo4jJWT,
  getNeo4jBloomURL: () => getNeo4jBloomURL,
  verifyNeo4jJWT: () => verifyNeo4jJWT
});
module.exports = __toCommonJS(index_exports);

// src/types/firestore.ts
var import_zod = require("zod");
var ProjectTypeSchema = import_zod.z.enum(["PAPER", "SLIDE", "DEVOPS"]);
var ProjectStatusSchema = import_zod.z.enum(["DRAFT", "BUILDING", "DONE"]);
var ProjectSchema = import_zod.z.object({
  id: import_zod.z.string(),
  type: ProjectTypeSchema,
  status: ProjectStatusSchema,
  ownerUid: import_zod.z.string(),
  title: import_zod.z.string(),
  description: import_zod.z.string().optional(),
  tags: import_zod.z.array(import_zod.z.string()).default([]),
  createdAt: import_zod.z.date(),
  updatedAt: import_zod.z.date(),
  settings: import_zod.z.object({
    isPublic: import_zod.z.boolean().default(false),
    collaborators: import_zod.z.array(import_zod.z.string()).default([]),
    autoSave: import_zod.z.boolean().default(true)
  }).optional()
});
var UserProfileSchema = import_zod.z.object({
  uid: import_zod.z.string(),
  email: import_zod.z.string().email(),
  displayName: import_zod.z.string(),
  photoURL: import_zod.z.string().url().optional(),
  role: import_zod.z.enum(["user", "admin"]).default("user"),
  createdAt: import_zod.z.date(),
  updatedAt: import_zod.z.date(),
  preferences: import_zod.z.object({
    theme: import_zod.z.enum(["light", "dark", "system"]).default("system"),
    language: import_zod.z.string().default("en"),
    notifications: import_zod.z.object({
      email: import_zod.z.boolean().default(true),
      push: import_zod.z.boolean().default(true)
    })
  }).optional()
});
var ActivitySchema = import_zod.z.object({
  id: import_zod.z.string(),
  projectId: import_zod.z.string(),
  userId: import_zod.z.string(),
  action: import_zod.z.enum(["created", "updated", "deleted", "shared", "deployed"]),
  targetType: import_zod.z.enum(["project", "file", "deployment"]),
  targetId: import_zod.z.string(),
  metadata: import_zod.z.record(import_zod.z.unknown()).optional(),
  timestamp: import_zod.z.date()
});
var ChatSessionSchema = import_zod.z.object({
  id: import_zod.z.string(),
  projectId: import_zod.z.string(),
  userId: import_zod.z.string(),
  messages: import_zod.z.array(import_zod.z.object({
    id: import_zod.z.string(),
    role: import_zod.z.enum(["user", "assistant", "system"]),
    content: import_zod.z.string(),
    timestamp: import_zod.z.date(),
    metadata: import_zod.z.object({
      model: import_zod.z.string().optional(),
      tokens: import_zod.z.number().optional(),
      citations: import_zod.z.array(import_zod.z.string()).optional()
    }).optional()
  })),
  createdAt: import_zod.z.date(),
  updatedAt: import_zod.z.date()
});
var COLLECTIONS = {
  PROJECTS: "projects",
  USERS: "users",
  ACTIVITIES: "activities",
  CHAT_SESSIONS: "chat_sessions"
};

// src/types/conversation.ts
var import_zod2 = require("zod");
var RTFTaskSchema = import_zod2.z.object({
  type: import_zod2.z.enum(["paper", "presentation", "project", "code", "analysis", "general"]),
  intent: import_zod2.z.string(),
  description: import_zod2.z.string(),
  scope: import_zod2.z.enum(["single-action", "multi-step", "iterative", "collaborative"]),
  priority: import_zod2.z.enum(["low", "medium", "high", "urgent"]),
  requirements: import_zod2.z.array(import_zod2.z.string()),
  constraints: import_zod2.z.array(import_zod2.z.string()),
  dependencies: import_zod2.z.array(import_zod2.z.string()),
  expectedOutcome: import_zod2.z.string()
});
var RTFStructureSchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  fileName: import_zod2.z.string(),
  extractedContent: import_zod2.z.string(),
  role: import_zod2.z.string(),
  task: RTFTaskSchema,
  format: import_zod2.z.record(import_zod2.z.any()),
  confidence: import_zod2.z.number().min(0).max(1),
  metadata: import_zod2.z.record(import_zod2.z.any())
});
var ExecutionStepSchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  name: import_zod2.z.string(),
  description: import_zod2.z.string(),
  type: import_zod2.z.enum(["research", "analysis", "creation", "review", "communication"]),
  estimatedTime: import_zod2.z.number(),
  prerequisites: import_zod2.z.array(import_zod2.z.string()),
  deliverables: import_zod2.z.array(import_zod2.z.string()),
  status: import_zod2.z.enum(["pending", "running", "completed", "failed", "blocked"])
});
var SOWDocumentSchema = import_zod2.z.object({
  projectName: import_zod2.z.string(),
  overview: import_zod2.z.string(),
  objectives: import_zod2.z.array(import_zod2.z.string()),
  deliverables: import_zod2.z.array(import_zod2.z.string()),
  timeline: import_zod2.z.object({
    startDate: import_zod2.z.string(),
    endDate: import_zod2.z.string(),
    milestones: import_zod2.z.array(import_zod2.z.object({
      name: import_zod2.z.string(),
      date: import_zod2.z.string(),
      deliverables: import_zod2.z.array(import_zod2.z.string())
    }))
  }),
  estimatedCost: import_zod2.z.number(),
  resources: import_zod2.z.array(import_zod2.z.object({
    role: import_zod2.z.string(),
    allocation: import_zod2.z.number(),
    skills: import_zod2.z.array(import_zod2.z.string())
  }))
});
var TaskPlanSchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  title: import_zod2.z.string(),
  description: import_zod2.z.string(),
  rtfStructure: RTFStructureSchema,
  sowDocument: SOWDocumentSchema.optional(),
  executionPlan: import_zod2.z.array(ExecutionStepSchema),
  status: import_zod2.z.enum(["draft", "approved", "in-progress", "completed", "cancelled"]),
  createdAt: import_zod2.z.date(),
  updatedAt: import_zod2.z.date()
});

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
  ActivitySchema,
  COLLECTIONS,
  ChatSessionSchema,
  ExecutionStepSchema,
  ProjectSchema,
  ProjectStatusSchema,
  ProjectTypeSchema,
  RTFStructureSchema,
  RTFTaskSchema,
  SOWDocumentSchema,
  TaskPlanSchema,
  UserProfileSchema,
  generateNeo4jJWT,
  getNeo4jBloomURL,
  verifyNeo4jJWT
});
//# sourceMappingURL=index.cjs.map