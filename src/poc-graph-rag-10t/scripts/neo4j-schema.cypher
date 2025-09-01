// Neo4j Unified Schema Definition for Graph RAG 10T POC
// Version 2.1 - Optimized for scale and consistency
// This file defines the canonical schema for the Knowledge Graph

// ============================================
// CLEAR EXISTING CONSTRAINTS (Development Only)
// ============================================
// Uncomment for clean slate in development
// MATCH (n) DETACH DELETE n;

// ============================================
// NODE LABELS AND PROPERTIES
// ============================================

// Document Node
// Primary key: id (string)
// Properties:
//   - title: string (document title)
//   - path: string (source path/URL)
//   - source: string (sharepoint|box|database)
//   - labels: string[] (tags/categories)
//   - created_at: datetime
//   - updated_at: datetime

// Paragraph Node (formerly Chunk)
// Primary key: chunk_id (string)
// Properties:
//   - content: string (text content, max 1000 chars)
//   - sequence: integer (order within document)
//   - token_count: integer
//   - mentioned_dates: string[] (extracted dates)
//   - mentioned_amounts: string[] (extracted amounts)
//   - created_at: datetime

// Topic Node
// Primary key: name (string)
// Properties:
//   - category: string (Technology|Business|HR|Finance|Security|Legal)
//   - pagerank: float (centrality score)
//   - degree: integer (connection count)

// Person Node
// Primary key: id (string)
// Properties:
//   - name: string
//   - title: string
//   - email: string

// Organization Node
// Primary key: id (string)
// Properties:
//   - name: string
//   - industry: string

// Department Node
// Primary key: name (string)
// Properties:
//   - description: string

// Project Node
// Primary key: id (string)
// Properties:
//   - name: string
//   - status: string (active|completed|planned)
//   - budget: float

// Source Node
// Primary key: name (string)
// Properties:
//   - type: string (sharepoint|box|database)
//   - url: string

// User Node (for ACL)
// Primary key: id (string)
// Properties:
//   - name: string

// Group Node (for ACL)
// Primary key: id (string)
// Properties:
//   - name: string

// ============================================
// CONSTRAINTS (Uniqueness + Existence)
// ============================================

// Document constraints
CREATE CONSTRAINT doc_id IF NOT EXISTS 
FOR (d:Document) REQUIRE d.id IS UNIQUE;

// Paragraph constraints (using chunk_id for compatibility)
CREATE CONSTRAINT para_chunk_id IF NOT EXISTS 
FOR (p:Paragraph) REQUIRE p.chunk_id IS UNIQUE;

// Topic constraints
CREATE CONSTRAINT topic_name IF NOT EXISTS 
FOR (t:Topic) REQUIRE t.name IS UNIQUE;

// Person constraints
CREATE CONSTRAINT person_id IF NOT EXISTS 
FOR (p:Person) REQUIRE p.id IS UNIQUE;

// Organization constraints
CREATE CONSTRAINT org_id IF NOT EXISTS 
FOR (o:Organization) REQUIRE o.id IS UNIQUE;

// Department constraints
CREATE CONSTRAINT dept_name IF NOT EXISTS 
FOR (d:Department) REQUIRE d.name IS UNIQUE;

// Project constraints
CREATE CONSTRAINT proj_id IF NOT EXISTS 
FOR (p:Project) REQUIRE p.id IS UNIQUE;

// Source constraints
CREATE CONSTRAINT source_name IF NOT EXISTS 
FOR (s:Source) REQUIRE s.name IS UNIQUE;

// User constraints
CREATE CONSTRAINT user_id IF NOT EXISTS 
FOR (u:User) REQUIRE u.id IS UNIQUE;

// Group constraints
CREATE CONSTRAINT group_id IF NOT EXISTS 
FOR (g:Group) REQUIRE g.id IS UNIQUE;

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

// Document indexes
CREATE INDEX doc_source IF NOT EXISTS 
FOR (d:Document) ON (d.source);

CREATE INDEX doc_created IF NOT EXISTS 
FOR (d:Document) ON (d.created_at);

