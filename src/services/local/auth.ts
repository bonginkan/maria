/**
 * LocalAuthService - JWT authentication replacing Firebase Auth
 */
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs-extra';
import * as path from 'path';

interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: Date;
  lastLogin?: Date;
}

interface Session {
  token: string;
  userId: string;
  expiresAt: Date;
}

interface AuthOptions {
  jwtSecret?: string;
  sessionTTL?: number;
  dataPath?: string;
}

export class LocalAuthService {
  private jwtSecret: string;
  private sessionTTL: number;
  private dataPath: string;
  private sessions: Map<string, Session> = new Map();

  constructor(options: AuthOptions = {}) {
    this.jwtSecret = options.jwtSecret || crypto.randomBytes(32).toString('hex');
    this.sessionTTL = options.sessionTTL || 86400000; // 24 hours
    this.dataPath = options.dataPath || path.join(process.env.HOME || '', '.maria', 'auth');
    
    // Ensure data directory exists
    fs.ensureDirSync(this.dataPath);
    fs.ensureDirSync(path.join(this.dataPath, 'users'));
    fs.ensureDirSync(path.join(this.dataPath, 'sessions'));
    
    // Load existing sessions
    this.loadSessions();
  }

  async register(email: string, password: string, role: 'admin' | 'editor' | 'viewer' = 'viewer'): Promise<User> {
    // Check if user exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password with PBKDF2
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');

    // Create user
    const user: User = {
      id: crypto.randomBytes(16).toString('hex'),
      email,
      passwordHash: `${salt}:${passwordHash}`,
      role,
      createdAt: new Date()
    };

    // Save user
    await this.saveUser(user);

    return user;
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // Get user
    const user = await this.getUserByEmail(email);
    if (\!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const [salt, hash] = user.passwordHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    
    if (hash \!== verifyHash) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await this.saveUser(user);

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role 
      },
      this.jwtSecret,
      { expiresIn: '24h' }
    );

    // Create session
    const session: Session = {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + this.sessionTTL)
    };
    
    this.sessions.set(token, session);
    await this.saveSession(session);

    return { user, token };
  }

  async logout(token: string): Promise<void> {
    const session = this.sessions.get(token);
    if (session) {
      this.sessions.delete(token);
      await this.deleteSession(token);
    }
  }

  async verifyToken(token: string): Promise<User | null> {
    try {
      // Check session
      const session = this.sessions.get(token);
      if (\!session || session.expiresAt < new Date()) {
        return null;
      }

      // Verify JWT
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Get user
      return this.getUserById(decoded.userId);
    } catch {
      return null;
    }
  }

  async hasPermission(token: string, requiredRole: 'admin' | 'editor' | 'viewer'): Promise<boolean> {
    const user = await this.verifyToken(token);
    if (\!user) {
      return false;
    }

    const roleHierarchy = { admin: 3, editor: 2, viewer: 1 };
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  }

  private async saveUser(user: User): Promise<void> {
    const userPath = path.join(this.dataPath, 'users', `${user.id}.json`);
    await fs.writeJson(userPath, user);
  }

  private async getUserById(id: string): Promise<User | null> {
    const userPath = path.join(this.dataPath, 'users', `${id}.json`);
    
    if (\!await fs.pathExists(userPath)) {
      return null;
    }

    return fs.readJson(userPath);
  }

  private async getUserByEmail(email: string): Promise<User | null> {
    const usersDir = path.join(this.dataPath, 'users');
    const files = await fs.readdir(usersDir);

    for (const file of files) {
      const user = await fs.readJson(path.join(usersDir, file)) as User;
      if (user.email === email) {
        return user;
      }
    }

    return null;
  }

  private async saveSession(session: Session): Promise<void> {
    const sessionPath = path.join(this.dataPath, 'sessions', `${session.token}.json`);
    await fs.writeJson(sessionPath, session);
  }

  private async deleteSession(token: string): Promise<void> {
    const sessionPath = path.join(this.dataPath, 'sessions', `${token}.json`);
    await fs.remove(sessionPath);
  }

  private async loadSessions(): Promise<void> {
    const sessionsDir = path.join(this.dataPath, 'sessions');
    
    if (\!await fs.pathExists(sessionsDir)) {
      return;
    }

    const files = await fs.readdir(sessionsDir);
    
    for (const file of files) {
      const session = await fs.readJson(path.join(sessionsDir, file)) as Session;
      
      // Only load non-expired sessions
      if (new Date(session.expiresAt) > new Date()) {
        this.sessions.set(session.token, session);
      } else {
        // Clean expired session
        await this.deleteSession(session.token);
      }
    }
  }
}
EOF < /dev/null