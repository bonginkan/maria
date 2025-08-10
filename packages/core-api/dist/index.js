// src/index.ts
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Logging as Logging2 } from "@google-cloud/logging";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// src/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getAuth } from "firebase-admin/auth";
import { Firestore } from "@google-cloud/firestore";
var firestore = new Firestore({
  projectId: process.env.MARIA_PROJECT_ID || "maria-code"
});
var createContext = async ({
  req,
  res
}) => {
  const authHeader = req.headers.authorization;
  let user;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      const userDoc = await firestore.collection("users").doc(decodedToken.uid).get();
      const userData = userDoc.data();
      user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: userData?.role || "viewer",
        emailVerified: decodedToken.email_verified || false
      };
    } catch {
    }
  }
  return {
    req,
    res,
    user,
    firestore
  };
};
var t = initTRPC.context().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null
      }
    };
  }
});
var router = t.router;
var procedure = t.procedure;
var publicProcedure = procedure;
var isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required"
    });
  }
  const authenticatedCtx = {
    ...ctx,
    user: ctx.user
  };
  return next({
    ctx: authenticatedCtx
  });
});
var hasRole = (requiredRole) => t.middleware(({ ctx, next }) => {
  const user = ctx.user;
  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required"
    });
  }
  const roleHierarchy = {
    viewer: 1,
    editor: 2,
    admin: 3
  };
  const userRole = user.role;
  const userRoleLevel = userRole ? roleHierarchy[userRole] : 0;
  const requiredRoleLevel = roleHierarchy[requiredRole] || 999;
  if (!userRole || !userRoleLevel || userRoleLevel < requiredRoleLevel) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${requiredRole} role required`
    });
  }
  return next({
    ctx
  });
});
var isEmailVerified = t.middleware(({ ctx, next }) => {
  const user = ctx.user;
  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required"
    });
  }
  if (!user.emailVerified) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Email verification required"
    });
  }
  return next({
    ctx
  });
});
var authenticatedProcedure = procedure.use(isAuthenticated);
var protectedProcedure = authenticatedProcedure;
var adminProcedure = authenticatedProcedure.use(hasRole("admin"));
var editorProcedure = authenticatedProcedure.use(hasRole("editor"));
var verifiedProcedure = authenticatedProcedure.use(isEmailVerified);
var createCallerFactory = t.createCallerFactory;
var createErrorHandler = (operation) => (error) => {
  if (error instanceof TRPCError) {
    throw error;
  }
  if (error instanceof Error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `${operation} failed: ${error.message}`
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `${operation} failed with unknown error`
  });
};
var requestCounts = /* @__PURE__ */ new Map();
var rateLimit = (requests = 100, windowMs = 15 * 60 * 1e3) => t.middleware(({ ctx, next }) => {
  const key = ctx.user?.uid || ctx.req.ip || "anonymous";
  const now = Date.now();
  const windowStart = now - windowMs;
  const current = requestCounts.get(key);
  if (!current || current.resetTime < windowStart) {
    requestCounts.set(key, { count: 1, resetTime: now + windowMs });
    return next();
  }
  if (current.count >= requests) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded"
    });
  }
  current.count++;
  return next();
});
var withLogging = t.middleware(async ({ next }) => {
  const result = await next();
  return result;
});
var devProcedure = process.env.NODE_ENV === "development" ? procedure.use(withLogging) : procedure;

// src/routers/auth.ts
import { z } from "zod";
import { TRPCError as TRPCError2 } from "@trpc/server";
var updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  bio: z.string().optional(),
  preferences: z.object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    language: z.string().optional(),
    fontSize: z.enum(["small", "medium", "large"]).optional(),
    autoSave: z.boolean().optional(),
    autoSaveInterval: z.number().min(10).max(300).optional(),
    notifications: z.object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      mentions: z.boolean().optional(),
      updates: z.boolean().optional()
    }).optional()
  }).optional(),
  privacy: z.object({
    profileVisibility: z.enum(["public", "private", "team"]).optional(),
    activityStatus: z.boolean().optional(),
    showEmail: z.boolean().optional()
  }).optional(),
  integrations: z.object({
    googleSlides: z.object({
      enabled: z.boolean().optional(),
      autoSync: z.boolean().optional()
    }).optional(),
    github: z.object({
      enabled: z.boolean().optional(),
      username: z.string().optional()
    }).optional(),
    neo4j: z.object({
      enabled: z.boolean().optional(),
      instanceId: z.string().optional()
    }).optional()
  }).optional()
});
var userSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["admin", "editor", "viewer"]),
  emailVerified: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  bio: z.string().optional(),
  avatar: z.string().optional(),
  preferences: z.object({
    theme: z.enum(["light", "dark", "system"]),
    language: z.string(),
    fontSize: z.enum(["small", "medium", "large"]),
    autoSave: z.boolean(),
    autoSaveInterval: z.number(),
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean(),
      mentions: z.boolean(),
      updates: z.boolean()
    })
  }),
  privacy: z.object({
    profileVisibility: z.enum(["public", "private", "team"]),
    activityStatus: z.boolean(),
    showEmail: z.boolean()
  }),
  integrations: z.object({
    googleSlides: z.object({
      enabled: z.boolean(),
      autoSync: z.boolean()
    }),
    github: z.object({
      enabled: z.boolean(),
      username: z.string()
    }),
    neo4j: z.object({
      enabled: z.boolean(),
      instanceId: z.string()
    })
  })
});
var authRouter = router({
  // Get current user profile
  me: protectedProcedure.output(userSchema).query(async ({ ctx }) => {
    try {
      const userDoc = await ctx.firestore.collection("users").doc(ctx.user.uid).get();
      if (!userDoc.exists) {
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "User profile not found"
        });
      }
      const userData = userDoc.data();
      return {
        uid: ctx.user.uid,
        email: ctx.user.email,
        name: userData.name,
        role: ctx.user.role,
        emailVerified: ctx.user.emailVerified,
        createdAt: userData.createdAt?.toDate() || /* @__PURE__ */ new Date(),
        updatedAt: userData.updatedAt?.toDate() || /* @__PURE__ */ new Date(),
        bio: userData.bio,
        avatar: userData.avatar,
        preferences: {
          theme: userData.preferences?.theme || "system",
          language: userData.preferences?.language || "en",
          fontSize: userData.preferences?.fontSize || "medium",
          autoSave: userData.preferences?.autoSave ?? true,
          autoSaveInterval: userData.preferences?.autoSaveInterval || 30,
          notifications: {
            email: userData.preferences?.notifications?.email ?? true,
            push: userData.preferences?.notifications?.push ?? true,
            mentions: userData.preferences?.notifications?.mentions ?? true,
            updates: userData.preferences?.notifications?.updates ?? false
          }
        },
        privacy: {
          profileVisibility: userData.privacy?.profileVisibility || "team",
          activityStatus: userData.privacy?.activityStatus ?? true,
          showEmail: userData.privacy?.showEmail ?? false
        },
        integrations: {
          googleSlides: {
            enabled: userData.integrations?.googleSlides?.enabled ?? false,
            autoSync: userData.integrations?.googleSlides?.autoSync ?? false
          },
          github: {
            enabled: userData.integrations?.github?.enabled ?? false,
            username: userData.integrations?.github?.username || ""
          },
          neo4j: {
            enabled: userData.integrations?.neo4j?.enabled ?? true,
            instanceId: userData.integrations?.neo4j?.instanceId || "4234c1a0"
          }
        }
      };
    } catch (error) {
      throw createErrorHandler("Get user profile")(error);
    }
  }),
  // Update user profile
  updateProfile: protectedProcedure.input(updateProfileSchema).output(userSchema).mutation(async ({ ctx, input }) => {
    try {
      const userRef = ctx.firestore.collection("users").doc(ctx.user.uid);
      const updateData = {
        updatedAt: /* @__PURE__ */ new Date()
      };
      if (input.name) updateData.name = input.name;
      if (input.bio !== void 0) updateData.bio = input.bio;
      if (input.preferences) {
        updateData.preferences = input.preferences;
      }
      if (input.privacy) {
        updateData.privacy = input.privacy;
      }
      if (input.integrations) {
        updateData.integrations = input.integrations;
      }
      await userRef.update(updateData);
      const updatedDoc = await userRef.get();
      const userData = updatedDoc.data();
      return {
        uid: ctx.user.uid,
        email: ctx.user.email,
        name: userData.name,
        role: ctx.user.role,
        emailVerified: ctx.user.emailVerified,
        createdAt: userData.createdAt?.toDate() || /* @__PURE__ */ new Date(),
        updatedAt: userData.updatedAt?.toDate() || /* @__PURE__ */ new Date(),
        bio: userData.bio,
        avatar: userData.avatar,
        preferences: {
          theme: userData.preferences?.theme || "system",
          language: userData.preferences?.language || "en",
          fontSize: userData.preferences?.fontSize || "medium",
          autoSave: userData.preferences?.autoSave ?? true,
          autoSaveInterval: userData.preferences?.autoSaveInterval || 30,
          notifications: {
            email: userData.preferences?.notifications?.email ?? true,
            push: userData.preferences?.notifications?.push ?? true,
            mentions: userData.preferences?.notifications?.mentions ?? true,
            updates: userData.preferences?.notifications?.updates ?? false
          }
        },
        privacy: {
          profileVisibility: userData.privacy?.profileVisibility || "team",
          activityStatus: userData.privacy?.activityStatus ?? true,
          showEmail: userData.privacy?.showEmail ?? false
        },
        integrations: {
          googleSlides: {
            enabled: userData.integrations?.googleSlides?.enabled ?? false,
            autoSync: userData.integrations?.googleSlides?.autoSync ?? false
          },
          github: {
            enabled: userData.integrations?.github?.enabled ?? false,
            username: userData.integrations?.github?.username || ""
          },
          neo4j: {
            enabled: userData.integrations?.neo4j?.enabled ?? true,
            instanceId: userData.integrations?.neo4j?.instanceId || "4234c1a0"
          }
        }
      };
    } catch (error) {
      throw createErrorHandler("Update profile")(error);
    }
  }),
  // Get user activity status
  getActivityStatus: protectedProcedure.output(z.object({
    isOnline: z.boolean(),
    lastSeen: z.date(),
    currentProject: z.string().optional()
  })).query(async ({ ctx }) => {
    try {
      const activityDoc = await ctx.firestore.collection("user_activity").doc(ctx.user.uid).get();
      if (!activityDoc.exists) {
        return {
          isOnline: false,
          lastSeen: /* @__PURE__ */ new Date(),
          currentProject: void 0
        };
      }
      const activityData = activityDoc.data();
      const lastSeen = activityData.lastSeen?.toDate() || /* @__PURE__ */ new Date();
      const isOnline = Date.now() - lastSeen.getTime() < 5 * 60 * 1e3;
      return {
        isOnline,
        lastSeen,
        currentProject: activityData.currentProject
      };
    } catch (error) {
      throw createErrorHandler("Get activity status")(error);
    }
  }),
  // Update activity status
  updateActivity: protectedProcedure.input(z.object({
    currentProject: z.string().optional()
  })).mutation(async ({ ctx, input }) => {
    try {
      await ctx.firestore.collection("user_activity").doc(ctx.user.uid).set({
        lastSeen: /* @__PURE__ */ new Date(),
        currentProject: input.currentProject
      }, { merge: true });
      return { success: true };
    } catch (error) {
      throw createErrorHandler("Update activity")(error);
    }
  }),
  // List team members (for collaboration features)
  getTeamMembers: protectedProcedure.output(z.array(z.object({
    uid: z.string(),
    name: z.string(),
    email: z.string().optional(),
    role: z.enum(["admin", "editor", "viewer"]),
    isOnline: z.boolean(),
    lastSeen: z.date()
  }))).query(async ({ ctx }) => {
    try {
      const usersSnapshot = await ctx.firestore.collection("users").where("privacy.profileVisibility", "in", ["public", "team"]).limit(50).get();
      const teamMembers = await Promise.all(
        usersSnapshot.docs.map(async (doc) => {
          const userData = doc.data();
          const activityDoc = await ctx.firestore.collection("user_activity").doc(doc.id).get();
          const activityData = activityDoc.data();
          const lastSeen = activityData?.lastSeen?.toDate() || /* @__PURE__ */ new Date(0);
          const isOnline = Date.now() - lastSeen.getTime() < 5 * 60 * 1e3;
          return {
            uid: doc.id,
            name: userData.name,
            email: userData.privacy?.showEmail ? userData.email : void 0,
            role: userData.role,
            isOnline,
            lastSeen
          };
        })
      );
      return teamMembers;
    } catch (error) {
      throw createErrorHandler("Get team members")(error);
    }
  }),
  // Alias for compatibility with tests
  getProfile: protectedProcedure.output(userSchema).query(async ({ ctx }) => {
    try {
      const userDoc = await ctx.firestore.collection("users").doc(ctx.user.uid).get();
      if (!userDoc.exists) {
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "User profile not found"
        });
      }
      const userData = userDoc.data();
      return {
        uid: ctx.user.uid,
        email: ctx.user.email,
        name: userData.name,
        role: ctx.user.role,
        emailVerified: ctx.user.emailVerified,
        createdAt: userData.createdAt?.toDate() || /* @__PURE__ */ new Date(),
        updatedAt: userData.updatedAt?.toDate() || /* @__PURE__ */ new Date(),
        bio: userData.bio,
        avatar: userData.avatar,
        preferences: {
          theme: userData.preferences?.theme || "system",
          language: userData.preferences?.language || "en",
          fontSize: userData.preferences?.fontSize || "medium",
          autoSave: userData.preferences?.autoSave ?? true,
          autoSaveInterval: userData.preferences?.autoSaveInterval || 30,
          notifications: {
            email: userData.preferences?.notifications?.email ?? true,
            push: userData.preferences?.notifications?.push ?? true,
            mentions: userData.preferences?.notifications?.mentions ?? true,
            updates: userData.preferences?.notifications?.updates ?? false
          }
        },
        privacy: {
          profileVisibility: userData.privacy?.profileVisibility || "team",
          activityStatus: userData.privacy?.activityStatus ?? true,
          showEmail: userData.privacy?.showEmail ?? false
        },
        integrations: {
          googleSlides: {
            enabled: userData.integrations?.googleSlides?.enabled ?? false,
            autoSync: userData.integrations?.googleSlides?.autoSync ?? false
          },
          github: {
            enabled: userData.integrations?.github?.enabled ?? false,
            username: userData.integrations?.github?.username || ""
          },
          neo4j: {
            enabled: userData.integrations?.neo4j?.enabled ?? true,
            instanceId: userData.integrations?.neo4j?.instanceId || "4234c1a0"
          }
        }
      };
    } catch (error) {
      throw createErrorHandler("Get user profile")(error);
    }
  }),
  // Get user settings (alias for profile preferences)
  getSettings: protectedProcedure.output(z.object({
    theme: z.enum(["light", "dark", "system"]),
    language: z.string(),
    fontSize: z.enum(["small", "medium", "large"]),
    autoSave: z.boolean(),
    autoSaveInterval: z.number(),
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean(),
      mentions: z.boolean(),
      updates: z.boolean()
    })
  })).query(async ({ ctx }) => {
    try {
      const userDoc = await ctx.firestore.collection("users").doc(ctx.user.uid).get();
      if (!userDoc.exists) {
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "User settings not found"
        });
      }
      const userData = userDoc.data();
      return {
        theme: userData.preferences?.theme || "system",
        language: userData.preferences?.language || "en",
        fontSize: userData.preferences?.fontSize || "medium",
        autoSave: userData.preferences?.autoSave ?? true,
        autoSaveInterval: userData.preferences?.autoSaveInterval || 30,
        notifications: {
          email: userData.preferences?.notifications?.email ?? true,
          push: userData.preferences?.notifications?.push ?? true,
          mentions: userData.preferences?.notifications?.mentions ?? true,
          updates: userData.preferences?.notifications?.updates ?? false
        }
      };
    } catch (error) {
      throw createErrorHandler("Get user settings")(error);
    }
  })
});

// src/routers/maria-auth.ts
import { z as z3 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";

// src/lib/maria-auth.ts
import { z as z2 } from "zod";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
var PlanType = z2.enum(["free", "pro", "max"]);
var UserPlanSchema = z2.object({
  type: PlanType,
  limits: z2.object({
    dailyRequests: z2.number(),
    monthlyRequests: z2.number(),
    maxProjects: z2.number(),
    maxCollaborators: z2.number(),
    cpuLimitCores: z2.number(),
    memoryLimitMB: z2.number(),
    storageLimitMB: z2.number(),
    aiModelAccess: z2.array(z2.string())
  }),
  features: z2.object({
    priority: z2.enum(["low", "medium", "high"]),
    support: z2.enum(["community", "email", "24h"]),
    analytics: z2.boolean(),
    customBranding: z2.boolean(),
    apiAccess: z2.boolean(),
    advancedIntegrations: z2.boolean()
  })
});
var CreateUserSchema = z2.object({
  email: z2.string().email(),
  password: z2.string().min(8),
  name: z2.string().min(1),
  plan: PlanType.optional().default("free")
});
var LoginSchema = z2.object({
  email: z2.string().email(),
  password: z2.string()
});
var UserSessionSchema = z2.object({
  uid: z2.string(),
  email: z2.string(),
  name: z2.string(),
  plan: UserPlanSchema,
  usage: z2.object({
    dailyRequests: z2.number(),
    monthlyRequests: z2.number(),
    lastReset: z2.string()
    // ISO date
  }),
  createdAt: z2.string(),
  lastLoginAt: z2.string(),
  isEmailVerified: z2.boolean(),
  mfaEnabled: z2.boolean()
});
var PLAN_DEFINITIONS = {
  free: {
    type: "free",
    limits: {
      dailyRequests: 50,
      monthlyRequests: 1e3,
      maxProjects: 3,
      maxCollaborators: 2,
      cpuLimitCores: 0.5,
      memoryLimitMB: 512,
      storageLimitMB: 100,
      aiModelAccess: ["gemini-2.5-pro-preview"]
    },
    features: {
      priority: "low",
      support: "community",
      analytics: false,
      customBranding: false,
      apiAccess: false,
      advancedIntegrations: false
    }
  },
  pro: {
    type: "pro",
    limits: {
      dailyRequests: 500,
      monthlyRequests: 1e4,
      maxProjects: 25,
      maxCollaborators: 10,
      cpuLimitCores: 2,
      memoryLimitMB: 2048,
      storageLimitMB: 1e3,
      aiModelAccess: ["gemini-2.5-pro-preview", "grok-4-latest"]
    },
    features: {
      priority: "medium",
      support: "email",
      analytics: true,
      customBranding: false,
      apiAccess: true,
      advancedIntegrations: true
    }
  },
  max: {
    type: "max",
    limits: {
      dailyRequests: 2e3,
      monthlyRequests: 5e4,
      maxProjects: 100,
      maxCollaborators: 50,
      cpuLimitCores: 8,
      memoryLimitMB: 8192,
      storageLimitMB: 1e4,
      aiModelAccess: ["gemini-2.5-pro-preview", "grok-4-latest"]
    },
    features: {
      priority: "high",
      support: "24h",
      analytics: true,
      customBranding: true,
      apiAccess: true,
      advancedIntegrations: true
    }
  }
};
var AuthStore = class {
  users = /* @__PURE__ */ new Map();
  sessions = /* @__PURE__ */ new Map();
  // User management
  async createUser(data) {
    const uid = this.generateId();
    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = {
      uid,
      email: data.email.toLowerCase(),
      name: data.name,
      password: hashedPassword,
      plan: PLAN_DEFINITIONS[data.plan],
      usage: {
        dailyRequests: 0,
        monthlyRequests: 0,
        lastReset: (/* @__PURE__ */ new Date()).toISOString()
      },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastLoginAt: (/* @__PURE__ */ new Date()).toISOString(),
      isEmailVerified: false,
      mfaEnabled: false
    };
    this.users.set(uid, user);
    return { uid, email: user.email, name: user.name };
  }
  async getUserByEmail(email) {
    for (const [uid, user] of this.users) {
      if (user.email === email.toLowerCase()) {
        return { uid, ...user };
      }
    }
    return null;
  }
  async getUserById(uid) {
    return this.users.get(uid) || null;
  }
  async updateUser(uid, updates) {
    const user = this.users.get(uid);
    if (!user) return null;
    const updatedUser = { ...user, ...updates };
    this.users.set(uid, updatedUser);
    return updatedUser;
  }
  // Session management
  async createSession(uid) {
    const user = await this.getUserById(uid);
    if (!user) throw new Error("User not found");
    const sessionToken = this.generateToken();
    const session = {
      uid: user.uid,
      email: user.email,
      name: user.name,
      plan: user.plan,
      usage: user.usage,
      createdAt: user.createdAt,
      lastLoginAt: (/* @__PURE__ */ new Date()).toISOString(),
      isEmailVerified: user.isEmailVerified,
      mfaEnabled: user.mfaEnabled
    };
    this.sessions.set(sessionToken, session);
    await this.updateUser(uid, { lastLoginAt: session.lastLoginAt });
    return sessionToken;
  }
  async getSession(token) {
    return this.sessions.get(token) || null;
  }
  async destroySession(token) {
    return this.sessions.delete(token);
  }
  // Usage tracking
  async incrementUsage(uid, type = "daily") {
    const user = await this.getUserById(uid);
    if (!user) return null;
    const now = /* @__PURE__ */ new Date();
    const lastReset = new Date(user.usage.lastReset);
    if (type === "daily" && now.getDate() !== lastReset.getDate()) {
      user.usage.dailyRequests = 0;
    }
    if (type === "monthly" && now.getMonth() !== lastReset.getMonth()) {
      user.usage.monthlyRequests = 0;
    }
    user.usage.dailyRequests += 1;
    user.usage.monthlyRequests += 1;
    user.usage.lastReset = now.toISOString();
    await this.updateUser(uid, { usage: user.usage });
    return user.usage;
  }
  // Utility methods
  generateId() {
    return randomBytes(16).toString("hex");
  }
  generateToken() {
    return randomBytes(32).toString("hex");
  }
  // Development helper: get all users
  getAllUsers() {
    return Array.from(this.users.entries()).map(([uid, user]) => ({
      uid,
      email: user.email,
      name: user.name,
      plan: user.plan.type,
      usage: user.usage,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    }));
  }
};
var authStore = new AuthStore();
var MariaAuthService = class {
  // User registration
  async register(data) {
    const existingUser = await authStore.getUserByEmail(data.email);
    if (existingUser) {
      throw new Error("User already exists with this email");
    }
    const user = await authStore.createUser(data);
    const sessionToken = await authStore.createSession(user.uid);
    return {
      user,
      sessionToken,
      message: "User registered successfully"
    };
  }
  // User login
  async login(data) {
    const user = await authStore.getUserByEmail(data.email);
    if (!user) {
      throw new Error("Invalid email or password");
    }
    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) {
      throw new Error("Invalid email or password");
    }
    const sessionToken = await authStore.createSession(user.uid);
    return {
      user: {
        uid: user.uid,
        email: user.email,
        name: user.name,
        plan: user.plan.type
      },
      sessionToken,
      message: "Login successful"
    };
  }
  // Get user session
  async getSession(token) {
    const session = await authStore.getSession(token);
    if (!session) {
      throw new Error("Invalid or expired session");
    }
    return session;
  }
  // Logout
  async logout(token) {
    const destroyed = await authStore.destroySession(token);
    return {
      success: destroyed,
      message: destroyed ? "Logout successful" : "Session not found"
    };
  }
  // Check resource limits
  async checkLimits(uid, resource) {
    const user = await authStore.getUserById(uid);
    if (!user) throw new Error("User not found");
    const limit = user.plan.limits[resource];
    const usage = user.usage;
    switch (resource) {
      case "dailyRequests":
        return usage.dailyRequests < limit;
      case "monthlyRequests":
        return usage.monthlyRequests < limit;
      default:
        return true;
    }
  }
  // Increment usage
  async trackUsage(uid) {
    return await authStore.incrementUsage(uid);
  }
  // Get plan info
  getPlanInfo(planType) {
    return PLAN_DEFINITIONS[planType];
  }
  // Development helper
  getAllUsers() {
    return authStore.getAllUsers();
  }
};
var mariaAuth = new MariaAuthService();

// src/routers/maria-auth.ts
var withSession = publicProcedure.use(async ({ next, ctx }) => {
  const token = ctx.req?.headers?.authorization?.replace("Bearer ", "");
  if (!token) {
    throw new TRPCError3({
      code: "UNAUTHORIZED",
      message: "Session token required"
    });
  }
  try {
    const session = await mariaAuth.getSession(token);
    return next({
      ctx: {
        ...ctx,
        session,
        user: {
          uid: session.uid,
          email: session.email,
          name: session.name,
          plan: session.plan
        }
      }
    });
  } catch {
    throw new TRPCError3({
      code: "UNAUTHORIZED",
      message: "Invalid or expired session"
    });
  }
});
var mariaAuthRouter = router({
  // User registration
  register: publicProcedure.input(CreateUserSchema).mutation(async ({ input }) => {
    try {
      const result = await mariaAuth.register(input);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      throw new TRPCError3({
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : "Registration failed"
      });
    }
  }),
  // User login
  login: publicProcedure.input(LoginSchema).mutation(async ({ input }) => {
    try {
      const result = await mariaAuth.login(input);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      throw new TRPCError3({
        code: "UNAUTHORIZED",
        message: error instanceof Error ? error.message : "Login failed"
      });
    }
  }),
  // Get current user session
  getSession: withSession.query(async ({ ctx }) => {
    return {
      success: true,
      data: ctx.session
    };
  }),
  // Logout
  logout: withSession.mutation(async ({ ctx }) => {
    const token = ctx.req?.headers?.authorization?.replace("Bearer ", "");
    if (!token) {
      throw new TRPCError3({
        code: "BAD_REQUEST",
        message: "No session token provided"
      });
    }
    try {
      const result = await mariaAuth.logout(token);
      return {
        success: true,
        data: result
      };
    } catch {
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Logout failed"
      });
    }
  }),
  // Get user profile
  getProfile: withSession.query(async ({ ctx }) => {
    return {
      success: true,
      data: {
        uid: ctx.session.uid,
        email: ctx.session.email,
        name: ctx.session.name,
        plan: ctx.session.plan,
        usage: ctx.session.usage,
        createdAt: ctx.session.createdAt,
        lastLoginAt: ctx.session.lastLoginAt,
        isEmailVerified: ctx.session.isEmailVerified,
        mfaEnabled: ctx.session.mfaEnabled
      }
    };
  }),
  // Get plan information
  getPlanInfo: publicProcedure.input(z3.object({ planType: PlanType })).query(async ({ input }) => {
    const planInfo = mariaAuth.getPlanInfo(input.planType);
    return {
      success: true,
      data: planInfo
    };
  }),
  // Get all plans
  getAllPlans: publicProcedure.query(async () => {
    return {
      success: true,
      data: PLAN_DEFINITIONS
    };
  }),
  // Check usage limits
  checkLimits: withSession.query(async ({ ctx }) => {
    try {
      const dailyOk = await mariaAuth.checkLimits(ctx.session.uid, "dailyRequests");
      const monthlyOk = await mariaAuth.checkLimits(ctx.session.uid, "monthlyRequests");
      return {
        success: true,
        data: {
          canMakeRequest: dailyOk && monthlyOk,
          limits: {
            daily: {
              current: ctx.session.usage.dailyRequests,
              limit: ctx.session.plan.limits.dailyRequests,
              available: dailyOk
            },
            monthly: {
              current: ctx.session.usage.monthlyRequests,
              limit: ctx.session.plan.limits.monthlyRequests,
              available: monthlyOk
            }
          }
        }
      };
    } catch {
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to check limits"
      });
    }
  }),
  // Track API usage
  trackUsage: withSession.mutation(async ({ ctx }) => {
    try {
      const usage = await mariaAuth.trackUsage(ctx.session.uid);
      return {
        success: true,
        data: usage
      };
    } catch {
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to track usage"
      });
    }
  }),
  // Development endpoints (remove in production)
  dev: router({
    // Get all users
    getAllUsers: publicProcedure.query(async () => {
      return {
        success: true,
        data: mariaAuth.getAllUsers()
      };
    }),
    // Create test users
    createTestUsers: publicProcedure.mutation(async () => {
      const testUsers = [
        {
          email: "free@maria-platform.dev",
          password: "testpass123",
          name: "Free User",
          plan: "free"
        },
        {
          email: "pro@maria-platform.dev",
          password: "testpass123",
          name: "Pro User",
          plan: "pro"
        },
        {
          email: "max@maria-platform.dev",
          password: "testpass123",
          name: "Max User",
          plan: "max"
        }
      ];
      const results = [];
      for (const userData of testUsers) {
        try {
          const result = await mariaAuth.register(userData);
          results.push({
            email: userData.email,
            plan: userData.plan,
            status: "created",
            sessionToken: result.sessionToken
          });
        } catch (error) {
          results.push({
            email: userData.email,
            plan: userData.plan,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }
      return {
        success: true,
        data: results
      };
    })
  })
});

// src/routers/sandbox.ts
import { z as z5 } from "zod";
import { TRPCError as TRPCError4 } from "@trpc/server";

// src/lib/sandbox-orchestrator.ts
import { z as z4 } from "zod";
var SandboxResourcesSchema = z4.object({
  cpuCores: z4.number(),
  memoryMB: z4.number(),
  storageMB: z4.number(),
  gpuType: z4.enum(["none", "nvidia-t4", "nvidia-v100"]).optional(),
  timeoutMinutes: z4.number().default(30)
});
var SandboxStatusSchema = z4.enum([
  "creating",
  "starting",
  "ready",
  "running",
  "stopping",
  "stopped",
  "error",
  "timeout"
]);
var SandboxInstanceSchema = z4.object({
  id: z4.string(),
  userId: z4.string(),
  status: SandboxStatusSchema,
  resources: SandboxResourcesSchema,
  createdAt: z4.string(),
  startedAt: z4.string().optional(),
  lastActivityAt: z4.string(),
  endpointUrl: z4.string().optional(),
  containerImage: z4.string(),
  environment: z4.record(z4.string()),
  metrics: z4.object({
    cpuUsagePercent: z4.number(),
    memoryUsageMB: z4.number(),
    storageUsageMB: z4.number(),
    networkInMB: z4.number(),
    networkOutMB: z4.number()
  }).optional()
});
var PLAN_RESOURCES = {
  free: {
    cpuCores: 0.5,
    memoryMB: 512,
    storageMB: 1024,
    timeoutMinutes: 30
  },
  pro: {
    cpuCores: 2,
    memoryMB: 2048,
    storageMB: 4096,
    gpuType: "nvidia-t4",
    timeoutMinutes: 60
  },
  max: {
    cpuCores: 8,
    memoryMB: 8192,
    storageMB: 16384,
    gpuType: "nvidia-v100",
    timeoutMinutes: 120
  }
};
var SandboxStore = class {
  instances = /* @__PURE__ */ new Map();
  userSandboxes = /* @__PURE__ */ new Map();
  // userId -> sandboxId
  async createInstance(userId, resources) {
    const sandboxId = this.generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const instance = {
      id: sandboxId,
      userId,
      status: "creating",
      resources,
      createdAt: now,
      lastActivityAt: now,
      containerImage: "gcr.io/maria-code/user-sandbox:latest",
      environment: {
        MARIA_USER_ID: userId,
        MARIA_SANDBOX_ID: sandboxId,
        NODE_ENV: "sandbox"
      }
    };
    this.instances.set(sandboxId, instance);
    this.userSandboxes.set(userId, sandboxId);
    return sandboxId;
  }
  async getInstance(sandboxId) {
    return this.instances.get(sandboxId) || null;
  }
  async getUserSandbox(userId) {
    const sandboxId = this.userSandboxes.get(userId);
    if (!sandboxId) return null;
    return this.getInstance(sandboxId);
  }
  async updateInstance(sandboxId, updates) {
    const instance = this.instances.get(sandboxId);
    if (!instance) return false;
    const updatedInstance = { ...instance, ...updates };
    this.instances.set(sandboxId, updatedInstance);
    return true;
  }
  async deleteInstance(sandboxId) {
    const instance = this.instances.get(sandboxId);
    if (!instance) return false;
    this.instances.delete(sandboxId);
    this.userSandboxes.delete(instance.userId);
    return true;
  }
  async getAllInstances() {
    return Array.from(this.instances.values());
  }
  async getInstancesByStatus(status) {
    return Array.from(this.instances.values()).filter((i) => i.status === status);
  }
  generateId() {
    return `sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};