// Paragraph indexes
CREATE INDEX para_sequence IF NOT EXISTS 
FOR (p:Paragraph) ON (p.sequence);

CREATE INDEX para_token_count IF NOT EXISTS 
FOR (p:Paragraph) ON (p.token_count);

// Topic indexes
CREATE INDEX topic_category IF NOT EXISTS 
FOR (t:Topic) ON (t.category);

CREATE INDEX topic_pagerank IF NOT EXISTS 
FOR (t:Topic) ON (t.pagerank);

// Person indexes
CREATE INDEX person_name IF NOT EXISTS 
FOR (p:Person) ON (p.name);

// Organization indexes
CREATE INDEX org_name IF NOT EXISTS 
FOR (o:Organization) ON (o.name);

// Project indexes
CREATE INDEX proj_status IF NOT EXISTS 
FOR (p:Project) ON (p.status);

// ============================================
// FULLTEXT INDEXES (Neo4j 5.x syntax)
// ============================================

// Fulltext index on Paragraph content
CREATE FULLTEXT INDEX paragraph_content_fts IF NOT EXISTS
FOR (p:Paragraph) ON EACH [p.content];

// Fulltext index on Document title
CREATE FULLTEXT INDEX document_title_fts IF NOT EXISTS
FOR (d:Document) ON EACH [d.title];

// Fulltext index on Topic name
CREATE FULLTEXT INDEX topic_name_fts IF NOT EXISTS
FOR (t:Topic) ON EACH [t.name];

// Fulltext index on Person name
CREATE FULLTEXT INDEX person_name_fts IF NOT EXISTS
FOR (p:Person) ON EACH [p.name];

// ============================================
// RELATIONSHIP TYPES
// ============================================

// Document Hierarchy
// (:Paragraph)-[:DERIVED_FROM]->(:Document)
// (:Paragraph)-[:FOLLOWS]->(:Paragraph)

// Entity Mentions
// (:Paragraph)-[:MENTIONS]->(:Topic)
// (:Paragraph)-[:MENTIONS]->(:Person)
// (:Paragraph)-[:MENTIONS]->(:Organization)
// (:Paragraph)-[:MENTIONS]->(:Project)

// Document Metadata
// (:Document)-[:FROM_SOURCE]->(:Source)
// (:Document)-[:COVERS]->(:Topic)

// Core-KG Relationships
// (:Person)-[:WORKS_IN]->(:Department)
// (:Department)-[:BELONGS_TO]->(:Organization)
// (:Person)-[:ASSIGNED_TO {role}]->(:Project)
// (:Person)-[:REPORTS_TO]->(:Person)
// (:Project)-[:RELATED_TO]->(:Topic)

// ACL Relationships (simplified for POC)
// (:User)-[:CAN_ACCESS]->(:Document)
// (:Group)-[:CAN_ACCESS]->(:Document)

// ============================================
// VALIDATION QUERIES
// ============================================

// Check schema compliance
CALL db.schema.visualization() YIELD nodes, relationships
RETURN nodes, relationships;

// Count nodes by label
CALL db.labels() YIELD label
RETURN label, 
       size([(n) WHERE label IN labels(n) | n]) as count
ORDER BY count DESC;

// Count relationships by type
CALL db.relationshipTypes() YIELD relationshipType
RETURN relationshipType,
       size([()-[r]->() WHERE type(r) = relationshipType | r]) as count
ORDER BY count DESC;

// ============================================
// SAMPLE DATA VERIFICATION
// ============================================

// Verify Document-Paragraph structure
MATCH (p:Paragraph)-[:DERIVED_FROM]->(d:Document)
RETURN d.id, count(p) as paragraph_count
ORDER BY paragraph_count DESC
LIMIT 10;

// Verify Topic connections
MATCH (t:Topic)<-[:MENTIONS]-(p:Paragraph)
RETURN t.name, t.category, count(p) as mention_count
ORDER BY mention_count DESC
LIMIT 10;

// Verify sequential relationships
MATCH path = (p1:Paragraph)-[:FOLLOWS*..3]->(p2:Paragraph)
WHERE p1.chunk_id STARTS WITH 'doc1'
RETURN path
LIMIT 5;