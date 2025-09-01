/**
 * Code File Auto-Save Demo
 * Demonstrates auto-saving various code file types
 */

import { autoSaveMultipleDocuments, classifyDocument } from '../services/document-auto-save.js';

// Test code files for different types
const testCodeFiles = {
  typescript: `// TypeScript Service Implementation
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

type UserResponse = {
  data: User;
  status: number;
};

export class UserService {
  async getUser(id: string): Promise<UserResponse> {
    const user: User = {
      id,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user'
    };
    
    return { data: user, status: 200 };
  }
}`,

  javascript: `// JavaScript REST API
const express = require('express');
const app = express();

app.use(express.json());

let users = [];

app.get('/api/users', (req, res) => {
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const user = { id: Date.now(), ...req.body };
  users.push(user);
  res.status(201).json(user);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});`,

  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>User Dashboard</title>
</head>
<body>
  <div class="container">
    <h1>Welcome to Dashboard</h1>
    <form id="userForm">
      <input type="text" id="name" placeholder="Name">
      <input type="email" id="email" placeholder="Email">
      <button type="submit">Submit</button>
    </form>
    <div id="userList"></div>
  </div>
</body>
</html>`,

  css: `.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

#userForm {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

#userForm input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

#userForm button {
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
}

@media (max-width: 768px) {
  #userForm {
    flex-direction: column;
  }
}`,

  sql: `-- User Management Database Schema
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE user_roles (
  user_id INT,
  role_id INT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

-- Sample queries
SELECT u.username, u.email, r.name as role
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'john@example.com';`,

  shellScript: `#!/bin/bash
# Deployment Script

echo "Starting deployment process..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Installing..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
fi

# Build the application
echo "Building application..."
npm run build

# Build Docker image
echo "Building Docker image..."
docker build -t myapp:latest .

# Stop existing container
echo "Stopping existing container..."
docker stop myapp || true
docker rm myapp || true

# Run new container
echo "Starting new container..."
docker run -d --name myapp -p 3000:3000 myapp:latest

echo "Deployment completed successfully!"`,

  yaml: `# Docker Compose Configuration
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/myapp
    depends_on:
      - db
      - redis
    volumes:
      - ./uploads:/app/uploads
    restart: unless-stopped

  db:
    image: postgres:14
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:`,

  json: `{
  "name": "my-application",
  "version": "1.0.0",
  "description": "A sample Node.js application",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest",
    "build": "webpack --mode production"
  },
  "dependencies": {
    "express": "^4.18.0",
    "mongoose": "^7.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "nodemon": "^3.0.0",
    "webpack": "^5.0.0",
    "webpack-cli": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}`,

  csv: `id,name,email,department,salary,hire_date
1,John Doe,john@example.com,Engineering,95000,2022-01-15
2,Jane Smith,jane@example.com,Marketing,75000,2021-06-20
3,Bob Johnson,bob@example.com,Sales,85000,2020-11-10
4,Alice Brown,alice@example.com,Engineering,105000,2019-03-25
5,Charlie Wilson,charlie@example.com,HR,65000,2023-02-01
6,Diana Lee,diana@example.com,Finance,90000,2021-09-15
7,Edward Chen,edward@example.com,Engineering,110000,2018-07-30
8,Fiona Taylor,fiona@example.com,Marketing,70000,2022-04-10`,

  dockerfile: `FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]`,

  envConfig: `# Application Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
DATABASE_POOL_SIZE=10

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=7d

# AWS Configuration
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-application-uploads

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=app-specific-password

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_CACHE=true
DEBUG_MODE=false`
};

async function demonstrateCodeAutoSave() {
  console.log('🚀 Code File Auto-Save Demo\n');
  
  for (const [fileType, content] of Object.entries(testCodeFiles)) {
    console.log(`\n💻 Testing ${fileType.toUpperCase()} file...`);
    
    // Test classification
    const detectedType = classifyDocument(content);
    console.log(`🔍 Detected type: ${detectedType || 'none'}`);
    
    // Test auto-save
    try {
      const savedPaths = await autoSaveMultipleDocuments(content, fileType);
      if (savedPaths.length > 0) {
        console.log('Saved:');
        for (const path of savedPaths) {
          const relativePath = path.replace(process.cwd() + '/', '');
          console.log(`./${relativePath}`);
        }
      } else {
        console.log(`❌ Not saved (not recognized as document)`);
      }
    } catch (error) {
      console.log(`❌ Error saving: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Demo completed!');
  console.log('\n💡 The auto-save system now supports:');
  console.log('   📄 Documentation: .md files (TODO, SOW, specs, etc.)');
  console.log('   💻 Code files: .ts, .js, .html, .css');
  console.log('   🗄️ Data files: .sql, .csv, .json');
  console.log('   ⚙️ Config files: .yml, .sh, Dockerfile, .env');
  console.log('   ✨ Automatic detection and appropriate extensions!');
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateCodeAutoSave().catch(console.error);
}

export { demonstrateCodeAutoSave };