var sandboxStore = new SandboxStore();
var SandboxOrchestrator = class {
  cleanupInterval;
  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSandboxes();
    }, 5 * 60 * 1e3);
  }
  // Create or get user sandbox
  async getOrCreateSandbox(userId) {
    let sandbox = await sandboxStore.getUserSandbox(userId);
    if (sandbox && ["ready", "running"].includes(sandbox.status)) {
      await sandboxStore.updateInstance(sandbox.id, {
        lastActivityAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      return sandbox;
    }
    let userPlan = "free";
    try {
      const allUsers = mariaAuth.getAllUsers();
      const user = allUsers.find((u) => u.uid === userId);
      if (user) {
        userPlan = user.plan;
      }
    } catch {
      console.warn("Could not determine user plan, defaulting to free");
    }
    let resources;
    if (userPlan === "free" || userPlan === "pro" || userPlan === "max") {
      resources = PLAN_RESOURCES[userPlan];
    } else {
      resources = PLAN_RESOURCES.free;
    }
    const sandboxId = await sandboxStore.createInstance(userId, resources);
    await this.createCloudRunSandbox(sandboxId);
    const newSandbox = await sandboxStore.getInstance(sandboxId);
    if (!newSandbox) {
      throw new Error("Failed to create sandbox instance");
    }
    return newSandbox;
  }
  // Get sandbox status
  async getSandboxStatus(sandboxId) {
    return await sandboxStore.getInstance(sandboxId);
  }
  // Stop user sandbox
  async stopSandbox(sandboxId) {
    const sandbox = await sandboxStore.getInstance(sandboxId);
    if (!sandbox) return false;
    await sandboxStore.updateInstance(sandboxId, {
      status: "stopping",
      lastActivityAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await this.stopCloudRunSandbox(sandboxId);
    await sandboxStore.updateInstance(sandboxId, {
      status: "stopped"
    });
    return true;
  }
  // Update sandbox activity
  async updateActivity(sandboxId) {
    return await sandboxStore.updateInstance(sandboxId, {
      lastActivityAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  // Get resource usage metrics
  async getMetrics(sandboxId) {
    const sandbox = await sandboxStore.getInstance(sandboxId);
    if (!sandbox) return null;
    const metrics = {
      cpuUsagePercent: Math.random() * 100,
      memoryUsageMB: Math.random() * sandbox.resources.memoryMB,
      storageUsageMB: Math.random() * sandbox.resources.storageMB,
      networkInMB: Math.random() * 100,
      networkOutMB: Math.random() * 50
    };
    await sandboxStore.updateInstance(sandboxId, { metrics });
    return metrics;
  }
  // List all sandboxes (admin function)
  async listAllSandboxes() {
    return await sandboxStore.getAllInstances();
  }
  // Cleanup idle sandboxes
  async cleanupIdleSandboxes() {
    const allSandboxes = await sandboxStore.getAllInstances();
    const now = Date.now();
    for (const sandbox of allSandboxes) {
      const lastActivity = new Date(sandbox.lastActivityAt).getTime();
      const idleTime = now - lastActivity;
      const timeoutMs = sandbox.resources.timeoutMinutes * 60 * 1e3;
      if (idleTime > timeoutMs && ["ready", "running"].includes(sandbox.status)) {
        console.log(`Cleaning up idle sandbox: ${sandbox.id}`);
        await sandboxStore.updateInstance(sandbox.id, {
          status: "timeout"
        });
        await this.stopCloudRunSandbox(sandbox.id);
      }
    }
  }
  // Mock Cloud Run operations (replace with actual Cloud Run API calls)
  async createCloudRunSandbox(sandboxId) {
    const sandbox = await sandboxStore.getInstance(sandboxId);
    if (!sandbox) return;
    await new Promise((resolve) => setTimeout(resolve, 2e3));
    await sandboxStore.updateInstance(sandboxId, {
      status: "starting",
      startedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await new Promise((resolve) => setTimeout(resolve, 3e3));
    await sandboxStore.updateInstance(sandboxId, {
      status: "ready",
      endpointUrl: `https://sandbox-${sandboxId}-uc.a.run.app`
    });
    console.log(`Sandbox ${sandboxId} created and ready`);
  }
  async stopCloudRunSandbox(sandboxId) {
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    console.log(`Sandbox ${sandboxId} stopped`);
  }
  // Calculate cost (for monitoring)
  calculateCost(sandbox) {
    if (!sandbox.startedAt) return 0;
    const startTime = new Date(sandbox.startedAt).getTime();
    const endTime = sandbox.status === "stopped" ? Date.now() : new Date(sandbox.lastActivityAt).getTime();
    const runtimeHours = (endTime - startTime) / (1e3 * 60 * 60);
    const cpuCost = sandbox.resources.cpuCores * 0.05;
    const memoryCost = sandbox.resources.memoryMB / 1024 * 0.01;
    const gpuCost = sandbox.resources.gpuType === "nvidia-v100" ? 2 : sandbox.resources.gpuType === "nvidia-t4" ? 0.5 : 0;
    return (cpuCost + memoryCost + gpuCost) * runtimeHours;
  }
  // Cleanup on shutdown
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
};
var sandboxOrchestrator = new SandboxOrchestrator();

// src/routers/sandbox.ts
var withAuth = publicProcedure.use(async ({ next, ctx }) => {
  const token = ctx.req?.headers?.authorization?.replace("Bearer ", "");
  if (!token) {
    throw new TRPCError4({
      code: "UNAUTHORIZED",
      message: "Authentication token required"
    });
  }
  try {
    const session = await mariaAuth.getSession(token);
    return next({
      ctx: {
        ...ctx,
        session,
        userId: session.uid
      }
    });
  } catch {
    throw new TRPCError4({
      code: "UNAUTHORIZED",
      message: "Invalid or expired session"
    });
  }
});
var sandboxRouter = router({
  // Get or create user sandbox
  getOrCreate: withAuth.mutation(async ({ ctx }) => {
    try {
      const sandbox = await sandboxOrchestrator.getOrCreateSandbox(ctx.userId);
      return {
        success: true,
        data: sandbox
      };
    } catch (error) {
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to create sandbox"
      });
    }
  }),
  // Get sandbox status
  getStatus: withAuth.input(z5.object({ sandboxId: z5.string().optional() })).query(async ({ input, ctx }) => {
    try {
      let sandbox;
      if (input.sandboxId) {
        sandbox = await sandboxOrchestrator.getSandboxStatus(input.sandboxId);
      } else {
        sandbox = await sandboxOrchestrator.getOrCreateSandbox(ctx.userId);
      }
      if (!sandbox) {
        throw new TRPCError4({
          code: "NOT_FOUND",
          message: "Sandbox not found"
        });
      }
      if (sandbox.userId !== ctx.userId) {
        throw new TRPCError4({
          code: "FORBIDDEN",
          message: "Access denied to this sandbox"
        });
      }
      return {
        success: true,
        data: sandbox
      };
    } catch (error) {
      if (error instanceof TRPCError4) throw error;
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get sandbox status"
      });
    }
  }),
  // Stop sandbox
  stop: withAuth.input(z5.object({ sandboxId: z5.string() })).mutation(async ({ input, ctx }) => {
    try {
      const sandbox = await sandboxOrchestrator.getSandboxStatus(input.sandboxId);
      if (!sandbox) {
        throw new TRPCError4({
          code: "NOT_FOUND",
          message: "Sandbox not found"
        });
      }
      if (sandbox.userId !== ctx.userId) {
        throw new TRPCError4({
          code: "FORBIDDEN",
          message: "Access denied to this sandbox"
        });
      }
      const stopped = await sandboxOrchestrator.stopSandbox(input.sandboxId);
      return {
        success: stopped,
        message: stopped ? "Sandbox stopped successfully" : "Failed to stop sandbox"
      };
    } catch (error) {
      if (error instanceof TRPCError4) throw error;
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to stop sandbox"
      });
    }
  }),
  // Update activity (keep sandbox alive)
  updateActivity: withAuth.input(z5.object({ sandboxId: z5.string() })).mutation(async ({ input, ctx }) => {
    try {
      const sandbox = await sandboxOrchestrator.getSandboxStatus(input.sandboxId);
      if (!sandbox) {
        throw new TRPCError4({
          code: "NOT_FOUND",
          message: "Sandbox not found"
        });
      }
      if (sandbox.userId !== ctx.userId) {
        throw new TRPCError4({
          code: "FORBIDDEN",
          message: "Access denied to this sandbox"
        });
      }
      const updated = await sandboxOrchestrator.updateActivity(input.sandboxId);
      return {
        success: updated,
        message: updated ? "Activity updated" : "Failed to update activity"
      };
    } catch (error) {
      if (error instanceof TRPCError4) throw error;
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update activity"
      });
    }
  }),
  // Get sandbox metrics
  getMetrics: withAuth.input(z5.object({ sandboxId: z5.string() })).query(async ({ input, ctx }) => {
    try {
      const sandbox = await sandboxOrchestrator.getSandboxStatus(input.sandboxId);
      if (!sandbox) {
        throw new TRPCError4({
          code: "NOT_FOUND",
          message: "Sandbox not found"
        });
      }
      if (sandbox.userId !== ctx.userId) {
        throw new TRPCError4({
          code: "FORBIDDEN",
          message: "Access denied to this sandbox"
        });
      }
      const metrics = await sandboxOrchestrator.getMetrics(input.sandboxId);
      return {
        success: true,
        data: {
          sandbox,
          metrics,
          cost: sandboxOrchestrator.calculateCost(sandbox)
        }
      };
    } catch (error) {
      if (error instanceof TRPCError4) throw error;
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get metrics"
      });
    }
  }),
  // Admin endpoints (for development and monitoring)
  admin: router({
    // List all sandboxes
    listAll: withAuth.query(async ({ ctx }) => {
      if (!ctx.session.email.includes("admin") && !ctx.session.email.includes("bonginkan")) {
        throw new TRPCError4({
          code: "FORBIDDEN",
          message: "Admin access required"
        });
      }
      try {
        const sandboxes = await sandboxOrchestrator.listAllSandboxes();
        return {
          success: true,
          data: sandboxes.map((sandbox) => ({
            ...sandbox,
            cost: sandboxOrchestrator.calculateCost(sandbox)
          }))
        };
      } catch {
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list sandboxes"
        });
      }
    }),
    // Get resource usage summary
    getResourceSummary: withAuth.query(async ({ ctx }) => {
      if (!ctx.session.email.includes("admin") && !ctx.session.email.includes("bonginkan")) {
        throw new TRPCError4({
          code: "FORBIDDEN",
          message: "Admin access required"
        });
      }
      try {
        const sandboxes = await sandboxOrchestrator.listAllSandboxes();
        const summary = {
          total: sandboxes.length,
          byStatus: {},
          totalCost: 0,
          totalResources: {
            cpuCores: 0,
            memoryMB: 0,
            storageMB: 0
          }
        };
        sandboxes.forEach((sandbox) => {
          summary.byStatus[sandbox.status] = (summary.byStatus[sandbox.status] || 0) + 1;
          summary.totalCost += sandboxOrchestrator.calculateCost(sandbox);
          if (["ready", "running"].includes(sandbox.status)) {
            summary.totalResources.cpuCores += sandbox.resources.cpuCores;
            summary.totalResources.memoryMB += sandbox.resources.memoryMB;
            summary.totalResources.storageMB += sandbox.resources.storageMB;
          }
        });
        return {
          success: true,
          data: summary
        };
      } catch {
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get resource summary"
        });
      }
    })
  }),
  // Development endpoints
  dev: router({
    // Create test sandboxes
    createTestSandboxes: publicProcedure.mutation(async () => {
      try {
        const testUsers = ["free-user-123", "pro-user-456", "max-user-789"];
        const results = [];
        for (const userId of testUsers) {
          try {
            const sandbox = await sandboxOrchestrator.getOrCreateSandbox(userId);
            results.push({
              userId,
              sandboxId: sandbox.id,
              status: "created",
              resources: sandbox.resources
            });
          } catch (error) {
            results.push({
              userId,
              status: "error",
              error: error instanceof Error ? error.message : "Unknown error"
            });
          }
        }
        return {
          success: true,
          data: results
        };
      } catch {
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create test sandboxes"
        });
      }
    })
  })
});

