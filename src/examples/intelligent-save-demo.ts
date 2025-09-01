/**
 * Intelligent Document Save Demo
 * Demonstrates autonomous file naming and organization
 */

import { intelligentSave, autoSaveIntelligently } from '../services/intelligent-document-save.js';

// Test scenarios
const testScenarios = [
  {
    name: 'React Component',
    hint: 'ユーザープロフィールコンポーネントを作って',
    content: `import React from 'react';

export const UserProfile: React.FC<{ userId: string }> = ({ userId }) => {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
  
  return (
    <div className="user-profile">
      <h2>{user?.name}</h2>
      <p>{user?.email}</p>
    </div>
  );
};

export default UserProfile;`
  },
  {
    name: 'Python API Service',
    hint: 'create authentication service for user login',
    content: `from flask import Flask, request, jsonify
from werkzeug.security import check_password_hash
import jwt

class AuthService:
    def __init__(self, app: Flask, secret_key: str):
        self.app = app
        self.secret_key = secret_key
    
    def login(self, email: str, password: str):
        user = self.get_user_by_email(email)
        if user and check_password_hash(user.password, password):
            token = jwt.encode({'user_id': user.id}, self.secret_key)
            return {'token': token, 'user': user.to_dict()}
        return None
    
    def verify_token(self, token: str):
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=['HS256'])
            return payload['user_id']
        except jwt.InvalidTokenError:
            return None`
  },
  {
    name: 'TODO List',
    hint: 'プロジェクト立ち上げのTODOリスト',
    content: `# Project Setup TODO List

## 高優先度 🔥
- [ ] 開発環境のセットアップ
- [ ] Gitリポジトリの作成
- [ ] CI/CDパイプラインの構築
- [ ] 基本的なプロジェクト構造の作成

## 中優先度 📋
- [ ] データベース設計
- [ ] API仕様書の作成
- [ ] 認証システムの実装
- [ ] ユニットテストの作成

## 低優先度 📝
- [ ] ドキュメントの整備
- [ ] パフォーマンス最適化
- [ ] セキュリティ監査

## 完了 ✅
- [x] 要件定義
- [x] 技術選定`
  },
  {
    name: 'SQL Schema',
    hint: 'database schema for e-commerce platform',
    content: `-- E-commerce Database Schema

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    category_id INT REFERENCES categories(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_orders_user ON orders(user_id);`
  },
  {
    name: 'Dockerfile',
    hint: 'Node.js アプリケーションのDockerfile',
    content: `FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
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

EXPOSE 3000

CMD ["node", "dist/index.js"]`
  }
];

async function demonstrateIntelligentSave() {
  console.log('🤖 Intelligent Document Save Demo\n');
  console.log('Demonstrating autonomous file naming and organization...\n');

  for (const scenario of testScenarios) {
    console.log(`\n📝 Scenario: ${scenario.name}`);
    console.log(`💭 User intent: "${scenario.hint}"`);
    
    try {
      // Use intelligent save
      const result = await intelligentSave.save(scenario.content, {
        userIntent: scenario.hint,
        autoOrganize: true,
        trackRelationships: true,
        suggestAlternatives: true
      });

      console.log(`✅ Saved successfully!`);
      console.log(`📁 Path: ${result.path}`);
      console.log(`📄 Filename: ${result.filename}`);
      console.log(`📂 Directory: ${result.directory}`);
      console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`💡 Reasoning: ${result.reasoning}`);
      
      if (result.alternatives && result.alternatives.length > 0) {
        console.log(`🔄 Alternatives: ${result.alternatives.join(', ')}`);
      }
      
      if (result.relationships && result.relationships.length > 0) {
        console.log(`🔗 Related files: ${result.relationships.join(', ')}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n\n🎯 Key Features Demonstrated:');
  console.log('1. ✨ Automatic filename inference from user intent');
  console.log('2. 📂 Smart directory organization based on file type');
  console.log('3. 🔍 Content analysis for better naming');
  console.log('4. 🌐 Multi-language support (Japanese/English)');
  console.log('5. 🔗 File relationship tracking');
  console.log('6. 📊 Confidence scoring for decisions');
  console.log('7. 🔄 Alternative suggestions');
  console.log('\n💡 The system autonomously decides:');
  console.log('   • Appropriate filename based on content and intent');
  console.log('   • Correct file extension based on code analysis');
  console.log('   • Optimal directory placement in project structure');
  console.log('   • Relationships with other files (imports, references)');
}

// Test the simpler auto-save function
async function testAutoSave() {
  console.log('\n\n🚀 Testing simplified auto-save...\n');
  
  const testContent = `# Architecture Document

## System Overview
This document describes the microservices architecture for our platform.

## Services
- User Service: Authentication and user management
- Product Service: Product catalog and inventory
- Order Service: Order processing and fulfillment`;

  const savedPath = await autoSaveIntelligently(
    testContent,
    'system architecture documentation for microservices'
  );

  if (savedPath) {
    console.log(`✅ Document saved to: ${savedPath}`);
  } else {
    console.log('❌ Failed to save document');
  }
}

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateIntelligentSave()
    .then(() => testAutoSave())
    .then(() => {
      console.log('\n✨ Demo completed successfully!');
    })
    .catch(console.error);
}

export { demonstrateIntelligentSave, testAutoSave };