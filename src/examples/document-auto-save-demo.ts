/**
 * Document Auto-Save Demo
 * Demonstrates the document auto-save functionality
 */

import { autoSaveDocument, autoSaveMultipleDocuments, classifyDocument, DocumentType } from '../services/document-auto-save.js';

// Test documents for different types
const testDocuments = {
  sow: `# Statement of Work - E-commerce Platform Development

## Project Overview
Development of a comprehensive e-commerce platform with modern technology stack.

## Scope of Work
1. **Frontend Development**
   - React.js with TypeScript
   - Responsive design
   - Mobile-first approach

2. **Backend Development**
   - Node.js with Express
   - PostgreSQL database
   - RESTful API design

## Deliverables
- [ ] User authentication system
- [ ] Product catalog
- [ ] Shopping cart functionality
- [ ] Payment integration
- [ ] Admin dashboard

## Timeline
- **Phase 1**: Foundation (4 weeks)
- **Phase 2**: Core features (6 weeks)
- **Phase 3**: Testing & deployment (2 weeks)

## Budget
Total estimated cost: $50,000

## Success Criteria
- Page load time < 2 seconds
- 99.9% uptime
- Mobile responsive design
- Security compliance`,

  todo: `# Development TODO List

## High Priority 🔥
- [ ] Fix authentication bug in login system
- [ ] Implement password reset functionality
- [ ] Add input validation to all forms

## Medium Priority 📋
- [ ] Optimize database queries for user dashboard
- [ ] Add unit tests for payment processing
- [ ] Update API documentation
- [ ] Review and merge pending pull requests

## Low Priority 📝
- [ ] Refactor legacy components
- [ ] Add dark mode theme
- [ ] Implement caching strategy
- [ ] Performance monitoring setup

## Completed ✅
- [x] Set up CI/CD pipeline
- [x] Database migration scripts
- [x] Initial project structure`,

  architecture: `# System Architecture - Social Media Platform

## Architecture Overview
Microservices-based architecture with event-driven communication.

## Core Components

### Frontend Layer
- **Web App**: React.js with Next.js
- **Mobile App**: React Native
- **Admin Panel**: Vue.js

### API Gateway
- Kong or Nginx for routing
- Rate limiting and authentication
- Load balancing

### Microservices
1. **User Service**
   - User registration and authentication
   - Profile management
   - JWT token handling

2. **Post Service**
   - Content creation and management
   - Media upload handling
   - Content moderation

3. **Notification Service**
   - Real-time notifications
   - Email and push notifications
   - WebSocket connections

### Data Layer
- **Primary Database**: PostgreSQL for transactional data
- **Cache**: Redis for session and frequently accessed data
- **Message Queue**: RabbitMQ for async processing
- **File Storage**: AWS S3 for media files

### Infrastructure
- **Containerization**: Docker and Kubernetes
- **Monitoring**: Prometheus and Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)`,

  requirements: `# User Requirements Specification - CRM System

## 1. Introduction
This document outlines the functional and non-functional requirements for a Customer Relationship Management (CRM) system.

## 2. Functional Requirements

### 2.1 User Management
- **REQ-001**: System shall allow user registration with email validation
- **REQ-002**: System shall support role-based access control (Admin, Manager, Sales Rep)
- **REQ-003**: Users shall be able to reset passwords via email

### 2.2 Customer Management
- **REQ-004**: Users shall be able to create, read, update, and delete customer records
- **REQ-005**: System shall track customer interaction history
- **REQ-006**: System shall support customer segmentation and tagging

### 2.3 Sales Pipeline
- **REQ-007**: System shall provide visual sales pipeline with drag-and-drop functionality
- **REQ-008**: Users shall be able to create and track sales opportunities
- **REQ-009**: System shall generate sales reports and analytics

## 3. Non-Functional Requirements

### 3.1 Performance
- **NFR-001**: System shall handle 1000 concurrent users
- **NFR-002**: Page load time shall be under 3 seconds
- **NFR-003**: Database queries shall execute within 100ms

### 3.2 Security
- **NFR-004**: All data shall be encrypted in transit and at rest
- **NFR-005**: System shall implement multi-factor authentication
- **NFR-006**: System shall maintain audit logs for all user actions

### 3.3 Usability
- **NFR-007**: System shall be responsive and mobile-friendly
- **NFR-008**: System shall support multiple languages
- **NFR-009**: System shall provide contextual help and documentation`,

  technicalSpec: `# Technical Specification - Payment Processing API

## 1. Overview
RESTful API for secure payment processing with support for multiple payment methods.

## 2. API Endpoints

### 2.1 Payment Processing
\`\`\`
POST /api/v1/payments
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "amount": 1000,
  "currency": "USD",
  "payment_method": "card",
  "card_details": {
    "number": "4111111111111111",
    "exp_month": 12,
    "exp_year": 2025,
    "cvc": "123"
  },
  "customer_id": "cust_12345",
  "description": "Order #12345"
}
\`\`\`

### 2.2 Payment Status
\`\`\`
GET /api/v1/payments/{payment_id}
Authorization: Bearer <jwt_token>

Response:
{
  "id": "pay_67890",
  "status": "succeeded",
  "amount": 1000,
  "currency": "USD",
  "created": "2025-08-30T12:00:00Z"
}
\`\`\`

## 3. Database Schema

### 3.1 Payments Table
\`\`\`sql
CREATE TABLE payments (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## 4. Security Considerations
- PCI DSS compliance required
- All card data encrypted with AES-256
- Rate limiting: 100 requests per minute per API key
- Input validation and sanitization on all endpoints
- Webhook signatures for event notifications`
};

async function demonstrateAutoSave() {
  console.log('🚀 Document Auto-Save Demo\n');
  
  for (const [docType, content] of Object.entries(testDocuments)) {
    console.log(`\n📄 Testing ${docType.toUpperCase()} document...`);
    
    // Test classification
    const detectedType = classifyDocument(content);
    console.log(`🔍 Detected type: ${detectedType || 'none'}`);
    
    // Test auto-save
    try {
      const savedPaths = await autoSaveMultipleDocuments(content, docType);
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
  console.log('\n💡 Tips for using auto-save in MARIA:');
  console.log('   • Ask for "TODO list for project setup"');
  console.log('   • Request "SOW for mobile app development"');
  console.log('   • Ask for "system architecture for microservices"');
  console.log('   • Request "requirements specification for CRM"');
  console.log('   • Documents will be automatically saved as .md files!');
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateAutoSave().catch(console.error);
}

export { demonstrateAutoSave };