// src/routers/ai-execution.ts
import { z as z7 } from "zod";
import { TRPCError as TRPCError5 } from "@trpc/server";

// src/lib/ai-execution-engine.ts
import { z as z6 } from "zod";
var AIModelSchema = z6.enum([
  "gemini-2.5-pro-preview",
  "grok-4-latest"
]);
var AIRequestSchema = z6.object({
  model: AIModelSchema,
  prompt: z6.string(),
  context: z6.string().optional(),
  temperature: z6.number().min(0).max(2).default(0.7),
  maxTokens: z6.number().min(1).max(8192).default(2048),
  stream: z6.boolean().default(false),
  systemPrompt: z6.string().optional()
});
var AIResponseSchema = z6.object({
  id: z6.string(),
  model: AIModelSchema,
  content: z6.string(),
  usage: z6.object({
    promptTokens: z6.number(),
    completionTokens: z6.number(),
    totalTokens: z6.number()
  }),
  finishReason: z6.enum(["stop", "length", "content_filter", "function_call"]),
  processingTimeMs: z6.number(),
  cached: z6.boolean().default(false)
});
var ResponseCache = class {
  cache = /* @__PURE__ */ new Map();
  maxAge = 10 * 60 * 1e3;
  // 10 minutes
  maxSize = 1e3;
  generateKey(request) {
    return `${request.model}:${this.hashString(request.prompt + (request.context || "") + (request.systemPrompt || ""))}:${request.temperature}:${request.maxTokens}`;
  }
  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    return { ...cached.response, cached: true };
  }
  set(key, response) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, {
      response: { ...response, cached: false },
      timestamp: Date.now()
    });
  }
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
  clear() {
    this.cache.clear();
  }
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0
      // TODO: Track hit rate
    };
  }
};
var AIExecutionEngine = class {
  grokBaseUrl = "https://api.x.ai/v1";
  cache = new ResponseCache();
  requestCount = 0;
  errorCount = 0;
  constructor() {
  }
  // Main execution method
  async execute(request, user) {
    const startTime = Date.now();
    this.requestCount++;
    try {
      const cacheKey = this.cache.generateKey(request);
      const cachedResponse = this.cache.get(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
      if (user && !this.hasModelAccess(user, request.model)) {
        throw new Error(`Access denied to model ${request.model} for plan ${user.plan.type}`);
      }
      let response;
      switch (request.model) {
        case "gemini-2.5-pro-preview":
          response = await this.executeGemini(request);
          break;
        case "grok-4-latest":
          response = await this.executeGrok(request);
          break;
        default:
          throw new Error(`Unsupported model: ${request.model}`);
      }
      response.processingTimeMs = Date.now() - startTime;
      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      this.errorCount++;
      throw new Error(`AI execution failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  // Gemini execution (TODO: Implement with Vertex AI through ai-agents)
  async executeGemini(request) {
    return {
      id: this.generateId(),
      model: request.model,
      content: "Gemini execution not yet implemented - use ai-agents package",
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      finishReason: "stop",
      processingTimeMs: 0,
      cached: false
    };
  }
  // Grok execution (xAI API)
  async executeGrok(request) {
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
      throw new Error("GROK_API_KEY not found in environment variables");
    }
    try {
      const messages = [];
      if (request.systemPrompt) {
        messages.push({
          role: "system",
          content: request.systemPrompt
        });
      }
      if (request.context) {
        messages.push({
          role: "user",
          content: `Context: ${request.context}`
        });
      }
      messages.push({
        role: "user",
        content: request.prompt
      });
      const response = await fetch(`${this.grokBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${grokApiKey}`
        },
        body: JSON.stringify({
          model: "grok-beta",
          messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          stream: request.stream
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      const choice = data.choices?.[0];
      if (!choice) {
        throw new Error("No response from Grok API");
      }
      return {
        id: data.id || this.generateId(),
        model: request.model,
        content: choice.message.content,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        },
        finishReason: choice.finish_reason === "stop" ? "stop" : "length",
        processingTimeMs: 0,
        // Will be set by caller
        cached: false
      };
    } catch (error) {
      throw new Error(`Grok execution failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  // Check if user has access to model based on their plan
  hasModelAccess(user, model) {
    const allowedModels = user.plan.limits.aiModelAccess;
    return allowedModels.includes(model);
  }
  // Generate unique ID
  generateId() {
    return `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  // Streaming support for real-time responses
  async *executeStream(request, user) {
    if (request.model === "grok-4-latest") {
      yield* this.executeGrokStream(request, user);
    } else {
      const response = await this.execute(request, user);
      yield response.content;
    }
  }
  async *executeGrokStream(request, user) {
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
      throw new Error("GROK_API_KEY not found in environment variables");
    }
    if (user && !this.hasModelAccess(user, request.model)) {
      throw new Error(`Access denied to model ${request.model} for plan ${user.plan.type}`);
    }
    const messages = [];
    if (request.systemPrompt) {
      messages.push({
        role: "system",
        content: request.systemPrompt
      });
    }
    if (request.context) {
      messages.push({
        role: "user",
        content: `Context: ${request.context}`
      });
    }
    messages.push({
      role: "user",
      content: request.prompt
    });
    const response = await fetch(`${this.grokBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true
      })
    });
    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body reader available");
    }
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  // Get execution statistics
  getStats() {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      successRate: this.requestCount > 0 ? (this.requestCount - this.errorCount) / this.requestCount : 0,
      cacheStats: this.cache.getStats()
    };
  }
  // Clear cache
  clearCache() {
    this.cache.clear();
  }
  // Health check
  async healthCheck() {
    const results = { gemini: false, grok: false };
    try {
      await this.executeGemini({
        model: "gemini-2.5-pro-preview",
        prompt: "Hello",
        temperature: 0.1,
        maxTokens: 10,
        stream: false
      });
      results.gemini = true;
    } catch (error) {
      console.warn("Gemini health check failed:", error);
    }
    try {
      await this.executeGrok({
        model: "grok-4-latest",
        prompt: "Hello",
        temperature: 0.1,
        maxTokens: 10,
        stream: false
      });
      results.grok = true;
    } catch (error) {
      console.warn("Grok health check failed:", error);
    }
    return results;
  }
};
var aiExecutionEngine = new AIExecutionEngine();

// src/routers/ai-execution.ts
var withAuth2 = publicProcedure.use(async ({ next, ctx }) => {
  const token = ctx.req?.headers?.authorization?.replace("Bearer ", "");
  if (!token) {
    throw new TRPCError5({
      code: "UNAUTHORIZED",
      message: "Authentication token required"
    });
  }
  try {
    const session = await mariaAuth.getSession(token);
    return next({
      ctx: {
        ...ctx,
        session,
        userId: session.uid
      }
    });
  } catch {
    throw new TRPCError5({
      code: "UNAUTHORIZED",
      message: "Invalid or expired session"
    });
  }
});
var aiExecutionRouter = router({
  // Execute AI request
  execute: withAuth2.input(AIRequestSchema).mutation(async ({ input, ctx }) => {
    try {
      const canMakeRequest = await mariaAuth.checkLimits(ctx.session.uid, "dailyRequests") && await mariaAuth.checkLimits(ctx.session.uid, "monthlyRequests");
      if (!canMakeRequest) {
        throw new TRPCError5({
          code: "TOO_MANY_REQUESTS",
          message: "Daily or monthly request limit exceeded"
        });
      }
      const response = await aiExecutionEngine.execute(input, ctx.session);
      await mariaAuth.trackUsage(ctx.session.uid);
      return {
        success: true,
        data: response
      };
    } catch (error) {
      if (error instanceof TRPCError5) throw error;
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "AI execution failed"
      });
    }
  }),
  // Execute streaming AI request
  executeStream: withAuth2.input(AIRequestSchema.extend({ stream: z7.literal(true) })).subscription(async function* ({ input, ctx }) {
    try {
      const canMakeRequest = await mariaAuth.checkLimits(ctx.session.uid, "dailyRequests") && await mariaAuth.checkLimits(ctx.session.uid, "monthlyRequests");
      if (!canMakeRequest) {
        throw new TRPCError5({
          code: "TOO_MANY_REQUESTS",
          message: "Daily or monthly request limit exceeded"
        });
      }
      await mariaAuth.trackUsage(ctx.session.uid);
      for await (const chunk of aiExecutionEngine.executeStream(input, ctx.session)) {
        yield {
          type: "chunk",
          data: chunk
        };
      }
      yield {
        type: "done",
        data: null
      };
    } catch (error) {
      yield {
        type: "error",
        data: error instanceof Error ? error.message : "Stream execution failed"
      };
    }
  }),
  // Get available models for user
  getAvailableModels: withAuth2.query(async ({ ctx }) => {
    try {
      const userModels = ctx.session.plan.limits.aiModelAccess;
      const modelInfo = {
        "gemini-2.5-pro-preview": {
          name: "Gemini 2.5 Pro",
          provider: "Google",
          capabilities: ["text", "multimodal"],
          contextWindow: 128e3,
          description: "Advanced reasoning and analysis"
        },
        "grok-4-latest": {
          name: "Grok-4",
          provider: "xAI",
          capabilities: ["text", "creative"],
          contextWindow: 32e3,
          description: "Creative and humorous responses"
        }
      };
      const availableModels = userModels.filter((model) => model in modelInfo).map((model) => ({
        id: model,
        ...modelInfo[model],
        available: true
      }));
      return {
        success: true,
        data: availableModels
      };
    } catch {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get available models"
      });
    }
  }),
  // Get usage limits and current usage
  getUsageLimits: withAuth2.query(async ({ ctx }) => {
    try {
      const dailyOk = await mariaAuth.checkLimits(ctx.session.uid, "dailyRequests");
      const monthlyOk = await mariaAuth.checkLimits(ctx.session.uid, "monthlyRequests");
      return {
        success: true,
        data: {
          canMakeRequest: dailyOk && monthlyOk,
          limits: {
            daily: {
              current: ctx.session.usage.dailyRequests,
              limit: ctx.session.plan.limits.dailyRequests,
              available: dailyOk
            },
            monthly: {
              current: ctx.session.usage.monthlyRequests,
              limit: ctx.session.plan.limits.monthlyRequests,
              available: monthlyOk
            }
          },
          plan: {
            type: ctx.session.plan.type,
            features: ctx.session.plan.features
          }
        }
      };
    } catch {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get usage limits"
      });
    }
  }),
  // Get AI execution statistics (admin/dev)
  getStats: withAuth2.query(async ({ ctx }) => {
    if (!ctx.session.email.includes("admin") && !ctx.session.email.includes("bonginkan")) {
      throw new TRPCError5({
        code: "FORBIDDEN",
        message: "Admin access required"
      });
    }
    try {
      const stats = aiExecutionEngine.getStats();
      return {
        success: true,
        data: stats
      };
    } catch {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get stats"
      });
    }
  }),
  // Health check for AI models
  healthCheck: publicProcedure.query(async () => {
    try {
      const health = await aiExecutionEngine.healthCheck();
      return {
        success: true,
        data: {
          ...health,
          overall: health.gemini || health.grok,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      };
    } catch {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "Health check failed"
      });
    }
  }),
  // Development endpoints
  dev: router({
    // Test AI models
    testModels: publicProcedure.mutation(async () => {
      try {
        const testPrompt = 'Respond with exactly: "Hello from AI model test"';
        const results = [];
        try {
          const geminiResponse = await aiExecutionEngine.execute({
            model: "gemini-2.5-pro-preview",
            prompt: testPrompt,
            temperature: 0.1,
            maxTokens: 50,
            stream: false
          });
          results.push({
            model: "gemini-2.5-pro-preview",
            status: "success",
            response: geminiResponse.content.substring(0, 100),
            processingTime: geminiResponse.processingTimeMs
          });
        } catch (error) {
          results.push({
            model: "gemini-2.5-pro-preview",
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
        try {
          const grokResponse = await aiExecutionEngine.execute({
            model: "grok-4-latest",
            prompt: testPrompt,
            temperature: 0.1,
            maxTokens: 50,
            stream: false
          });
          results.push({
            model: "grok-4-latest",
            status: "success",
            response: grokResponse.content.substring(0, 100),
            processingTime: grokResponse.processingTimeMs
          });
        } catch (error) {
          results.push({
            model: "grok-4-latest",
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
        return {
          success: true,
          data: results
        };
      } catch {
        throw new TRPCError5({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to test models"
        });
      }
    }),
    // Clear cache
    clearCache: publicProcedure.mutation(async () => {
      try {
        aiExecutionEngine.clearCache();
        return {
          success: true,
          message: "Cache cleared successfully"
        };
      } catch {
        throw new TRPCError5({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to clear cache"
        });
      }
    })
  })
});

// src/routers/papers.ts
import { z as z8 } from "zod";
import { TRPCError as TRPCError6 } from "@trpc/server";
var createPaperSchema = z8.object({
  title: z8.string().min(1),
  description: z8.string().optional(),
  templateId: z8.enum(["ieee", "acm", "blank"]).default("blank"),
  content: z8.object({
    latex: z8.string().default(""),
    bibliography: z8.string().default("")
  })
});
var updatePaperSchema = z8.object({
  id: z8.string(),
  title: z8.string().min(1).optional(),
  description: z8.string().optional(),
  status: z8.enum(["draft", "in_progress", "completed", "archived"]).optional(),
  content: z8.object({
    latex: z8.string().optional(),
    bibliography: z8.string().optional()
  }).optional()
});
var paperSchema = z8.object({
  id: z8.string(),
  title: z8.string(),
  description: z8.string().optional(),
  templateId: z8.string(),
  status: z8.enum(["draft", "in_progress", "completed", "archived"]),
  content: z8.object({
    latex: z8.string(),
    bibliography: z8.string()
  }),
  createdAt: z8.date(),
  updatedAt: z8.date(),
  createdBy: z8.string(),
  collaborators: z8.array(z8.string()),
  version: z8.number(),
  wordCount: z8.number(),
  citationCount: z8.number()
});
var paperVersionHistorySchema = z8.object({
  id: z8.string(),
  paperId: z8.string(),
  version: z8.number(),
  content: z8.object({
    latex: z8.string(),
    bibliography: z8.string()
  }),
  comment: z8.string().optional(),
  createdAt: z8.date(),
  createdBy: z8.string(),
  wordCount: z8.number(),
  changes: z8.object({
    added: z8.number(),
    removed: z8.number(),
    modified: z8.number()
  })
});
var papersRouter = router({
  // Get all papers for current user
  list: protectedProcedure.input(z8.object({
    status: z8.enum(["draft", "in_progress", "completed", "archived"]).optional(),
    limit: z8.number().min(1).max(100).default(20),
    cursor: z8.string().optional()
  })).output(z8.object({
    papers: z8.array(paperSchema),
    nextCursor: z8.string().optional()
  })).query(async ({ ctx, input }) => {
    try {
      let query = ctx.firestore.collection("papers").where("createdBy", "==", ctx.user.uid).orderBy("updatedAt", "desc");
      if (input.status) {
        query = query.where("status", "==", input.status);
      }
      if (input.cursor) {
        const cursorDoc = await ctx.firestore.collection("papers").doc(input.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }
      const snapshot = await query.limit(input.limit + 1).get();
      const papers = [];
      let nextCursor;
      for (let i = 0; i < snapshot.docs.length; i++) {
        if (i === input.limit) {
          const cursorDoc = snapshot.docs[i];
          if (cursorDoc) {
            nextCursor = cursorDoc.id;
          }
          break;
        }
        const doc = snapshot.docs[i];
        if (!doc) continue;
        const data = doc.data();
        papers.push({
          id: doc.id,
          title: data.title,
          description: data.description,
          templateId: data.templateId,
          status: data.status,
          content: data.content,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          createdBy: data.createdBy,
          collaborators: data.collaborators || [],
          version: data.version || 1,
          wordCount: data.wordCount || 0,
          citationCount: data.citationCount || 0
        });
      }
      return { papers, nextCursor };
    } catch (error) {
      throw createErrorHandler("List papers")(error);
    }
  }),
  // Get a specific paper
  get: protectedProcedure.input(z8.object({ id: z8.string() })).output(paperSchema).query(async ({ ctx, input }) => {
    try {
      const doc = await ctx.firestore.collection("papers").doc(input.id).get();
      if (!doc.exists) {
        throw new TRPCError6({
          code: "NOT_FOUND",
          message: "Paper not found"
        });
      }
      const data = doc.data();
      if (data.createdBy !== ctx.user.uid && !data.collaborators?.includes(ctx.user.uid)) {
        throw new TRPCError6({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        templateId: data.templateId,
        status: data.status,
        content: data.content,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        createdBy: data.createdBy,
        collaborators: data.collaborators || [],
        version: data.version || 1,
        wordCount: data.wordCount || 0,
        citationCount: data.citationCount || 0
      };
    } catch (error) {
      throw createErrorHandler("Get paper")(error);
    }
  }),
  // Create a new paper
  create: editorProcedure.input(createPaperSchema).output(paperSchema).mutation(async ({ ctx, input }) => {
    try {
      const now = /* @__PURE__ */ new Date();
      let initialLatex = input.content.latex;
      if (!initialLatex && input.templateId !== "blank") {
        initialLatex = generateTemplateContent(input.templateId, input.title);
      }
      const paperData = {
        title: input.title,
        description: input.description,
        templateId: input.templateId,
        status: "draft",
        content: {
          latex: initialLatex,
          bibliography: input.content.bibliography
        },
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.user.uid,
        collaborators: [],
        version: 1,
        wordCount: countWords(initialLatex),
        citationCount: countCitations(input.content.bibliography)
      };
      const docRef = await ctx.firestore.collection("papers").add(paperData);
      await ctx.firestore.collection("paper_versions").add({
        paperId: docRef.id,
        version: 1,
        content: paperData.content,
        comment: "Initial version",
        createdAt: now,
        createdBy: ctx.user.uid,
        wordCount: paperData.wordCount,
        changes: { added: paperData.wordCount, removed: 0, modified: 0 }
      });
      return {
        id: docRef.id,
        ...paperData
      };
    } catch (error) {
      throw createErrorHandler("Create paper")(error);
    }
  }),
  // Update a paper
  update: protectedProcedure.input(updatePaperSchema).output(paperSchema).mutation(async ({ ctx, input }) => {
    try {
      const docRef = ctx.firestore.collection("papers").doc(input.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new TRPCError6({
          code: "NOT_FOUND",
          message: "Paper not found"
        });
      }
      const currentData = doc.data();
      if (currentData.createdBy !== ctx.user.uid && !currentData.collaborators?.includes(ctx.user.uid)) {
        throw new TRPCError6({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const now = /* @__PURE__ */ new Date();
      const updateData = {
        updatedAt: now
      };
      if (input.title) updateData.title = input.title;
      if (input.description !== void 0) updateData.description = input.description;
      if (input.status) updateData.status = input.status;
      if (input.content) {
        const newContent = {
          latex: input.content.latex ?? currentData.content.latex,
          bibliography: input.content.bibliography ?? currentData.content.bibliography
        };
        updateData.content = newContent;
        updateData.wordCount = countWords(newContent.latex);
        updateData.citationCount = countCitations(newContent.bibliography);
        if (input.content.latex && input.content.latex !== currentData.content.latex) {
          updateData.version = (currentData.version || 1) + 1;
          const changes = calculateChanges(currentData.content.latex, newContent.latex);
          await ctx.firestore.collection("paper_versions").add({
            paperId: input.id,
            version: updateData.version,
            content: newContent,
            createdAt: now,
            createdBy: ctx.user.uid,
            wordCount: updateData.wordCount,
            changes
          });
        }
      }
      await docRef.update(updateData);
      const updatedDoc = await docRef.get();
      const updatedData = updatedDoc.data();
      return {
        id: input.id,
        title: updatedData.title,
        description: updatedData.description,
        templateId: updatedData.templateId,
        status: updatedData.status,
        content: updatedData.content,
        createdAt: updatedData.createdAt.toDate(),
        updatedAt: updatedData.updatedAt.toDate(),
        createdBy: updatedData.createdBy,
        collaborators: updatedData.collaborators || [],
        version: updatedData.version || 1,
        wordCount: updatedData.wordCount || 0,
        citationCount: updatedData.citationCount || 0
      };
    } catch (error) {
      throw createErrorHandler("Update paper")(error);
    }
  }),
  // Delete a paper
  delete: protectedProcedure.input(z8.object({ id: z8.string() })).mutation(async ({ ctx, input }) => {
    try {
      const docRef = ctx.firestore.collection("papers").doc(input.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new TRPCError6({
          code: "NOT_FOUND",
          message: "Paper not found"
        });
      }
      const data = doc.data();
      if (data.createdBy !== ctx.user.uid) {
        throw new TRPCError6({
          code: "FORBIDDEN",
          message: "Only the creator can delete this paper"
        });
      }
      const versionsSnapshot = await ctx.firestore.collection("paper_versions").where("paperId", "==", input.id).get();
      const batch = ctx.firestore.batch();
      versionsSnapshot.docs.forEach((doc2) => batch.delete(doc2.ref));
      batch.delete(docRef);
      await batch.commit();
      return { success: true };
    } catch (error) {
      throw createErrorHandler("Delete paper")(error);
    }
  }),
  // Get version history
  getVersions: protectedProcedure.input(z8.object({ paperId: z8.string() })).output(z8.array(paperVersionHistorySchema)).query(async ({ ctx, input }) => {
    try {
      const paperDoc = await ctx.firestore.collection("papers").doc(input.paperId).get();
      if (!paperDoc.exists) {
        throw new TRPCError6({
          code: "NOT_FOUND",
          message: "Paper not found"
        });
      }
      const paperData = paperDoc.data();
      if (paperData.createdBy !== ctx.user.uid && !paperData.collaborators?.includes(ctx.user.uid)) {
        throw new TRPCError6({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const versionsSnapshot = await ctx.firestore.collection("paper_versions").where("paperId", "==", input.paperId).orderBy("version", "desc").get();
      return versionsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          paperId: data.paperId,
          version: data.version,
          content: data.content,
          comment: data.comment,
          createdAt: data.createdAt.toDate(),
          createdBy: data.createdBy,
          wordCount: data.wordCount,
          changes: data.changes
        };
      });
    } catch (error) {
      throw createErrorHandler("Get versions")(error);
    }
  }),
  // Add collaborator
  addCollaborator: editorProcedure.input(z8.object({
    paperId: z8.string(),
    email: z8.string().email()
  })).mutation(async ({ ctx, input }) => {
    try {
      const paperRef = ctx.firestore.collection("papers").doc(input.paperId);
      const paperDoc = await paperRef.get();
      if (!paperDoc.exists) {
        throw new TRPCError6({
          code: "NOT_FOUND",
          message: "Paper not found"
        });
      }
      const paperData = paperDoc.data();
      if (paperData.createdBy !== ctx.user.uid) {
        throw new TRPCError6({
          code: "FORBIDDEN",
          message: "Only the creator can add collaborators"
        });
      }
      const userSnapshot = await ctx.firestore.collection("users").where("email", "==", input.email).limit(1).get();
      if (userSnapshot.empty) {
        throw new TRPCError6({
          code: "NOT_FOUND",
          message: "User not found"
        });
      }
      const userDoc = userSnapshot.docs[0];
      if (!userDoc) {
        throw new TRPCError6({
          code: "NOT_FOUND",
          message: "User document not found"
        });
      }
      const userId = userDoc.id;
      const collaborators = paperData.collaborators || [];
      if (!collaborators.includes(userId)) {
        collaborators.push(userId);
        await paperRef.update({ collaborators });
      }
      return { success: true };
    } catch (error) {
      throw createErrorHandler("Add collaborator")(error);
    }
  })
});
function generateTemplateContent(templateId, title) {
  switch (templateId) {
    case "ieee":
      return `\\documentclass[conference]{IEEEtran}
\\usepackage{cite}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{algorithmic}
\\usepackage{graphicx}
\\usepackage{textcomp}
\\usepackage{xcolor}

\\begin{document}

\\title{${title}}

\\author{\\IEEEauthorblockN{Author Name}
\\IEEEauthorblockA{\\textit{Department} \\\\
\\textit{University Name}\\\\
City, Country \\\\
email@university.edu}}

\\maketitle

\\begin{abstract}
This document is a template for your IEEE conference paper.
\\end{abstract}

\\begin{IEEEkeywords}
keyword1, keyword2, keyword3
\\end{IEEEkeywords}

\\section{Introduction}
Your introduction goes here.

\\section{Methodology}
Your methodology goes here.

\\section{Results}
Your results go here.

\\section{Conclusion}
Your conclusion goes here.

\\begin{thebibliography}{00}
\\bibitem{b1} Reference 1
\\end{thebibliography}

\\end{document}`;
    case "acm":
      return `\\documentclass[sigconf]{acmart}

\\begin{document}

\\title{${title}}

\\author{Author Name}
\\affiliation{%
  \\institution{University Name}
  \\city{City}
  \\country{Country}
}
\\email{email@university.edu}

\\begin{abstract}
This document is a template for your ACM conference paper.
\\end{abstract}

\\keywords{keyword1, keyword2, keyword3}

\\maketitle

\\section{Introduction}
Your introduction goes here.

\\section{Related Work}
Your related work goes here.

\\section{Methodology}
Your methodology goes here.

\\section{Results}
Your results go here.

\\section{Conclusion}
Your conclusion goes here.

\\bibliographystyle{ACM-Reference-Format}
\\bibliography{references}

\\end{document}`;
    default:
      return `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}

\\title{${title}}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
Your abstract goes here.
\\end{abstract}

\\section{Introduction}
Your introduction goes here.

\\section{Conclusion}
Your conclusion goes here.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}`;
  }
}
function countWords(latex) {
  const text = latex.replace(/\\[a-zA-Z]+\{[^}]*\}/g, "").replace(/\\[a-zA-Z]+/g, "").replace(/\{[^}]*\}/g, "").replace(/\$[^$]*\$/g, "").replace(/\$\$[^$]*\$\$/g, "").replace(/[^a-zA-Z\s]/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}
function countCitations(bibliography) {
  const matches = bibliography.match(/@\w+\{/g);
  return matches ? matches.length : 0;
}
function calculateChanges(oldText, newText) {
  const oldWords = oldText.split(/\s+/).length;
  const newWords = newText.split(/\s+/).length;
  const added = Math.max(0, newWords - oldWords);
  const removed = Math.max(0, oldWords - newWords);
  const modified = Math.min(oldWords, newWords);
  return { added, removed, modified };
}

// src/routers/slides.ts
import { z as z9 } from "zod";
import { TRPCError as TRPCError7 } from "@trpc/server";
var slideContentSchema = z9.object({
  title: z9.string().optional(),
  subtitle: z9.string().optional(),
  body: z9.string().optional(),
  imageUrl: z9.string().optional(),
  chartData: z9.any().optional()
});
var slideSchema = z9.object({
  id: z9.string(),
  type: z9.enum(["title", "content", "image", "chart"]),
  content: slideContentSchema
});
var createPresentationSchema = z9.object({
  title: z9.string().min(1),
  description: z9.string().optional(),
  templateId: z9.enum(["blank", "business", "academic"]).default("blank"),
  slides: z9.array(slideSchema).optional()
});
var updatePresentationSchema = z9.object({
  id: z9.string(),
  title: z9.string().min(1).optional(),
  description: z9.string().optional(),
  status: z9.enum(["draft", "in_progress", "completed", "archived"]).optional(),
  slides: z9.array(slideSchema).optional(),
  theme: z9.string().optional()
});
var aiGenerateSchema = z9.object({
  presentationId: z9.string(),
  slideId: z9.string(),
  prompt: z9.string().min(1),
  type: z9.enum(["content", "outline", "bullets", "summary"]).default("content")
});
var presentationSchema = z9.object({
  id: z9.string(),
  title: z9.string(),
  description: z9.string().optional(),
  templateId: z9.string(),
  theme: z9.string(),
  status: z9.enum(["draft", "in_progress", "completed", "archived"]),
  slides: z9.array(slideSchema),
  slideCount: z9.number(),
  createdAt: z9.date(),
  updatedAt: z9.date(),
  createdBy: z9.string(),
  collaborators: z9.array(z9.string()),
  thumbnail: z9.string().optional(),
  googleSlidesId: z9.string().optional()
});
var slidesRouter = router({
  // Get all presentations for current user
  list: protectedProcedure.input(z9.object({
    status: z9.enum(["draft", "in_progress", "completed", "archived"]).optional(),
    limit: z9.number().min(1).max(100).default(20),
    cursor: z9.string().optional()
  })).output(z9.object({
    presentations: z9.array(presentationSchema),
    nextCursor: z9.string().optional()
  })).query(async ({ ctx, input }) => {
    try {
      let query = ctx.firestore.collection("presentations").where("createdBy", "==", ctx.user.uid).orderBy("updatedAt", "desc");
      if (input.status) {
        query = query.where("status", "==", input.status);
      }
      if (input.cursor) {
        const cursorDoc = await ctx.firestore.collection("presentations").doc(input.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }
      const snapshot = await query.limit(input.limit + 1).get();
      const presentations = [];
      let nextCursor;
      for (let i = 0; i < snapshot.docs.length; i++) {
        if (i === input.limit) {
          const cursorDoc = snapshot.docs[i];
          if (cursorDoc) {
            nextCursor = cursorDoc.id;
          }
          break;
        }
        const doc = snapshot.docs[i];
        if (!doc) continue;
        const data = doc.data();
        presentations.push({
          id: doc.id,
          title: data.title,
          description: data.description,
          templateId: data.templateId,
          theme: data.theme,
          status: data.status,
          slides: data.slides || [],
          slideCount: data.slides?.length || 0,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          createdBy: data.createdBy,
          collaborators: data.collaborators || [],
          thumbnail: data.thumbnail,
          googleSlidesId: data.googleSlidesId
        });
      }
      return { presentations, nextCursor };
    } catch (error) {
      throw createErrorHandler("List presentations")(error);
    }
  }),
  // Get a specific presentation
  get: protectedProcedure.input(z9.object({ id: z9.string() })).output(presentationSchema).query(async ({ ctx, input }) => {
    try {
      const doc = await ctx.firestore.collection("presentations").doc(input.id).get();
      if (!doc.exists) {
        throw new TRPCError7({
          code: "NOT_FOUND",
          message: "Presentation not found"
        });
      }
      const data = doc.data();
      if (data.createdBy !== ctx.user.uid && !data.collaborators?.includes(ctx.user.uid)) {
        throw new TRPCError7({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        templateId: data.templateId,
        theme: data.theme,
        status: data.status,
        slides: data.slides || [],
        slideCount: data.slides?.length || 0,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        createdBy: data.createdBy,
        collaborators: data.collaborators || [],
        thumbnail: data.thumbnail,
        googleSlidesId: data.googleSlidesId
      };
    } catch (error) {
      throw createErrorHandler("Get presentation")(error);
    }
  }),
  // Create a new presentation
  create: editorProcedure.input(createPresentationSchema).output(presentationSchema).mutation(async ({ ctx, input }) => {
    try {
      const now = /* @__PURE__ */ new Date();
      const initialSlides = input.slides || generateTemplateSlides(input.templateId, input.title, input.description);
      const presentationData = {
        title: input.title,
        description: input.description,
        templateId: input.templateId,
        theme: getTemplateTheme(input.templateId),
        status: "draft",
        slides: initialSlides,
        slideCount: initialSlides.length,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.user.uid,
        collaborators: []
      };
      const docRef = await ctx.firestore.collection("presentations").add(presentationData);
      return {
        id: docRef.id,
        ...presentationData
      };
    } catch (error) {
      throw createErrorHandler("Create presentation")(error);
    }
  }),
  // Update a presentation
  update: protectedProcedure.input(updatePresentationSchema).output(presentationSchema).mutation(async ({ ctx, input }) => {
    try {
      const docRef = ctx.firestore.collection("presentations").doc(input.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new TRPCError7({
          code: "NOT_FOUND",
          message: "Presentation not found"
        });
      }
      const currentData = doc.data();
      if (currentData.createdBy !== ctx.user.uid && !currentData.collaborators?.includes(ctx.user.uid)) {
        throw new TRPCError7({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const updateData = {
        updatedAt: /* @__PURE__ */ new Date()
      };
      if (input.title) updateData.title = input.title;
      if (input.description !== void 0) updateData.description = input.description;
      if (input.status) updateData.status = input.status;
      if (input.theme) updateData.theme = input.theme;
      if (input.slides) {
        updateData.slides = input.slides;
        updateData.slideCount = input.slides.length;
      }
      await docRef.update(updateData);
      const updatedDoc = await docRef.get();
      const updatedData = updatedDoc.data();
      return {
        id: input.id,
        title: updatedData.title,
        description: updatedData.description,
        templateId: updatedData.templateId,
        theme: updatedData.theme,
        status: updatedData.status,
        slides: updatedData.slides || [],
        slideCount: updatedData.slides?.length || 0,
        createdAt: updatedData.createdAt.toDate(),
        updatedAt: updatedData.updatedAt.toDate(),
        createdBy: updatedData.createdBy,
        collaborators: updatedData.collaborators || [],
        thumbnail: updatedData.thumbnail,
        googleSlidesId: updatedData.googleSlidesId
      };
    } catch (error) {
      throw createErrorHandler("Update presentation")(error);
    }
  }),
  // Delete a presentation
  delete: protectedProcedure.input(z9.object({ id: z9.string() })).mutation(async ({ ctx, input }) => {
    try {
      const docRef = ctx.firestore.collection("presentations").doc(input.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new TRPCError7({
          code: "NOT_FOUND",
          message: "Presentation not found"
        });
      }
      const data = doc.data();
      if (data.createdBy !== ctx.user.uid) {
        throw new TRPCError7({
          code: "FORBIDDEN",
          message: "Only the creator can delete this presentation"
        });
      }
      await docRef.delete();
      return { success: true };
    } catch (error) {
      throw createErrorHandler("Delete presentation")(error);
    }
  }),
  // AI content generation
  generateContent: protectedProcedure.input(aiGenerateSchema).output(z9.object({
    content: slideContentSchema,
    success: z9.boolean()
  })).mutation(async ({ ctx, input }) => {
    try {
      const doc = await ctx.firestore.collection("presentations").doc(input.presentationId).get();
      if (!doc.exists) {
        throw new TRPCError7({
          code: "NOT_FOUND",
          message: "Presentation not found"
        });
      }
      const data = doc.data();
      if (data.createdBy !== ctx.user.uid && !data.collaborators?.includes(ctx.user.uid)) {
        throw new TRPCError7({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const generatedContent = await simulateAIGeneration(input.prompt, input.type);
      return {
        content: generatedContent,
        success: true
      };
    } catch (error) {
      throw createErrorHandler("Generate AI content")(error);
    }
  }),
  // Export to Google Slides
  exportToGoogleSlides: protectedProcedure.input(z9.object({
    presentationId: z9.string(),
    title: z9.string().optional()
  })).output(z9.object({
    googleSlidesId: z9.string(),
    url: z9.string(),
    success: z9.boolean()
  })).mutation(async ({ ctx, input }) => {
    try {
      const doc = await ctx.firestore.collection("presentations").doc(input.presentationId).get();
      if (!doc.exists) {
        throw new TRPCError7({
          code: "NOT_FOUND",
          message: "Presentation not found"
        });
      }
      const data = doc.data();
      if (data.createdBy !== ctx.user.uid && !data.collaborators?.includes(ctx.user.uid)) {
        throw new TRPCError7({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const googleSlidesId = `gs_${Date.now()}`;
      const url = `https://docs.google.com/presentation/d/${googleSlidesId}/edit`;
      await ctx.firestore.collection("presentations").doc(input.presentationId).update({
        googleSlidesId,
        updatedAt: /* @__PURE__ */ new Date()
      });
      return {
        googleSlidesId,
        url,
        success: true
      };
    } catch (error) {
      throw createErrorHandler("Export to Google Slides")(error);
    }
  }),
  // Add collaborator
  addCollaborator: editorProcedure.input(z9.object({
    presentationId: z9.string(),
    email: z9.string().email()
  })).mutation(async ({ ctx, input }) => {
    try {
      const presentationRef = ctx.firestore.collection("presentations").doc(input.presentationId);
      const presentationDoc = await presentationRef.get();
      if (!presentationDoc.exists) {
        throw new TRPCError7({
          code: "NOT_FOUND",
          message: "Presentation not found"
        });
      }
      const presentationData = presentationDoc.data();
      if (presentationData.createdBy !== ctx.user.uid) {
        throw new TRPCError7({
          code: "FORBIDDEN",
          message: "Only the creator can add collaborators"
        });
      }
      const userSnapshot = await ctx.firestore.collection("users").where("email", "==", input.email).limit(1).get();
      if (userSnapshot.empty) {
        throw new TRPCError7({
          code: "NOT_FOUND",
          message: "User not found"
        });
      }
      const userId = userSnapshot.docs[0]?.id;
      if (!userId) {
        throw new TRPCError7({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get user ID"
        });
      }
      const collaborators = presentationData.collaborators || [];
      if (!collaborators.includes(userId)) {
        collaborators.push(userId);
        await presentationRef.update({ collaborators });
      }
      return { success: true };
    } catch (error) {
      throw createErrorHandler("Add collaborator")(error);
    }
  })
});
function generateTemplateSlides(templateId, title, description) {
  switch (templateId) {
    case "business":
      return [
        { id: "1", type: "title", content: { title, subtitle: description || "Business Proposal" } },
        { id: "2", type: "content", content: { title: "Executive Summary", body: "" } },
        { id: "3", type: "content", content: { title: "Problem Statement", body: "" } },
        { id: "4", type: "content", content: { title: "Our Solution", body: "" } },
        { id: "5", type: "content", content: { title: "Market Analysis", body: "" } },
        { id: "6", type: "content", content: { title: "Business Model", body: "" } },
        { id: "7", type: "content", content: { title: "Financial Projections", body: "" } },
        { id: "8", type: "content", content: { title: "Team", body: "" } },
        { id: "9", type: "content", content: { title: "Timeline", body: "" } },
        { id: "10", type: "content", content: { title: "Thank You", body: "Questions?" } }
      ];
    case "academic":
      return [
        { id: "1", type: "title", content: { title, subtitle: description || "Research Presentation" } },
        { id: "2", type: "content", content: { title: "Introduction", body: "" } },
        { id: "3", type: "content", content: { title: "Literature Review", body: "" } },
        { id: "4", type: "content", content: { title: "Research Questions", body: "" } },
        { id: "5", type: "content", content: { title: "Methodology", body: "" } },
        { id: "6", type: "content", content: { title: "Data Collection", body: "" } },
        { id: "7", type: "content", content: { title: "Results", body: "" } },
        { id: "8", type: "content", content: { title: "Analysis", body: "" } },
        { id: "9", type: "content", content: { title: "Discussion", body: "" } },
        { id: "10", type: "content", content: { title: "Conclusions", body: "" } },
        { id: "11", type: "content", content: { title: "Future Work", body: "" } },
        { id: "12", type: "content", content: { title: "References", body: "" } }
      ];
    default:
      return [
        { id: "1", type: "title", content: { title, subtitle: description || "Presentation" } }
      ];
  }
}
function getTemplateTheme(templateId) {
  switch (templateId) {
    case "business":
      return "business";
    case "academic":
      return "academic";
    default:
      return "default";
  }
}
async function simulateAIGeneration(prompt, type) {
  await new Promise((resolve) => setTimeout(resolve, 1e3));
  switch (type) {
    case "outline":
      return {
        title: "AI Generated Outline",
        body: `1. Introduction
   \u2022 Overview of ${prompt}
   \u2022 Key objectives

2. Main Points
   \u2022 First key concept
   \u2022 Supporting evidence
   \u2022 Real-world applications

3. Analysis
   \u2022 Data insights
   \u2022 Comparative analysis
   \u2022 Future implications

4. Conclusion
   \u2022 Summary of findings
   \u2022 Recommendations
   \u2022 Next steps`
      };
    case "bullets":
      return {
        title: "Key Points",
        body: `\u2022 ${prompt} - Main concept explained
\u2022 Supporting data and evidence
\u2022 Practical applications and examples
\u2022 Impact on current practices
\u2022 Future considerations and opportunities`
      };
    case "summary":
      return {
        title: "Summary",
        body: `This slide summarizes the key aspects of ${prompt}. The main points include the fundamental concepts, their practical applications, and the potential impact on the field. Further research and implementation strategies are recommended for optimal results.`
      };
    default:
      return {
        title: prompt.split(" ").slice(0, 5).join(" "),
        body: `${prompt}

This content explores the fundamental aspects and implications of the topic. Key considerations include:

1. Background and Context
The historical development and current state of the subject matter provide essential context for understanding its significance.

2. Core Concepts
Understanding the fundamental principles is crucial for effective implementation and application.

3. Practical Applications
Real-world use cases demonstrate the value and versatility of these concepts across various domains.

4. Future Outlook
Emerging trends and potential developments suggest exciting possibilities for continued growth and innovation.`
      };
  }
}

// src/routers/projects.ts
import { z as z10 } from "zod";
import { TRPCError as TRPCError8 } from "@trpc/server";
var createProjectSchema = z10.object({
  name: z10.string().min(1),
  description: z10.string().optional(),
  type: z10.enum(["paper", "presentation", "mixed"]).default("mixed"),
  visibility: z10.enum(["private", "team", "public"]).default("private")
});
var updateProjectSchema = z10.object({
  id: z10.string(),
  name: z10.string().min(1).optional(),
  description: z10.string().optional(),
  type: z10.enum(["paper", "presentation", "mixed"]).optional(),
  visibility: z10.enum(["private", "team", "public"]).optional(),
  status: z10.enum(["active", "completed", "archived"]).optional()
});
var projectMemberSchema = z10.object({
  projectId: z10.string(),
  email: z10.string().email(),
  role: z10.enum(["viewer", "editor", "admin"]).default("viewer")
});
var projectSchema = z10.object({
  id: z10.string(),
  name: z10.string(),
  description: z10.string().optional(),
  type: z10.enum(["paper", "presentation", "mixed"]),
  visibility: z10.enum(["private", "team", "public"]),
  status: z10.enum(["active", "completed", "archived"]),
  createdAt: z10.date(),
  updatedAt: z10.date(),
  createdBy: z10.string(),
  members: z10.array(z10.object({
    uid: z10.string(),
    email: z10.string(),
    name: z10.string(),
    role: z10.enum(["viewer", "editor", "admin"]),
    joinedAt: z10.date()
  })),
  stats: z10.object({
    paperCount: z10.number(),
    presentationCount: z10.number(),
    totalFiles: z10.number(),
    lastActivity: z10.date()
  })
});
var projectActivitySchema = z10.object({
  id: z10.string(),
  projectId: z10.string(),
  type: z10.enum(["create", "update", "delete", "share", "comment"]),
  action: z10.string(),
  description: z10.string(),
  createdAt: z10.date(),
  createdBy: z10.string(),
  createdByName: z10.string(),
  metadata: z10.record(z10.any()).optional()
});
var projectsRouter = router({
  // Get all projects for current user
  list: protectedProcedure.input(z10.object({
    type: z10.enum(["paper", "presentation", "mixed"]).optional(),
    status: z10.enum(["active", "completed", "archived"]).optional(),
    limit: z10.number().min(1).max(100).default(20),
    cursor: z10.string().optional()
  })).output(z10.object({
    projects: z10.array(projectSchema),
    nextCursor: z10.string().optional()
  })).query(async ({ ctx, input }) => {
    try {
      let query = ctx.firestore.collection("projects").where("memberIds", "array-contains", ctx.user.uid).orderBy("updatedAt", "desc");
      if (input.type) {
        query = query.where("type", "==", input.type);
      }
      if (input.status) {
        query = query.where("status", "==", input.status);
      }
      if (input.cursor) {
        const cursorDoc = await ctx.firestore.collection("projects").doc(input.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }
      const snapshot = await query.limit(input.limit + 1).get();
      const projects = [];
      let nextCursor;
      for (let i = 0; i < snapshot.docs.length; i++) {
        if (i === input.limit) {
          const cursorDoc = snapshot.docs[i];
          if (cursorDoc) {
            nextCursor = cursorDoc.id;
          }
          break;
        }
        const doc = snapshot.docs[i];
        if (!doc) continue;
        const data = doc.data();
        const stats = await getProjectStats(ctx, doc.id);
        const members = await getProjectMembers(ctx, data.members || []);
        projects.push({
          id: doc.id,
          name: data.name,
          description: data.description,
          type: data.type,
          visibility: data.visibility,
          status: data.status,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          createdBy: data.createdBy,
          members,
          stats
        });
      }
      return { projects, nextCursor };
    } catch (error) {
      throw createErrorHandler("List projects")(error);
    }
  }),
  // Get a specific project
  get: protectedProcedure.input(z10.object({ id: z10.string() })).output(projectSchema).query(async ({ ctx, input }) => {
    try {
      const doc = await ctx.firestore.collection("projects").doc(input.id).get();
      if (!doc.exists) {
        throw new TRPCError8({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      const data = doc.data();
      if (!data.memberIds?.includes(ctx.user.uid)) {
        throw new TRPCError8({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const stats = await getProjectStats(ctx, input.id);
      const members = await getProjectMembers(ctx, data.members || []);
      return {
        id: doc.id,
        name: data.name,
        description: data.description,
        type: data.type,
        visibility: data.visibility,
        status: data.status,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        createdBy: data.createdBy,
        members,
        stats
      };
    } catch (error) {
      throw createErrorHandler("Get project")(error);
    }
  }),
  // Create a new project
  create: editorProcedure.input(createProjectSchema).output(projectSchema).mutation(async ({ ctx, input }) => {
    try {
      const now = /* @__PURE__ */ new Date();
      const projectData = {
        name: input.name,
        description: input.description,
        type: input.type,
        visibility: input.visibility,
        status: "active",
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.user.uid,
        members: [{
          uid: ctx.user.uid,
          role: "admin",
          joinedAt: now
        }],
        memberIds: [ctx.user.uid]
        // For efficient querying
      };
      const docRef = await ctx.firestore.collection("projects").add(projectData);
      await logActivity(ctx, docRef.id, "create", "Created project", `Project "${input.name}" was created`);
      const stats = {
        paperCount: 0,
        presentationCount: 0,
        totalFiles: 0,
        lastActivity: now
      };
      const members = await getProjectMembers(ctx, projectData.members);
      return {
        id: docRef.id,
        ...projectData,
        members,
        stats
      };
    } catch (error) {
      throw createErrorHandler("Create project")(error);
    }
  }),
  // Update a project
  update: protectedProcedure.input(updateProjectSchema).output(projectSchema).mutation(async ({ ctx, input }) => {
    try {
      const docRef = ctx.firestore.collection("projects").doc(input.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new TRPCError8({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      const currentData = doc.data();
      const userMember = currentData.members?.find((m) => m.uid === ctx.user.uid);
      if (!userMember || userMember.role !== "admin") {
        throw new TRPCError8({
          code: "FORBIDDEN",
          message: "Admin role required"
        });
      }
      const updateData = {
        updatedAt: /* @__PURE__ */ new Date()
      };
      if (input.name) updateData.name = input.name;
      if (input.description !== void 0) updateData.description = input.description;
      if (input.type) updateData.type = input.type;
      if (input.visibility) updateData.visibility = input.visibility;
      if (input.status) updateData.status = input.status;
      await docRef.update(updateData);
      const changes = Object.keys(updateData).filter((k) => k !== "updatedAt");
      await logActivity(ctx, input.id, "update", "Updated project", `Updated: ${changes.join(", ")}`);
      const updatedDoc = await docRef.get();
      const updatedData = updatedDoc.data();
      const stats = await getProjectStats(ctx, input.id);
      const members = await getProjectMembers(ctx, updatedData.members || []);
      return {
        id: input.id,
        name: updatedData.name,
        description: updatedData.description,
        type: updatedData.type,
        visibility: updatedData.visibility,
        status: updatedData.status,
        createdAt: updatedData.createdAt.toDate(),
        updatedAt: updatedData.updatedAt.toDate(),
        createdBy: updatedData.createdBy,
        members,
        stats
      };
    } catch (error) {
      throw createErrorHandler("Update project")(error);
    }
  }),
  // Delete a project
  delete: protectedProcedure.input(z10.object({ id: z10.string() })).mutation(async ({ ctx, input }) => {
    try {
      const docRef = ctx.firestore.collection("projects").doc(input.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new TRPCError8({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      const data = doc.data();
      if (data.createdBy !== ctx.user.uid) {
        throw new TRPCError8({
          code: "FORBIDDEN",
          message: "Only the creator can delete this project"
        });
      }
      const activitiesSnapshot = await ctx.firestore.collection("project_activities").where("projectId", "==", input.id).get();
      const batch = ctx.firestore.batch();
      activitiesSnapshot.docs.forEach((doc2) => batch.delete(doc2.ref));
      batch.delete(docRef);
      await batch.commit();
      return { success: true };
    } catch (error) {
      throw createErrorHandler("Delete project")(error);
    }
  }),
  // Add member to project
  addMember: protectedProcedure.input(projectMemberSchema).mutation(async ({ ctx, input }) => {
    try {
      const projectRef = ctx.firestore.collection("projects").doc(input.projectId);
      const projectDoc = await projectRef.get();
      if (!projectDoc.exists) {
        throw new TRPCError8({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      const projectData = projectDoc.data();
      const userMember = projectData.members?.find((m) => m.uid === ctx.user.uid);
      if (!userMember || userMember.role !== "admin") {
        throw new TRPCError8({
          code: "FORBIDDEN",
          message: "Admin role required"
        });
      }
      const userSnapshot = await ctx.firestore.collection("users").where("email", "==", input.email).limit(1).get();
      if (userSnapshot.empty) {
        throw new TRPCError8({
          code: "NOT_FOUND",
          message: "User not found"
        });
      }
      const userDoc = userSnapshot.docs[0];
      if (!userDoc) {
        throw new TRPCError8({
          code: "NOT_FOUND",
          message: "User document not found"
        });
      }
      const userId = userDoc.id;
      const members = projectData.members || [];
      const memberIds = projectData.memberIds || [];
      if (members.some((m) => m.uid === userId)) {
        throw new TRPCError8({
          code: "BAD_REQUEST",
          message: "User is already a member"
        });
      }
      const newMember = {
        uid: userId,
        role: input.role,
        joinedAt: /* @__PURE__ */ new Date()
      };
      members.push(newMember);
      memberIds.push(userId);
      await projectRef.update({
        members,
        memberIds,
        updatedAt: /* @__PURE__ */ new Date()
      });
      const userDocForLog = userSnapshot.docs[0];
      if (!userDocForLog) {
        throw new TRPCError8({
          code: "NOT_FOUND",
          message: "User document not found"
        });
      }
      const userName = userDocForLog.data().name;
      await logActivity(
        ctx,
        input.projectId,
        "share",
        "Added member",
        `${userName} was added as ${input.role}`
      );
      return { success: true };
    } catch (error) {
      throw createErrorHandler("Add member")(error);
    }
  }),
  // Remove member from project
  removeMember: protectedProcedure.input(z10.object({
    projectId: z10.string(),
    userId: z10.string()
  })).mutation(async ({ ctx, input }) => {
    try {
      const projectRef = ctx.firestore.collection("projects").doc(input.projectId);
      const projectDoc = await projectRef.get();
      if (!projectDoc.exists) {
        throw new TRPCError8({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      const projectData = projectDoc.data();
      const userMember = projectData.members?.find((m) => m.uid === ctx.user.uid);
      if (!userMember || userMember.role !== "admin" && ctx.user.uid !== input.userId) {
        throw new TRPCError8({
          code: "FORBIDDEN",
          message: "Permission denied"
        });
      }
      if (projectData.createdBy === input.userId) {
        throw new TRPCError8({
          code: "BAD_REQUEST",
          message: "Cannot remove project creator"
        });
      }
      const members = (projectData.members || []).filter((m) => m.uid !== input.userId);
      const memberIds = (projectData.memberIds || []).filter((id) => id !== input.userId);
      await projectRef.update({
        members,
        memberIds,
        updatedAt: /* @__PURE__ */ new Date()
      });
      const userDoc = await ctx.firestore.collection("users").doc(input.userId).get();
      const userName = userDoc.data()?.name || "Unknown User";
      await logActivity(
        ctx,
        input.projectId,
        "update",
        "Removed member",
        `${userName} was removed from the project`
      );
      return { success: true };
    } catch (error) {
      throw createErrorHandler("Remove member")(error);
    }
  }),
  // Get project activity feed
  getActivity: protectedProcedure.input(z10.object({
    projectId: z10.string(),
    limit: z10.number().min(1).max(100).default(20),
    cursor: z10.string().optional()
  })).output(z10.object({
    activities: z10.array(projectActivitySchema),
    nextCursor: z10.string().optional()
  })).query(async ({ ctx, input }) => {
    try {
      const projectDoc = await ctx.firestore.collection("projects").doc(input.projectId).get();
      if (!projectDoc.exists) {
        throw new TRPCError8({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }
      const projectData = projectDoc.data();
      if (!projectData.memberIds?.includes(ctx.user.uid)) {
        throw new TRPCError8({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      let query = ctx.firestore.collection("project_activities").where("projectId", "==", input.projectId).orderBy("createdAt", "desc");
      if (input.cursor) {
        const cursorDoc = await ctx.firestore.collection("project_activities").doc(input.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }
      const snapshot = await query.limit(input.limit + 1).get();
      const activities = [];
      let nextCursor;
      for (let i = 0; i < snapshot.docs.length; i++) {
        if (i === input.limit) {
          const cursorDoc = snapshot.docs[i];
          if (cursorDoc) {
            nextCursor = cursorDoc.id;
          }
          break;
        }
        const doc = snapshot.docs[i];
        if (!doc) continue;
        const data = doc.data();
        activities.push({
          id: doc.id,
          projectId: data.projectId,
          type: data.type,
          action: data.action,
          description: data.description,
          createdAt: data.createdAt.toDate(),
          createdBy: data.createdBy,
          createdByName: data.createdByName,
          metadata: data.metadata
        });
      }
      return { activities, nextCursor };
    } catch (error) {
      throw createErrorHandler("Get project activity")(error);
    }
  })
});
async function getProjectStats(ctx, projectId) {
  try {
    const papersSnapshot = await ctx.firestore.collection("papers").where("projectId", "==", projectId).get();
    const presentationsSnapshot = await ctx.firestore.collection("presentations").where("projectId", "==", projectId).get();
    const activitySnapshot = await ctx.firestore.collection("project_activities").where("projectId", "==", projectId).orderBy("createdAt", "desc").limit(1).get();
    const lastActivity = activitySnapshot.empty ? /* @__PURE__ */ new Date() : (() => {
      const doc = activitySnapshot.docs[0];
      if (!doc) return /* @__PURE__ */ new Date();
      const data = doc.data();
      return data.createdAt.toDate();
    })();
    return {
      paperCount: papersSnapshot.size,
      presentationCount: presentationsSnapshot.size,
      totalFiles: papersSnapshot.size + presentationsSnapshot.size,
      lastActivity
    };
  } catch {
    return {
      paperCount: 0,
      presentationCount: 0,
      totalFiles: 0,
      lastActivity: /* @__PURE__ */ new Date()
    };
  }
}
async function getProjectMembers(ctx, members) {
  const memberDetails = await Promise.all(
    members.map(async (member) => {
      try {
        const userDoc = await ctx.firestore.collection("users").doc(member.uid).get();
        const userData = userDoc.data();
        return {
          uid: member.uid,
          email: userData?.email || "",
          name: userData?.name || "Unknown User",
          role: member.role,
          joinedAt: member.joinedAt instanceof Date ? member.joinedAt : new Date(member.joinedAt)
        };
      } catch {
        return {
          uid: member.uid,
          email: "",
          name: "Unknown User",
          role: member.role,
          joinedAt: /* @__PURE__ */ new Date()
        };
      }
    })
  );
  return memberDetails;
}
async function logActivity(ctx, projectId, type, action, description, metadata) {
  try {
    const userDoc = await ctx.firestore.collection("users").doc(ctx.user.uid).get();
    const userName = userDoc.data()?.name || "Unknown User";
    await ctx.firestore.collection("project_activities").add({
      projectId,
      type,
      action,
      description,
      createdAt: /* @__PURE__ */ new Date(),
      createdBy: ctx.user.uid,
      createdByName: userName,
      metadata
    });
  } catch {
  }
}

// src/routers/chat.ts
import { z as z11 } from "zod";
import { TRPCError as TRPCError9 } from "@trpc/server";
var chatMessageSchema = z11.object({
  content: z11.string().min(1).max(4e3),
  context: z11.object({
    type: z11.enum(["paper", "presentation", "project", "general"]).optional(),
    id: z11.string().optional(),
    // paper/presentation/project ID
    metadata: z11.record(z11.any()).optional()
  }).optional()
});
var chatSessionSchema = z11.object({
  title: z11.string().min(1).max(200).optional(),
  context: z11.object({
    type: z11.enum(["paper", "presentation", "project", "general"]),
    id: z11.string().optional(),
    metadata: z11.record(z11.any()).optional()
  }).optional()
});
var updateChatSessionSchema = z11.object({
  sessionId: z11.string(),
  title: z11.string().min(1).max(200).optional(),
  archived: z11.boolean().optional()
});
var messageSchema = z11.object({
  id: z11.string(),
  role: z11.enum(["user", "assistant", "system"]),
  content: z11.string(),
  timestamp: z11.date(),
  status: z11.enum(["pending", "completed", "error"]).optional(),
  metadata: z11.record(z11.any()).optional()
});
var chatSessionOutputSchema = z11.object({
  id: z11.string(),
  title: z11.string(),
  context: z11.object({
    type: z11.enum(["paper", "presentation", "project", "general"]),
    id: z11.string().optional(),
    metadata: z11.record(z11.any()).optional()
  }).optional(),
  createdAt: z11.date(),
  updatedAt: z11.date(),
  createdBy: z11.string(),
  messageCount: z11.number(),
  archived: z11.boolean(),
  lastMessage: messageSchema.optional()
});
var chatRouter = router({
  // Create a new chat session
  createSession: protectedProcedure.use(rateLimit(20, 60 * 60 * 1e3)).input(chatSessionSchema).output(chatSessionOutputSchema).mutation(async ({ ctx, input }) => {
    try {
      const now = /* @__PURE__ */ new Date();
      const sessionData = {
        title: input.title || "New Chat",
        context: input.context,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.user.uid,
        messageCount: 0,
        archived: false
      };
      const docRef = await ctx.firestore.collection("chat_sessions").add(sessionData);
      return {
        id: docRef.id,
        ...sessionData,
        lastMessage: void 0
      };
    } catch (error) {
      throw createErrorHandler("Create chat session")(error);
    }
  }),
  // Get all chat sessions for current user
  getSessions: protectedProcedure.input(z11.object({
    archived: z11.boolean().default(false),
    limit: z11.number().min(1).max(100).default(20),
    cursor: z11.string().optional()
  })).output(z11.object({
    sessions: z11.array(chatSessionOutputSchema),
    nextCursor: z11.string().optional()
  })).query(async ({ ctx, input }) => {
    try {
      let query = ctx.firestore.collection("chat_sessions").where("createdBy", "==", ctx.user.uid).where("archived", "==", input.archived).orderBy("updatedAt", "desc");
      if (input.cursor) {
        const cursorDoc = await ctx.firestore.collection("chat_sessions").doc(input.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }
      const snapshot = await query.limit(input.limit + 1).get();
      const sessions = [];
      let nextCursor;
      for (let i = 0; i < snapshot.docs.length; i++) {
        if (i === input.limit) {
          const cursorDoc = snapshot.docs[i];
          if (cursorDoc) {
            nextCursor = cursorDoc.id;
          }
          break;
        }
        const doc = snapshot.docs[i];
        if (!doc) continue;
        const data = doc.data();
        const lastMessageSnapshot = await ctx.firestore.collection("chat_messages").where("sessionId", "==", doc.id).orderBy("timestamp", "desc").limit(1).get();
        let lastMessage;
        if (!lastMessageSnapshot.empty) {
          const msgDoc = lastMessageSnapshot.docs[0];
          if (!msgDoc) continue;
          const msgData = msgDoc.data();
          lastMessage = {
            id: msgDoc.id,
            role: msgData.role,
            content: msgData.content,
            timestamp: msgData.timestamp.toDate(),
            status: msgData.status,
            metadata: msgData.metadata
          };
        }
        sessions.push({
          id: doc.id,
          title: data.title,
          context: data.context,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          createdBy: data.createdBy,
          messageCount: data.messageCount || 0,
          archived: data.archived || false,
          lastMessage
        });
      }
      return { sessions, nextCursor };
    } catch (error) {
      throw createErrorHandler("Get chat sessions")(error);
    }
  }),
  // Get a specific chat session with messages
  getSession: protectedProcedure.input(z11.object({
    sessionId: z11.string(),
    messageLimit: z11.number().min(1).max(100).default(50),
    messageCursor: z11.string().optional()
  })).output(z11.object({
    session: chatSessionOutputSchema,
    messages: z11.array(messageSchema),
    nextMessageCursor: z11.string().optional()
  })).query(async ({ ctx, input }) => {
    try {
      const sessionDoc = await ctx.firestore.collection("chat_sessions").doc(input.sessionId).get();
      if (!sessionDoc.exists) {
        throw new TRPCError9({
          code: "NOT_FOUND",
          message: "Chat session not found"
        });
      }
      const sessionData = sessionDoc.data();
      if (sessionData.createdBy !== ctx.user.uid) {
        throw new TRPCError9({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      let messageQuery = ctx.firestore.collection("chat_messages").where("sessionId", "==", input.sessionId).orderBy("timestamp", "asc");
      if (input.messageCursor) {
        const cursorDoc = await ctx.firestore.collection("chat_messages").doc(input.messageCursor).get();
        if (cursorDoc.exists) {
          messageQuery = messageQuery.startAfter(cursorDoc);
        }
      }
      const messageSnapshot = await messageQuery.limit(input.messageLimit + 1).get();
      const messages = [];
      let nextMessageCursor;
      for (let i = 0; i < messageSnapshot.docs.length; i++) {
        if (i === input.messageLimit) {
          const cursorDoc = messageSnapshot.docs[i];
          if (cursorDoc) {
            nextMessageCursor = cursorDoc.id;
          }
          break;
        }
        const doc = messageSnapshot.docs[i];
        if (!doc) continue;
        const data = doc.data();
        messages.push({
          id: doc.id,
          role: data.role,
          content: data.content,
          timestamp: data.timestamp.toDate(),
          status: data.status,
          metadata: data.metadata
        });
      }
      const session = {
        id: input.sessionId,
        title: sessionData.title,
        context: sessionData.context,
        createdAt: sessionData.createdAt.toDate(),
        updatedAt: sessionData.updatedAt.toDate(),
        createdBy: sessionData.createdBy,
        messageCount: sessionData.messageCount || 0,
        archived: sessionData.archived || false,
        lastMessage: messages.length > 0 ? messages[messages.length - 1] : void 0
      };
      return { session, messages, nextMessageCursor };
    } catch (error) {
      throw createErrorHandler("Get chat session")(error);
    }
  }),
  // Send a message in a chat session
  sendMessage: protectedProcedure.use(rateLimit(100, 60 * 60 * 1e3)).input(z11.object({
    sessionId: z11.string(),
    message: chatMessageSchema
  })).output(z11.object({
    userMessage: messageSchema,
    assistantMessage: messageSchema
  })).mutation(async ({ ctx, input }) => {
    try {
      const sessionDoc = await ctx.firestore.collection("chat_sessions").doc(input.sessionId).get();
      if (!sessionDoc.exists) {
        throw new TRPCError9({
          code: "NOT_FOUND",
          message: "Chat session not found"
        });
      }
      const sessionData = sessionDoc.data();
      if (sessionData.createdBy !== ctx.user.uid) {
        throw new TRPCError9({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const now = /* @__PURE__ */ new Date();
      const userMessageData = {
        sessionId: input.sessionId,
        role: "user",
        content: input.message.content,
        timestamp: now,
        status: "completed",
        context: input.message.context
      };
      const userMessageRef = await ctx.firestore.collection("chat_messages").add(userMessageData);
      const assistantResponse = await generateAIResponse(
        input.message.content,
        input.message.context
      );
      const assistantMessageData = {
        sessionId: input.sessionId,
        role: "assistant",
        content: assistantResponse.content,
        timestamp: /* @__PURE__ */ new Date(),
        status: "completed",
        metadata: assistantResponse.metadata
      };
      const assistantMessageRef = await ctx.firestore.collection("chat_messages").add(assistantMessageData);
      await ctx.firestore.collection("chat_sessions").doc(input.sessionId).update({
        updatedAt: /* @__PURE__ */ new Date(),
        messageCount: (sessionData.messageCount || 0) + 2,
        title: sessionData.messageCount === 0 ? generateSessionTitle(input.message.content) : sessionData.title
      });
      return {
        userMessage: {
          id: userMessageRef.id,
          ...userMessageData
        },
        assistantMessage: {
          id: assistantMessageRef.id,
          ...assistantMessageData
        }
      };
    } catch (error) {
      throw createErrorHandler("Send message")(error);
    }
  }),
  // Update chat session
  updateSession: protectedProcedure.input(updateChatSessionSchema).output(chatSessionOutputSchema).mutation(async ({ ctx, input }) => {
    try {
      const sessionRef = ctx.firestore.collection("chat_sessions").doc(input.sessionId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        throw new TRPCError9({
          code: "NOT_FOUND",
          message: "Chat session not found"
        });
      }
      const sessionData = sessionDoc.data();
      if (sessionData.createdBy !== ctx.user.uid) {
        throw new TRPCError9({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const updateData = {
        updatedAt: /* @__PURE__ */ new Date()
      };
      if (input.title) updateData.title = input.title;
      if (input.archived !== void 0) updateData.archived = input.archived;
      await sessionRef.update(updateData);
      const updatedDoc = await sessionRef.get();
      const updatedData = updatedDoc.data();
      return {
        id: input.sessionId,
        title: updatedData.title,
        context: updatedData.context,
        createdAt: updatedData.createdAt.toDate(),
        updatedAt: updatedData.updatedAt.toDate(),
        createdBy: updatedData.createdBy,
        messageCount: updatedData.messageCount || 0,
        archived: updatedData.archived || false,
        lastMessage: void 0
        // Could fetch if needed
      };
    } catch (error) {
      throw createErrorHandler("Update chat session")(error);
    }
  }),
  // Delete chat session
  deleteSession: protectedProcedure.input(z11.object({ sessionId: z11.string() })).mutation(async ({ ctx, input }) => {
    try {
      const sessionRef = ctx.firestore.collection("chat_sessions").doc(input.sessionId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        throw new TRPCError9({
          code: "NOT_FOUND",
          message: "Chat session not found"
        });
      }
      const sessionData = sessionDoc.data();
      if (sessionData.createdBy !== ctx.user.uid) {
        throw new TRPCError9({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const messagesSnapshot = await ctx.firestore.collection("chat_messages").where("sessionId", "==", input.sessionId).get();
      const batch = ctx.firestore.batch();
      messagesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(sessionRef);
      await batch.commit();
      return { success: true };
    } catch (error) {
      throw createErrorHandler("Delete chat session")(error);
    }
  })
});
async function generateAIResponse(userMessage, context) {
  try {
    const { PlannerAgent, createVertexAIClient, RTFParser } = await import("@maria/ai-agents");
    const vertexAI = createVertexAIClient();
    const planner = new PlannerAgent(vertexAI);
    const rtfParser = new RTFParser(vertexAI);
    const typedContext = context;
    const rtfStructure = await rtfParser.parseRTF(userMessage, {
      type: typedContext?.type,
      userProfile: {}
    });
    let response = "";
    const metadata = {
      rtfConfidence: rtfStructure.confidence,
      taskType: rtfStructure.task.type,
      intent: rtfStructure.task.intent,
      complexity: rtfStructure.metadata.complexity
    };
    if (rtfStructure.task.scope !== "single-action" || rtfStructure.task.intent.includes("plan") || rtfStructure.task.intent.includes("create") || rtfStructure.task.intent.includes("develop")) {
      const taskPlan = await planner.createTaskPlan(userMessage, {
        type: typedContext?.type
      });
      response = generatePlanningResponse(taskPlan, rtfStructure);
      metadata.planId = taskPlan.id;
      metadata.hasSOW = !!taskPlan.sowDocument;
      metadata.executionSteps = taskPlan.executionPlan.length;
    } else {
      response = await generateConversationalResponse(userMessage, rtfStructure, typedContext);
    }
    metadata.responseLength = response.length;
    metadata.generatedAt = (/* @__PURE__ */ new Date()).toISOString();
    metadata.contextType = typedContext?.type || "general";
    return { content: response, metadata };
  } catch (error) {
    console.error("AI response generation failed, falling back to simple response:", error);
    return generateFallbackResponse(userMessage, context);
  }
}
function generatePlanningResponse(taskPlan, rtfStructure) {
  const steps = taskPlan.executionPlan.map(
    (step, index) => `${index + 1}. **${step.name}** (${step.estimatedTime}h)
   ${step.description}`
  ).join("\n\n");
  return `I've analyzed your request and created a comprehensive plan for "${taskPlan.title}".

## Task Analysis
- **Type**: ${rtfStructure.task.type}
- **Complexity**: ${rtfStructure.metadata.complexity}
- **Scope**: ${rtfStructure.task.scope}

## Execution Plan
${steps}

## Next Steps
${taskPlan.sowDocument ? "I've also generated a detailed Statement of Work (SOW) with budget estimates, risk analysis, and timeline. Would you like me to share those details?" : "Would you like me to start working on the first step, or would you prefer to refine the plan first?"}

How would you like to proceed?`;
}
async function generateConversationalResponse(userMessage, rtfStructure, context) {
  const { createVertexAIClient } = await import("@maria/ai-agents");
  const vertexAI = createVertexAIClient();
  const model = await vertexAI.getGeminiModel();
  const conversationPrompt = `
You are an AI assistant in the MARIA platform specialized in helping with ${rtfStructure.task.type} tasks.

User Message: "${userMessage}"
Intent: ${rtfStructure.task.intent}
Context Type: ${context?.type || "general"}
Complexity: ${rtfStructure.metadata.complexity}

Generate a helpful, conversational response that:
1. Acknowledges the user's request
2. Provides specific, actionable guidance
3. Offers to help with next steps
4. Maintains a professional but friendly tone

Focus on being practical and helpful for ${rtfStructure.task.type} work.
`;
  try {
    const result = await model.generateContent(conversationPrompt);
    return result.response.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, but I encountered an issue generating a response.";
  } catch (error) {
    console.error("Failed to generate conversational response:", error);
    return `I understand you're asking about "${userMessage}". I'm here to help with your ${rtfStructure.task.type} work. Could you provide more specific details about what you'd like assistance with?`;
  }
}
async function generateFallbackResponse(userMessage, context) {
  let response = "";
  const metadata = {};
  const typedContext = context;
  if (typedContext?.type === "paper") {
    response = generatePaperContextResponse(userMessage);
    metadata.contextType = "paper";
  } else if (typedContext?.type === "presentation") {
    response = generatePresentationContextResponse(userMessage);
    metadata.contextType = "presentation";
  } else if (typedContext?.type === "project") {
    response = generateProjectContextResponse(userMessage);
    metadata.contextType = "project";
  } else {
    response = generateGeneralResponse(userMessage);
    metadata.contextType = "general";
  }
  metadata.responseLength = response.length;
  metadata.generatedAt = (/* @__PURE__ */ new Date()).toISOString();
  metadata.fallback = true;
  return { content: response, metadata };
}
function generatePaperContextResponse(message) {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes("help") || lowerMessage.includes("how")) {
    return `For your LaTeX paper, I can help you with:

\u2022 **Writing & Structure**: Improve your introduction, methodology, or conclusions
\u2022 **Citations & References**: Format your bibliography and manage citations
\u2022 **Mathematical Notation**: Help with LaTeX math commands and equations
\u2022 **Formatting**: Ensure your document follows journal/conference guidelines
\u2022 **Review & Feedback**: Provide suggestions for clarity and academic writing

What specific aspect of your paper would you like assistance with?`;
  }
  if (lowerMessage.includes("cite") || lowerMessage.includes("reference") || lowerMessage.includes("bibliography")) {
    return `For citations and references in your paper:

**BibTeX Management:**
\u2022 Use \\cite{key} for in-text citations
\u2022 Add entries to your .bib file in the format: @article{key, author={}, title={}, journal={}, year={}}
\u2022 Use \\bibliography{filename} to include your bibliography

**Common Citation Styles:**
\u2022 IEEE: \\bibliographystyle{IEEEtran}
\u2022 ACM: \\bibliographystyle{ACM-Reference-Format}
\u2022 Plain: \\bibliographystyle{plain}

Would you like help with a specific citation format or managing your references?`;
  }
  if (lowerMessage.includes("latex") || lowerMessage.includes("format") || lowerMessage.includes("template")) {
    return `I can help you with LaTeX formatting for your paper:

**Document Structure:**
\u2022 \\documentclass{article} or \\documentclass[conference]{IEEEtran}
\u2022 Use \\section{}, \\subsection{}, \\subsubsection{} for organization
\u2022 \\begin{abstract}...\\end{abstract} for your abstract

**Mathematical Notation:**
\u2022 Inline math: $equation$
\u2022 Display math: \\[equation\\] or \\begin{equation}...\\end{equation}
\u2022 Common symbols: \\alpha, \\beta, \\sum, \\int, \\frac{}{}, \\sqrt{}

**Figures and Tables:**
\u2022 \\begin{figure}[h] for figures with \\includegraphics{}
\u2022 \\begin{table}[h] for tables with tabular environment

What specific formatting help do you need?`;
  }
  return `I'm here to help with your academic paper! Based on your message about "${message}", I can assist with:

\u2022 **Content Development**: Help expand on your ideas and arguments
\u2022 **Structure & Flow**: Improve the logical organization of your paper
\u2022 **Academic Writing**: Enhance clarity, conciseness, and scholarly tone
\u2022 **Technical Details**: LaTeX formatting, citations, and mathematical notation

Could you tell me more specifically what you'd like help with regarding your paper?`;
}
function generatePresentationContextResponse(message) {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes("slide") || lowerMessage.includes("content")) {
    return `For your presentation, I can help create engaging slide content:

**Content Generation:**
\u2022 **Title Slides**: Compelling titles and subtitles
\u2022 **Bullet Points**: Clear, concise key points
\u2022 **Narratives**: Storytelling elements to connect with your audience
\u2022 **Conclusions**: Strong closing statements and calls to action

**Structure Suggestions:**
\u2022 Problem \u2192 Solution \u2192 Benefits approach
\u2022 Chronological storytelling
\u2022 Comparison and contrast formats
\u2022 Data-driven insights with visualizations

**Speaking Notes:**
\u2022 Key talking points for each slide
\u2022 Transition phrases between topics
\u2022 Audience engagement techniques

What type of content would you like me to help generate for your slides?`;
  }
  if (lowerMessage.includes("design") || lowerMessage.includes("visual") || lowerMessage.includes("template") || lowerMessage.includes("theme")) {
    return `I can help with presentation design and visual elements:

**Design Principles:**
\u2022 **Consistency**: Maintain uniform fonts, colors, and layouts
\u2022 **Clarity**: Use high contrast and readable fonts (minimum 24pt)
\u2022 **Simplicity**: Limit to 6-8 lines of text per slide
\u2022 **Visual Hierarchy**: Use size and color to guide attention

**Template Recommendations:**
\u2022 **Business**: Professional colors (blues, grays), clean layouts
\u2022 **Academic**: Conservative design, focus on content over aesthetics
\u2022 **Creative**: Bold colors and dynamic layouts for engagement

**Visual Elements:**
\u2022 Use high-quality images and icons
\u2022 Incorporate charts and graphs for data
\u2022 Consider infographics for complex concepts

Would you like specific suggestions for your presentation's visual design?`;
  }
  return `I'm ready to help with your presentation! For "${message}", I can assist with:

\u2022 **Content Creation**: Generate compelling slide content and speaker notes
\u2022 **Structure Planning**: Organize your ideas for maximum impact
\u2022 **Audience Engagement**: Techniques to keep your audience interested
\u2022 **Design Guidance**: Visual elements and layout suggestions

What aspect of your presentation would you like to work on?`;
}
function generateProjectContextResponse(message) {
  return `For your project, I can help with:

**Project Management:**
\u2022 Task organization and prioritization
\u2022 Timeline planning and milestone tracking
\u2022 Team collaboration and communication strategies
\u2022 Progress monitoring and reporting

**Content Coordination:**
\u2022 Aligning papers and presentations with project goals
\u2022 Maintaining consistency across project deliverables
\u2022 Version control and document management
\u2022 Quality assurance and review processes

**Analysis & Insights:**
\u2022 Project metrics and performance analysis
\u2022 Identifying bottlenecks and improvement opportunities
\u2022 Resource allocation and optimization
\u2022 Risk assessment and mitigation strategies

Based on your message "${message}", what specific aspect of your project management would you like assistance with?`;
}
function generateGeneralResponse(message) {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes("hello") || lowerMessage.includes("hi") || lowerMessage.includes("hey")) {
    return `Hello! I'm your AI assistant for MARIA Studio. I'm here to help you with:

\u2022 **Academic Papers**: LaTeX writing, citations, structure, and formatting
\u2022 **Presentations**: Slide content, design, and delivery preparation  
\u2022 **Project Management**: Organization, collaboration, and workflow optimization
\u2022 **Research Support**: Literature review, data analysis, and methodology guidance

How can I assist you today?`;
  }
  if (lowerMessage.includes("help") || lowerMessage.includes("what can you do")) {
    return `I can help you with various aspects of academic and professional work:

**\u{1F4DD} Writing & Research**
\u2022 Academic paper writing and structure
\u2022 Literature reviews and citation management
\u2022 Research methodology and data analysis
\u2022 Technical documentation

**\u{1F3AF} Presentations**
\u2022 Slide content creation and organization
\u2022 Visual design and layout suggestions
\u2022 Speaker notes and delivery tips
\u2022 Audience engagement strategies

**\u{1F4CA} Project Management**
\u2022 Task planning and timeline creation
\u2022 Team collaboration workflows
\u2022 Progress tracking and reporting
\u2022 Quality assurance processes

**\u{1F527} Technical Support**
\u2022 LaTeX formatting and troubleshooting
\u2022 Bibliography management with BibTeX
\u2022 Document templates and styling
\u2022 Export and sharing options

What would you like to work on?`;
  }
  return `I understand you're asking about "${message}". I'm here to provide comprehensive support for your academic and professional work.

Whether you need help with writing, research, presentations, or project management, I can offer:

\u2022 **Detailed guidance** on best practices and methodologies
\u2022 **Practical suggestions** for improving your work
\u2022 **Technical assistance** with tools and formatting
\u2022 **Creative ideas** to enhance your content

Could you provide more specific details about what you're looking for? This will help me give you the most relevant and useful assistance.`;
}
function generateSessionTitle(firstMessage) {
  const words = firstMessage.split(" ").slice(0, 6);
  let title = words.join(" ");
  if (firstMessage.length > title.length) {
    title += "...";
  }
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return title.length > 50 ? title.substring(0, 47) + "..." : title;
}

// src/routers/graph.ts
import { z as z12 } from "zod";

// src/lib/neo4j-bloom.ts
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { createHmac } from "crypto";
var Neo4jBloomService = class {
  constructor(config) {
    this.config = config;
    this.secretClient = new SecretManagerServiceClient();
  }
  secretClient;
  jwtSecret;
  async getJWTSecret() {
    if (this.jwtSecret) return this.jwtSecret;
    const secretName = `projects/${this.config.projectId}/secrets/NEO4J_BLOOM_JWT_SECRET/versions/latest`;
    const [version] = await this.secretClient.accessSecretVersion({ name: secretName });
    if (!version.payload?.data) {
      throw new Error("Failed to retrieve JWT secret");
    }
    this.jwtSecret = version.payload.data.toString();
    return this.jwtSecret;
  }
  base64urlEncode(str) {
    return Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }
  async generateJWT(payload) {
    const header = {
      alg: "HS256",
      typ: "JWT"
    };
    const encodedHeader = this.base64urlEncode(JSON.stringify(header));
    const encodedPayload = this.base64urlEncode(JSON.stringify(payload));
    const secret = await this.getJWTSecret();
    const signature = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }
  async generateBloomURL(userEmail, userRole, options = {}) {
    const now = Math.floor(Date.now() / 1e3);
    const ttl = options.ttl || 900;
    const exp = now + ttl;
    const payload = {
      sub: userEmail,
      iss: "maria-platform",
      aud: "neo4j-bloom",
      neo4j: {
        dbid: this.config.neo4jDbId,
        user: userEmail.split("@")[0] || userEmail,
        // username from email or full email if no @
        roles: [userRole]
      },
      iat: now,
      exp
    };
    const jwt = await this.generateJWT(payload);
    const baseUrl = `https://${this.config.neo4jHost}/bloom/embed`;
    const params = new URLSearchParams({
      jwt,
      ...options.perspective && { perspective: options.perspective },
      ...options.search && { search: options.search }
    });
    return {
      url: `${baseUrl}?${params.toString()}`,
      expiresAt: new Date(exp * 1e3).toISOString()
    };
  }
  async verifyUserAccess(userEmail) {
    return userEmail ? "reader" : null;
  }
};

// src/routers/graph.ts
import { TRPCError as TRPCError10 } from "@trpc/server";
var bloomService = new Neo4jBloomService({
  projectId: process.env.GCP_PROJECT_ID || "maria-code",
  neo4jHost: process.env.NEO4J_HOST || "",
  neo4jDbId: process.env.NEO4J_DB_ID || ""
});
var graphRouter = router({
  // Generate JWT URL for Neo4j Bloom
  getBloomUrl: protectedProcedure.input(
    z12.object({
      perspective: z12.string().optional(),
      search: z12.string().optional(),
      ttl: z12.number().min(60).max(3600).optional()
      // 1 min to 1 hour
    })
  ).mutation(async ({ ctx, input }) => {
    if (!ctx.user.email) {
      throw new TRPCError10({
        code: "UNAUTHORIZED",
        message: "User email is required"
      });
    }
    const userEmail = ctx.user.email;
    const userRole = await bloomService.verifyUserAccess(userEmail);
    if (!userRole) {
      throw new TRPCError10({
        code: "FORBIDDEN",
        message: "You do not have access to this project's graph"
      });
    }
    const { url, expiresAt } = await bloomService.generateBloomURL(
      userEmail,
      userRole,
      input
    );
    return {
      url,
      expiresAt,
      role: userRole
    };
  }),
  // Get graph statistics
  getStats: protectedProcedure.query(async () => {
    return {
      nodes: {
        total: 0,
        byType: {}
      },
      relationships: {
        total: 0,
        byType: {}
      }
    };
  }),
  // Execute Cypher query (limited to read-only)
  query: protectedProcedure.input(
    z12.object({
      cypher: z12.string(),
      params: z12.record(z12.any()).optional()
    })
  ).mutation(async ({ input }) => {
    const writeKeywords = ["CREATE", "DELETE", "SET", "MERGE", "REMOVE"];
    const upperQuery = input.cypher.toUpperCase();
    const hasWriteOperation = writeKeywords.some(
      (keyword) => upperQuery.includes(keyword)
    );
    if (hasWriteOperation) {
      throw new TRPCError10({
        code: "BAD_REQUEST",
        message: "Only read queries are allowed"
      });
    }
    return {
      records: [],
      summary: {
        nodesCreated: 0,
        relationshipsCreated: 0,
        resultAvailableAfter: 0,
        resultConsumedAfter: 0
      }
    };
  })
});

// src/routers/conversation.ts
import { z as z13 } from "zod";
import { TRPCError as TRPCError11 } from "@trpc/server";
var createTaskPlanSchema = z13.object({
  input: z13.string().min(1).max(8e3),
  context: z13.object({
    type: z13.enum(["paper", "presentation", "project", "general"]).optional(),
    sessionId: z13.string().optional(),
    stakeholders: z13.array(z13.string()).optional(),
    budget: z13.number().positive().optional(),
    timeline: z13.string().optional()
  }).optional()
});
var refineTaskPlanSchema = z13.object({
  planId: z13.string(),
  feedback: z13.string().min(1).max(4e3),
  sessionId: z13.string().optional()
});
var executeTaskPlanSchema = z13.object({
  planId: z13.string(),
  options: z13.object({
    autoExecute: z13.boolean().default(false),
    sessionId: z13.string().optional()
  }).optional()
});
var parseRTFSchema = z13.object({
  input: z13.string().min(1).max(8e3),
  context: z13.object({
    type: z13.string().optional(),
    previousMessages: z13.array(z13.string()).optional(),
    userProfile: z13.record(z13.any()).optional()
  }).optional()
});
var generateSOWSchema = z13.object({
  planId: z13.string(),
  options: z13.object({
    projectName: z13.string().optional(),
    stakeholders: z13.array(z13.string()).optional(),
    budget: z13.number().positive().optional(),
    timeline: z13.string().optional(),
    template: z13.string().optional()
  }).optional()
});
var taskPlanSchema = z13.object({
  id: z13.string(),
  title: z13.string(),
  description: z13.string(),
  rtfStructure: z13.record(z13.any()),
  sowDocument: z13.record(z13.any()).optional(),
  executionPlan: z13.array(z13.object({
    id: z13.string(),
    name: z13.string(),
    description: z13.string(),
    type: z13.enum(["research", "analysis", "creation", "review", "communication"]),
    estimatedTime: z13.number(),
    prerequisites: z13.array(z13.string()),
    deliverables: z13.array(z13.string()),
    status: z13.enum(["pending", "in-progress", "completed", "blocked"])
  })),
  status: z13.enum(["draft", "approved", "in-progress", "completed", "cancelled"]),
  createdAt: z13.date(),
  updatedAt: z13.date()
});
var rtfStructureSchema = z13.object({
  role: z13.string(),
  task: z13.object({
    type: z13.enum(["paper", "presentation", "project", "code", "analysis", "general"]),
    intent: z13.string(),
    description: z13.string(),
    scope: z13.enum(["single-action", "multi-step", "iterative", "collaborative"]),
    priority: z13.enum(["low", "medium", "high", "urgent"]),
    requirements: z13.array(z13.string()),
    constraints: z13.array(z13.string()),
    dependencies: z13.array(z13.string()),
    expectedOutcome: z13.string()
  }),
  format: z13.record(z13.any()),
  confidence: z13.number().min(0).max(1),
  metadata: z13.record(z13.any())
});
var executionResultSchema = z13.object({
  success: z13.boolean(),
  completedSteps: z13.array(z13.object({
    id: z13.string(),
    name: z13.string(),
    status: z13.string()
  })),
  errors: z13.array(z13.string())
});
var conversationRouter = router({
  // Parse natural language input into RTF structure
  parseRTF: protectedProcedure.use(rateLimit(50, 60 * 60 * 1e3)).input(parseRTFSchema).output(rtfStructureSchema).mutation(async ({ input }) => {
    try {
      const { RTFParser, createVertexAIClient } = await import("@maria/ai-agents");
      const vertexAI = createVertexAIClient();
      const rtfParser = new RTFParser(vertexAI);
      const rtfStructure = await rtfParser.parseRTF(input.input, input.context);
      return {
        role: rtfStructure.role,
        task: {
          type: rtfStructure.task.type,
          intent: rtfStructure.task.intent,
          description: rtfStructure.task.description,
          scope: rtfStructure.task.scope,
          priority: rtfStructure.task.priority,
          requirements: rtfStructure.task.requirements,
          constraints: rtfStructure.task.constraints,
          dependencies: rtfStructure.task.dependencies,
          expectedOutcome: rtfStructure.task.expectedOutcome
        },
        format: rtfStructure.format,
        confidence: rtfStructure.confidence,
        metadata: rtfStructure.metadata
      };
    } catch (error) {
      throw createErrorHandler("Parse RTF")(error);
    }
  }),
  // Create a task plan from natural language input
  createTaskPlan: protectedProcedure.use(rateLimit(20, 60 * 60 * 1e3)).input(createTaskPlanSchema).output(taskPlanSchema).mutation(async ({ input }) => {
    try {
      const { PlannerAgent, createVertexAIClient } = await import("@maria/ai-agents");
      const vertexAI = createVertexAIClient();
      const planner = new PlannerAgent(vertexAI);
      const taskPlan = await planner.createTaskPlan(input.input, input.context);
      return {
        id: taskPlan.id,
        title: taskPlan.title,
        description: String(taskPlan.description),
        rtfStructure: taskPlan.rtfStructure || {},
        sowDocument: taskPlan.sowDocument,
        executionPlan: taskPlan.executionPlan || [],
        status: taskPlan.status || "draft",
        createdAt: taskPlan.createdAt,
        updatedAt: taskPlan.updatedAt
      };
    } catch (error) {
      throw createErrorHandler("Create task plan")(error);
    }
  }),
  // Refine an existing task plan
  refineTaskPlan: protectedProcedure.use(rateLimit(50, 60 * 60 * 1e3)).input(refineTaskPlanSchema).output(taskPlanSchema).mutation(async ({ input }) => {
    try {
      const { PlannerAgent, createVertexAIClient } = await import("@maria/ai-agents");
      const vertexAI = createVertexAIClient();
      const planner = new PlannerAgent(vertexAI);
      const refinedPlan = await planner.refinePlan(
        input.planId,
        input.feedback,
        input.sessionId
      );
      return {
        id: refinedPlan.id,
        title: refinedPlan.title,
        description: refinedPlan.description,
        rtfStructure: refinedPlan.rtfStructure,
        sowDocument: refinedPlan.sowDocument,
        executionPlan: refinedPlan.executionPlan,
        status: refinedPlan.status,
        createdAt: refinedPlan.createdAt,
        updatedAt: refinedPlan.updatedAt
      };
    } catch (error) {
      throw createErrorHandler("Refine task plan")(error);
    }
  }),
  // Execute a task plan
  executeTaskPlan: protectedProcedure.use(rateLimit(10, 60 * 60 * 1e3)).input(executeTaskPlanSchema).output(executionResultSchema).mutation(async ({ input }) => {
    try {
      const { PlannerAgent, createVertexAIClient } = await import("@maria/ai-agents");
      const vertexAI = createVertexAIClient();
      const planner = new PlannerAgent(vertexAI);
      const result = await planner.executePlan(input.planId, input.options);
      return {
        success: result.success,
        completedSteps: result.completedSteps.map((step) => ({
          id: step.id,
          name: step.name,
          status: step.status
        })),
        errors: result.errors
      };
    } catch (error) {
      throw createErrorHandler("Execute task plan")(error);
    }
  }),
  // Get task plan status
  getTaskPlanStatus: protectedProcedure.input(z13.object({ planId: z13.string() })).output(z13.object({
    plan: taskPlanSchema.optional(),
    progress: z13.number().min(0).max(1),
    nextStep: z13.object({
      id: z13.string(),
      name: z13.string(),
      description: z13.string(),
      estimatedTime: z13.number()
    }).optional(),
    blockedSteps: z13.array(z13.object({
      id: z13.string(),
      name: z13.string(),
      status: z13.string()
    }))
  })).query(async ({ input }) => {
    try {
      const { PlannerAgent, createVertexAIClient } = await import("@maria/ai-agents");
      const vertexAI = createVertexAIClient();
      const planner = new PlannerAgent(vertexAI);
      const status = planner.getPlanStatus(input.planId);
      return {
        plan: status.plan ? {
          id: status.plan.id,
          title: status.plan.title,
          description: status.plan.description,
          rtfStructure: status.plan.rtfStructure,
          sowDocument: status.plan.sowDocument,
          executionPlan: status.plan.executionPlan,
          status: status.plan.status,
          createdAt: status.plan.createdAt,
          updatedAt: status.plan.updatedAt
        } : void 0,
        progress: status.progress,
        nextStep: status.nextStep ? {
          id: status.nextStep.id,
          name: status.nextStep.name,
          description: status.nextStep.description,
          estimatedTime: status.nextStep.estimatedTime
        } : void 0,
        blockedSteps: status.blockedSteps.map((step) => ({
          id: step.id,
          name: step.name,
          status: step.status
        }))
      };
    } catch (error) {
      throw createErrorHandler("Get task plan status")(error);
    }
  }),
  // Get all active task plans
  getActiveTaskPlans: protectedProcedure.output(z13.array(taskPlanSchema)).query(async () => {
    try {
      const { PlannerAgent, createVertexAIClient } = await import("@maria/ai-agents");
      const vertexAI = createVertexAIClient();
      const planner = new PlannerAgent(vertexAI);
      const activePlans = planner.getActivePlans();
      return activePlans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        description: plan.description,
        rtfStructure: plan.rtfStructure,
        sowDocument: plan.sowDocument,
        executionPlan: plan.executionPlan,
        status: plan.status,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt
      }));
    } catch (error) {
      throw createErrorHandler("Get active task plans")(error);
    }
  }),
  // Generate SOW document for a task plan
  generateSOW: protectedProcedure.use(rateLimit(10, 60 * 60 * 1e3)).input(generateSOWSchema).output(z13.record(z13.any())).mutation(async ({ input }) => {
    try {
      const { PlannerAgent, SOWGenerator, createVertexAIClient } = await import("@maria/ai-agents");
      const vertexAI = createVertexAIClient();
      const planner = new PlannerAgent(vertexAI);
      const sowGenerator = new SOWGenerator(vertexAI);
      const status = planner.getPlanStatus(input.planId);
      if (!status.plan) {
        throw new TRPCError11({
          code: "NOT_FOUND",
          message: "Task plan not found"
        });
      }
      const sowDocument = await sowGenerator.generateSOW(
        status.plan.rtfStructure,
        input.options || {}
      );
      return sowDocument;
    } catch (error) {
      throw createErrorHandler("Generate SOW")(error);
    }
  }),
  // Get conversation context
  getConversationContext: protectedProcedure.input(z13.object({ sessionId: z13.string() })).output(z13.object({
    context: z13.record(z13.any()).optional(),
    stats: z13.object({
      activeConversations: z13.number(),
      conversationsByType: z13.record(z13.number()),
      conversationsByPhase: z13.record(z13.number())
    })
  })).query(async ({ input }) => {
    try {
      const { PlannerAgent, createVertexAIClient } = await import("@maria/ai-agents");
      const vertexAI = createVertexAIClient();
      const planner = new PlannerAgent(vertexAI);
      const context = planner.getConversationContext(input.sessionId);
      const conversationManager = planner.conversationManager;
      const stats = conversationManager.getStats();
      return {
        context: context ? {
          type: context.type,
          id: context.id,
          metadata: context.metadata,
          history: context.history,
          state: context.state
        } : void 0,
        stats
      };
    } catch (error) {
      throw createErrorHandler("Get conversation context")(error);
    }
  }),
  // Analyze effort estimation
  analyzeEffort: protectedProcedure.input(z13.object({
    task: z13.string().min(1).max(1e3),
    complexity: z13.enum(["simple", "moderate", "complex", "very-complex"]),
    context: z13.object({
      type: z13.string(),
      requirements: z13.array(z13.string()),
      constraints: z13.array(z13.string())
    })
  })).output(z13.object({
    optimistic: z13.number(),
    mostLikely: z13.number(),
    pessimistic: z13.number(),
    expected: z13.number(),
    confidence: z13.enum(["high", "medium", "low"])
  })).mutation(async ({ input }) => {
    try {
      const { SOWGenerator, createVertexAIClient } = await import("@maria/ai-agents");
      const vertexAI = createVertexAIClient();
      const sowGenerator = new SOWGenerator(vertexAI);
      const effortEstimate = await sowGenerator.generateEffortEstimate(
        input.task,
        input.complexity,
        input.context
      );
      return {
        optimistic: effortEstimate.optimistic,
        mostLikely: effortEstimate.mostLikely,
        pessimistic: effortEstimate.pessimistic,
        expected: effortEstimate.expected,
        confidence: effortEstimate.confidence
      };
    } catch (error) {
      throw createErrorHandler("Analyze effort")(error);
    }
  })
});

// src/routers/storage.ts
import { z as z14 } from "zod";
import { TRPCError as TRPCError12 } from "@trpc/server";

// src/lib/storage.ts
import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";
import path from "path";
var storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || "maria-code"
});
var BUCKETS = {
  PAPERS: process.env.GOOGLE_CLOUD_STORAGE_BUCKET_PAPERS || "maria-papers-storage",
  SLIDES: process.env.GOOGLE_CLOUD_STORAGE_BUCKET_SLIDES || "maria-slides-storage",
  SHARED: process.env.GOOGLE_CLOUD_STORAGE_BUCKET_SHARED || "maria-shared-assets"
};
var ALLOWED_PAPER_TYPES = [
  "application/pdf",
  "text/plain",
  // .tex, .bib
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/eps",
  "text/csv",
  "application/json",
  "application/xml",
  "application/zip"
];
var ALLOWED_SLIDE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
];
var MAX_FILE_SIZE = 50 * 1024 * 1024;
var SIGNED_URL_EXPIRY = parseInt(process.env.CLOUD_STORAGE_SIGNED_URL_EXPIRY || "3600");
var CloudStorageService = class {
  /**
   * Upload a file to Google Cloud Storage
   */
  async uploadFile(options) {
    const { bucketName, userId, resourceId, fileName, fileType, fileSize, buffer } = options;
    const fileId = uuidv4();
    const extension = path.extname(fileName);
    const sanitizedFileName = path.basename(fileName, extension).replace(/[^a-zA-Z0-9.-]/g, "_");
    const gcsPath = `${userId}/${resourceId}/${fileId}/${sanitizedFileName}${extension}`;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(gcsPath);
    await file.save(buffer, {
      metadata: {
        contentType: fileType,
        cacheControl: "public, max-age=3600",
        metadata: {
          uploadedBy: userId,
          resourceId,
          originalFileName: fileName,
          uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      }
    });
    return {
      id: fileId,
      fileName,
      fileType,
      fileSize,
      gcsPath,
      uploadedBy: userId,
      uploadedAt: /* @__PURE__ */ new Date(),
      version: 1
    };
  }
  /**
   * Generate signed URL for file download
   */
  async getSignedUrl(bucketName, gcsPath) {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(gcsPath);
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + SIGNED_URL_EXPIRY * 1e3,
      version: "v4"
    });
    return signedUrl;
  }
  /**
   * Delete a file from storage
   */
  async deleteFile(bucketName, gcsPath) {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(gcsPath);
    await file.delete();
  }
  /**
   * Check if file exists
   */
  async fileExists(bucketName, gcsPath) {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(gcsPath);
    const [exists] = await file.exists();
    return exists;
  }
  /**
   * Get file metadata
   */
  async getFileMetadata(bucketName, gcsPath) {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(gcsPath);
    const [metadata] = await file.getMetadata();
    return metadata;
  }
  /**
   * List files in a directory
   */
  async listFiles(bucketName, prefix) {
    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles({
      prefix
    });
    return files.map((file) => ({
      name: file.name,
      size: parseInt(file.metadata.size?.toString() || "0"),
      contentType: file.metadata.contentType,
      timeCreated: file.metadata.timeCreated,
      updated: file.metadata.updated
    }));
  }
  /**
   * Validate file type for papers
   */
  validatePaperFile(fileType, fileName) {
    if (!ALLOWED_PAPER_TYPES.includes(fileType)) {
      return false;
    }
    if (fileType === "text/plain") {
      const ext = path.extname(fileName).toLowerCase();
      return [".tex", ".bib", ".txt"].includes(ext);
    }
    return true;
  }
  /**
   * Validate file type for slides
   */
  validateSlideFile(fileType) {
    return ALLOWED_SLIDE_TYPES.includes(fileType);
  }
  /**
   * Validate file size
   */
  validateFileSize(fileSize) {
    return fileSize > 0 && fileSize <= MAX_FILE_SIZE;
  }
};
var cloudStorage = new CloudStorageService();

// src/routers/storage.ts
var uploadFileSchema = z14.object({
  resourceId: z14.string(),
  // paperId or presentationId
  resourceType: z14.enum(["paper", "slide"]),
  fileName: z14.string().min(1),
  fileData: z14.string(),
  // base64 encoded file
  description: z14.string().optional()
});
var getFileSchema = z14.object({
  fileId: z14.string(),
  resourceId: z14.string(),
  resourceType: z14.enum(["paper", "slide"])
});
var deleteFileSchema = z14.object({
  fileId: z14.string(),
  resourceId: z14.string(),
  resourceType: z14.enum(["paper", "slide"])
});
var listFilesSchema = z14.object({
  resourceId: z14.string(),
  resourceType: z14.enum(["paper", "slide"])
});
var fileSchema = z14.object({
  id: z14.string(),
  fileName: z14.string(),
  fileType: z14.string(),
  fileSize: z14.number(),
  description: z14.string().optional(),
  downloadUrl: z14.string().optional(),
  uploadedBy: z14.string(),
  uploadedAt: z14.date(),
  version: z14.number()
});
var storageRouter = router({
  // Upload a file
  uploadFile: protectedProcedure.input(uploadFileSchema).output(fileSchema).mutation(async ({ ctx, input }) => {
    try {
      const buffer = Buffer.from(input.fileData, "base64");
      if (!cloudStorage.validateFileSize(buffer.length)) {
        throw new TRPCError12({
          code: "BAD_REQUEST",
          message: "File size exceeds maximum limit (50MB)"
        });
      }
      const { fileTypeFromBuffer } = await import("file-type");
      const fileTypeResult = await fileTypeFromBuffer(buffer);
      const fileType = fileTypeResult?.mime || "application/octet-stream";
      const isValidType = input.resourceType === "paper" ? cloudStorage.validatePaperFile(fileType, input.fileName) : cloudStorage.validateSlideFile(fileType);
      if (!isValidType) {
        throw new TRPCError12({
          code: "BAD_REQUEST",
          message: `File type ${fileType} is not allowed for ${input.resourceType}s`
        });
      }
      const collection = input.resourceType === "paper" ? "papers" : "presentations";
      const resourceDoc = await ctx.firestore.collection(collection).doc(input.resourceId).get();
      if (!resourceDoc.exists) {
        throw new TRPCError12({
          code: "NOT_FOUND",
          message: `${input.resourceType} not found`
        });
      }
      const resourceData = resourceDoc.data();
      if (resourceData.createdBy !== ctx.user.uid && !resourceData.collaborators?.includes(ctx.user.uid)) {
        throw new TRPCError12({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const bucketName = input.resourceType === "paper" ? BUCKETS.PAPERS : BUCKETS.SLIDES;
      const storageFile = await cloudStorage.uploadFile({
        bucketName,
        userId: ctx.user.uid,
        resourceId: input.resourceId,
        fileName: input.fileName,
        fileType,
        fileSize: buffer.length,
        buffer
      });
      const fileData = {
        fileName: storageFile.fileName,
        fileType: storageFile.fileType,
        fileSize: storageFile.fileSize,
        gcsPath: storageFile.gcsPath,
        description: input.description,
        uploadedBy: ctx.user.uid,
        uploadedAt: storageFile.uploadedAt,
        version: storageFile.version
      };
      const fileRef = await ctx.firestore.collection(collection).doc(input.resourceId).collection("files").add(fileData);
      return {
        id: fileRef.id,
        ...fileData
      };
    } catch (error) {
      throw createErrorHandler("Upload file")(error);
    }
  }),
  // Get a file with download URL
  getFile: protectedProcedure.input(getFileSchema).output(fileSchema).query(async ({ ctx, input }) => {
    try {
      const collection = input.resourceType === "paper" ? "papers" : "presentations";
      const resourceDoc = await ctx.firestore.collection(collection).doc(input.resourceId).get();
      if (!resourceDoc.exists) {
        throw new TRPCError12({
          code: "NOT_FOUND",
          message: `${input.resourceType} not found`
        });
      }
      const resourceData = resourceDoc.data();
      if (resourceData.createdBy !== ctx.user.uid && !resourceData.collaborators?.includes(ctx.user.uid)) {
        throw new TRPCError12({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const fileDoc = await ctx.firestore.collection(collection).doc(input.resourceId).collection("files").doc(input.fileId).get();
      if (!fileDoc.exists) {
        throw new TRPCError12({
          code: "NOT_FOUND",
          message: "File not found"
        });
      }
      const fileData = fileDoc.data();
      const bucketName = input.resourceType === "paper" ? BUCKETS.PAPERS : BUCKETS.SLIDES;
      const downloadUrl = await cloudStorage.getSignedUrl(bucketName, fileData.gcsPath);
      return {
        id: fileDoc.id,
        fileName: fileData.fileName,
        fileType: fileData.fileType,
        fileSize: fileData.fileSize,
        description: fileData.description,
        downloadUrl,
        uploadedBy: fileData.uploadedBy,
        uploadedAt: fileData.uploadedAt.toDate(),
        version: fileData.version
      };
    } catch (error) {
      throw createErrorHandler("Get file")(error);
    }
  }),
  // List all files for a resource
  listFiles: protectedProcedure.input(listFilesSchema).output(z14.array(fileSchema)).query(async ({ ctx, input }) => {
    try {
      const collection = input.resourceType === "paper" ? "papers" : "presentations";
      const resourceDoc = await ctx.firestore.collection(collection).doc(input.resourceId).get();
      if (!resourceDoc.exists) {
        throw new TRPCError12({
          code: "NOT_FOUND",
          message: `${input.resourceType} not found`
        });
      }
      const resourceData = resourceDoc.data();
      if (resourceData.createdBy !== ctx.user.uid && !resourceData.collaborators?.includes(ctx.user.uid)) {
        throw new TRPCError12({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const filesSnapshot = await ctx.firestore.collection(collection).doc(input.resourceId).collection("files").orderBy("uploadedAt", "desc").get();
      return filesSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          description: data.description,
          uploadedBy: data.uploadedBy,
          uploadedAt: data.uploadedAt.toDate(),
          version: data.version
        };
      });
    } catch (error) {
      throw createErrorHandler("List files")(error);
    }
  }),
  // Delete a file
  deleteFile: protectedProcedure.input(deleteFileSchema).mutation(async ({ ctx, input }) => {
    try {
      const collection = input.resourceType === "paper" ? "papers" : "presentations";
      const resourceDoc = await ctx.firestore.collection(collection).doc(input.resourceId).get();
      if (!resourceDoc.exists) {
        throw new TRPCError12({
          code: "NOT_FOUND",
          message: `${input.resourceType} not found`
        });
      }
      const resourceData = resourceDoc.data();
      if (resourceData.createdBy !== ctx.user.uid && !resourceData.collaborators?.includes(ctx.user.uid)) {
        throw new TRPCError12({
          code: "FORBIDDEN",
          message: "Access denied"
        });
      }
      const fileRef = ctx.firestore.collection(collection).doc(input.resourceId).collection("files").doc(input.fileId);
      const fileDoc = await fileRef.get();
      if (!fileDoc.exists) {
        throw new TRPCError12({
          code: "NOT_FOUND",
          message: "File not found"
        });
      }
      const fileData = fileDoc.data();
      if (resourceData.createdBy !== ctx.user.uid && fileData.uploadedBy !== ctx.user.uid) {
        throw new TRPCError12({
          code: "FORBIDDEN",
          message: "Only the creator or file uploader can delete this file"
        });
      }
      const bucketName = input.resourceType === "paper" ? BUCKETS.PAPERS : BUCKETS.SLIDES;
      await cloudStorage.deleteFile(bucketName, fileData.gcsPath);
      await fileRef.delete();
      return { success: true };
    } catch (error) {
      throw createErrorHandler("Delete file")(error);
    }
  })
});

// src/routers/agents.ts
import { z as z15 } from "zod";
import { TRPCError as TRPCError13 } from "@trpc/server";
var academicRouter = router({
  execute: protectedProcedure.input(z15.object({
    action: z15.enum(["outline", "write", "references", "review"]),
    topic: z15.string().optional(),
    section: z15.string().optional(),
    file: z15.string().optional()
  })).mutation(async ({ input }) => {
    try {
      let result = "";
      switch (input.action) {
        case "outline":
          result = `Generated outline for topic: ${input.topic}

1. Introduction
2. Literature Review
3. Methodology
4. Results
5. Discussion
6. Conclusion`;
          break;
        case "write":
          result = `Writing section: ${input.section}

This section has been generated based on your requirements.`;
          break;
        case "references":
          result = `Managing references for file: ${input.file}

Found 15 references to format.`;
          break;
        case "review":
          result = `Reviewing paper: ${input.file}

Identified 3 areas for improvement.`;
          break;
      }
      return { result };
    } catch {
      throw new TRPCError13({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to execute academic agent"
      });
    }
  })
});
var presentationRouter = router({
  execute: protectedProcedure.input(z15.object({
    action: z15.enum(["structure", "content", "visuals", "sync"]),
    topic: z15.string().optional(),
    file: z15.string().optional(),
    slidesId: z15.string().optional()
  })).mutation(async ({ input }) => {
    try {
      let result = "";
      switch (input.action) {
        case "structure":
          result = `Generated slide structure for: ${input.topic}

1. Title Slide
2. Agenda
3. Problem Statement
4. Solution
5. Demo
6. Conclusion`;
          break;
        case "content":
          result = `Creating content for slides: ${input.file}

Generated content for 10 slides.`;
          break;
        case "visuals":
          result = `Optimizing visuals for: ${input.file}

Enhanced 5 slides with better graphics.`;
          break;
        case "sync":
          result = `Syncing with Google Slides ID: ${input.slidesId}

Successfully synced.`;
          break;
      }
      return { result };
    } catch {
      throw new TRPCError13({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to execute presentation agent"
      });
    }
  })
});
var developmentRouter = router({
  execute: protectedProcedure.input(z15.object({
    action: z15.enum(["architecture", "generate", "test", "deploy"]),
    project: z15.string().optional(),
    component: z15.string().optional(),
    type: z15.string().optional(),
    environment: z15.string().optional()
  })).mutation(async ({ input }) => {
    try {
      let result = "";
      switch (input.action) {
        case "architecture":
          result = `Designing architecture for: ${input.project}

- Frontend: Next.js
- Backend: tRPC
- Database: PostgreSQL
- Infrastructure: GCP`;
          break;
        case "generate":
          result = `Generating code for component: ${input.component}

Created 3 files with 150 lines of code.`;
          break;
        case "test":
          result = `Generating ${input.type} tests

Created 10 test cases with 95% coverage.`;
          break;
        case "deploy":
          result = `Deploying to ${input.environment} environment

Deployment successful. URL: https://app-${input.environment}.example.com`;
          break;
      }
      return { result };
    } catch {
      throw new TRPCError13({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to execute development agent"
      });
    }
  })
});
var agentsRouter = router({
  academic: academicRouter,
  presentation: presentationRouter,
  development: developmentRouter
});

// src/routers/index.ts
var appRouter = router({
  auth: authRouter,
  mariaAuth: mariaAuthRouter,
  sandbox: sandboxRouter,
  aiExecution: aiExecutionRouter,
  papers: papersRouter,
  slides: slidesRouter,
  projects: projectsRouter,
  chat: chatRouter,
  graph: graphRouter,
  conversation: conversationRouter,
  storage: storageRouter,
  agents: agentsRouter
});

// src/lib/firebase.ts
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth as getAuth2 } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
function initializeFirebase() {
  if (getApps().length > 0) {
    return;
  }
  try {
    if (process.env.FIREBASE_ADMIN_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.MARIA_PROJECT_ID || "maria-code"
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({
        projectId: process.env.MARIA_PROJECT_ID || "maria-code"
      });
    } else {
      initializeApp({
        projectId: process.env.MARIA_PROJECT_ID || "maria-code"
      });
    }
    getAuth2();
    getFirestore();
  } catch (error) {
    throw error;
  }
}

// src/websocket.ts
import { WebSocketServer, WebSocket } from "ws";

// src/lib/auth.ts
import admin from "firebase-admin";
async function verifyIdToken(token) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("Error verifying ID token:", error);
    return null;
  }
}

// src/websocket.ts
import { Logging } from "@google-cloud/logging";
var logging = new Logging();
var log = logging.log("maria-websocket");
var WebSocketManager = class {
  wss;
  clients = /* @__PURE__ */ new Map();
  sessionClients = /* @__PURE__ */ new Map();
  constructor(server2) {
    this.wss = new WebSocketServer({
      server: server2,
      path: "/ws",
      verifyClient: async (info, cb) => {
        try {
          const url = new URL(info.req.url || "", `http://${info.req.headers.host}`);
          const token = url.searchParams.get("token");
          if (!token) {
            cb(false, 401, "Unauthorized");
            return;
          }
          const decodedToken = await verifyIdToken(token);
          if (!decodedToken) {
            cb(false, 401, "Invalid token");
            return;
          }
          info.req.userId = decodedToken.uid;
          cb(true);
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("WebSocket authentication error:", error);
          } else {
            log.error(log.entry({ severity: "ERROR" }, { message: "WebSocket authentication error", error }));
          }
          cb(false, 401, "Authentication failed");
        }
      }
    });
    this.setupWebSocketServer();
    this.startHeartbeat();
  }
  setupWebSocketServer() {
    this.wss.on("connection", (ws, request) => {
      const userId = request.userId;
      ws.userId = userId;
      ws.isAlive = true;
      if (!this.clients.has(userId)) {
        this.clients.set(userId, /* @__PURE__ */ new Set());
      }
      this.clients.get(userId).add(ws);
      if (process.env.NODE_ENV === "development") {
        console.log(`WebSocket client connected: ${userId}`);
      }
      ws.on("message", async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch {
          this.sendError(ws, "Invalid message format");
        }
      });
      ws.on("pong", () => {
        ws.isAlive = true;
      });
      ws.on("close", () => {
        this.removeClient(ws);
      });
      ws.on("error", (error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("WebSocket error:", error);
        } else {
          log.error(log.entry({ severity: "ERROR" }, { message: "WebSocket error", error }));
        }
        this.removeClient(ws);
      });
      this.sendMessage(ws, {
        type: "system",
        payload: { message: "Connected to MARIA WebSocket server" }
      });
    });
  }
  async handleMessage(ws, message) {
    const { type, payload, sessionId } = message;
    if (sessionId && !ws.sessionId) {
      ws.sessionId = sessionId;
      if (!this.sessionClients.has(sessionId)) {
        this.sessionClients.set(sessionId, /* @__PURE__ */ new Set());
      }
      this.sessionClients.get(sessionId).add(ws);
    }
    try {
      switch (type) {
        case "chat_message":
          await this.handleChatMessage(ws, payload);
          break;
        case "rtf_analysis":
          await this.handleRTFAnalysis(ws, payload);
          break;
        case "sow_update":
          await this.handleSOWUpdate(ws, payload);
          break;
        case "task_status":
          await this.handleTaskStatus(ws, payload);
          break;
        default:
          this.sendError(ws, `Unknown message type: ${type}`);
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Message handling error:", error);
      } else {
        log.error(log.entry({ severity: "ERROR" }, { message: "Message handling error", error }));
      }
      this.sendError(ws, "Failed to process message");
    }
  }
  async handleChatMessage(ws, chatMessage) {
    const response = {
      content: `AI response placeholder for: ${chatMessage.content}`,
      rtfAnalysis: null,
      planId: null,
      sowDocument: null,
      executionPlan: null
    };
    const responseMessage = {
      id: crypto.randomUUID(),
      content: response.content,
      role: "assistant",
      timestamp: /* @__PURE__ */ new Date(),
      metadata: {
        rtfConfidence: void 0,
        taskType: void 0,
        intent: void 0,
        complexity: void 0,
        planId: response.planId,
        hasSOW: !!response.sowDocument,
        executionSteps: void 0,
        responseLength: response.content.length
      }
    };
    this.broadcastToSession(ws.sessionId, {
      type: "chat_message",
      payload: responseMessage
    });
    if (response.rtfAnalysis) {
      this.sendMessage(ws, {
        type: "rtf_analysis",
        payload: response.rtfAnalysis
      });
    }
    if (response.sowDocument) {
      this.sendMessage(ws, {
        type: "sow_update",
        payload: response.sowDocument
      });
    }
  }
  async handleRTFAnalysis(ws, payload) {
    const { RTFParser, createVertexAIClient } = await import("@maria/ai-agents");
    const vertexAI = createVertexAIClient();
    const rtfParser = new RTFParser(vertexAI);
    const fileContent = "Sample RTF content";
    const analysis = await rtfParser.parseRTF(fileContent);
    const result = {
      id: payload.fileId,
      fileName: "document.rtf",
      // Extract from URL
      status: "completed",
      extractedContent: {
        title: analysis.task.intent,
        sections: [],
        // TODO: Extract sections
        metadata: analysis.metadata
      }
    };
    this.sendMessage(ws, {
      type: "rtf_analysis",
      payload: result
    });
  }
  async handleSOWUpdate(ws, payload) {
    if (payload.action === "generate") {
      const { SOWGenerator, createVertexAIClient } = await import("@maria/ai-agents");
      const vertexAI = createVertexAIClient();
      const sowGenerator = new SOWGenerator(vertexAI);
      const sowDocument = await sowGenerator.generateSOW(
        { requirements: payload.requirements },
        payload.metadata || {}
      );
      const result = {
        id: crypto.randomUUID(),
        status: "review_required",
        content: JSON.stringify(sowDocument),
        sections: sowDocument.sections?.map((section) => ({
          title: section.title,
          content: section.content,
          status: "draft"
        }))
      };
      this.sendMessage(ws, {
        type: "sow_update",
        payload: result
      });
    } else if (payload.action === "approve" || payload.action === "reject") {
      this.broadcastToSession(ws.sessionId, {
        type: "sow_update",
        payload: {
          id: payload.sowId,
          status: payload.action === "approve" ? "approved" : "rejected",
          comments: payload.comments
        }
      });
    }
  }
  async handleTaskStatus(ws, payload) {
    if (payload.action === "pause" || payload.action === "resume" || payload.action === "restart") {
      this.broadcastToSession(ws.sessionId, {
        type: "task_status",
        payload: {
          taskPlanId: payload.taskPlanId,
          action: payload.action,
          timestamp: /* @__PURE__ */ new Date()
        }
      });
    } else if (payload.taskId) {
      const progress = {
        taskId: payload.taskId,
        taskName: "Sample Task",
        // TODO: Fetch from task plan
        status: "in_progress",
        progress: 45,
        message: "Processing data..."
      };
      this.sendMessage(ws, {
        type: "progress_update",
        payload: progress
      });
    }
  }
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        ...message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }));
    }
  }
  sendError(ws, error) {
    this.sendMessage(ws, {
      type: "error",
      payload: { error }
    });
  }
  // Currently unused - for future implementation
  // private broadcastToUser(userId: string, message: Omit<WebSocketMessage, 'timestamp'>) {
  //   const userClients = this.clients.get(userId);
  //   if (userClients) {
  //     userClients.forEach(client => {
  //       this.sendMessage(client, message);
  //     });
  //   }
  // }
  broadcastToSession(sessionId, message) {
    const sessionClients = this.sessionClients.get(sessionId);
    if (sessionClients) {
      sessionClients.forEach((client) => {
        this.sendMessage(client, message);
      });
    }
  }
  removeClient(ws) {
    if (ws.userId) {
      const userClients = this.clients.get(ws.userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          this.clients.delete(ws.userId);
        }
      }
    }
    if (ws.sessionId) {
      const sessionClients = this.sessionClients.get(ws.sessionId);
      if (sessionClients) {
        sessionClients.delete(ws);
        if (sessionClients.size === 0) {
          this.sessionClients.delete(ws.sessionId);
        }
      }
    }
    if (process.env.NODE_ENV === "development") {
      console.log(`WebSocket client disconnected: ${ws.userId}`);
    }
  }
  startHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 3e4);
  }
  // Public methods for external use
  sendProgressUpdate(sessionId, progress) {
    this.broadcastToSession(sessionId, {
      type: "progress_update",
      payload: progress
    });
  }
  sendTaskComplete(sessionId, taskId, results) {
    this.broadcastToSession(sessionId, {
      type: "task_status",
      payload: {
        taskId,
        status: "completed",
        results
      }
    });
  }
};

// src/index.ts
import dotenv from "dotenv";
dotenv.config();
initializeFirebase();
var app = express();
var port = process.env.PORT || 3001;
var logging2 = new Logging2();
var log2 = logging2.log("maria-core-api");
app.use(cors({
  origin: [
    "http://localhost:3000",
    // Next.js dev server
    "https://studio.maria-code.dev",
    // Production frontend
    "https://maria-studio-*.vercel.app"
    // Vercel preview deployments
  ],
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development"
  });
});
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error }) => {
      if (process.env.NODE_ENV === "development") {
        console.error("tRPC Error:", error);
      } else {
        log2.error(log2.entry({ severity: "ERROR" }, { message: "tRPC Error", error: error.message }));
      }
    }
  })
);
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      "GET /health",
      "POST /trpc/[procedure]",
      "WS /ws (WebSocket endpoint)"
    ]
  });
});
app.use((err, req, res) => {
  const errorMessage = { message: "Express Error", error: err, url: req.url };
  if (process.env.NODE_ENV === "development") {
    console.error("Express Error:", err);
  } else {
    log2.error(log2.entry({ severity: "ERROR" }, errorMessage));
  }
  const error = err;
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? error.message : "Something went wrong",
    ...process.env.NODE_ENV === "development" && { stack: error.stack }
  });
});
var httpServer = createServer(app);
var wsManager = new WebSocketManager(httpServer);
var server = httpServer.listen(port, () => {
  if (process.env.NODE_ENV === "development") {
    console.log(`\u{1F680} tRPC server listening on port ${port}`);
    console.log(`\u{1F50C} WebSocket server listening on ws://localhost:${port}/ws`);
  } else {
    log2.info(log2.entry({ severity: "INFO" }, { message: `tRPC server listening on port ${port}` }));
  }
});
server.on("error", (err) => {
  const error = err;
  const errorMessage = { message: "Server error", error: err };
  if (process.env.NODE_ENV === "development") {
    console.error("Server error:", err);
  } else {
    log2.error(log2.entry({ severity: "ERROR" }, errorMessage));
  }
  if (error.code === "EADDRINUSE") {
    const portMessage = { message: `Port ${port} is already in use` };
    if (process.env.NODE_ENV === "development") {
      console.error(`Port ${port} is already in use`);
    } else {
      log2.error(log2.entry({ severity: "ERROR" }, portMessage));
    }
    process.exit(1);
  } else {
    const unexpectedMessage = { message: "Unexpected server error" };
    if (process.env.NODE_ENV === "development") {
      console.error("Unexpected server error");
    } else {
      log2.error(log2.entry({ severity: "ERROR" }, unexpectedMessage));
    }
    process.exit(1);
  }
});
process.on("SIGTERM", () => {
  if (process.env.NODE_ENV === "development") {
    console.log("Received SIGTERM, shutting down gracefully...");
  } else {
    log2.info(log2.entry({ severity: "INFO" }, { message: "Received SIGTERM, shutting down gracefully" }));
  }
  server.close(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("Server closed");
    } else {
      log2.info(log2.entry({ severity: "INFO" }, { message: "Server closed" }));
    }
    process.exit(0);
  });
});
process.on("SIGINT", () => {
  if (process.env.NODE_ENV === "development") {
    console.log("Received SIGINT, shutting down gracefully...");
  } else {
    log2.info(log2.entry({ severity: "INFO" }, { message: "Received SIGINT, shutting down gracefully" }));
  }
  server.close(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("Server closed");
    } else {
      log2.info(log2.entry({ severity: "INFO" }, { message: "Server closed" }));
    }
    process.exit(0);
  });
});
process.on("uncaughtException", (err) => {
  if (process.env.NODE_ENV === "development") {
    console.error("Uncaught Exception:", err);
  } else {
    log2.error(log2.entry({ severity: "CRITICAL" }, { message: "Uncaught Exception", error: err.message, stack: err.stack }));
  }
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  if (process.env.NODE_ENV === "development") {
    console.error("Unhandled Rejection:", reason);
  } else {
    log2.error(log2.entry({ severity: "CRITICAL" }, { message: "Unhandled Rejection", reason }));
  }
  process.exit(1);
});
var index_default = app;
export {
  index_default as default,
  wsManager
};
//# sourceMappingURL=index.js.map