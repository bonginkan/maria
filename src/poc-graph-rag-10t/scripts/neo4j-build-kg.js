#!/usr/bin/env node
/**
 * Neo4j Knowledge Graph Builder for Graph RAG 10T POC
 * Builds document subgraph and connects to Core-KG
 * Extracts entities and relationships from chunks
 */

import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';

const NEO4J_URI = process.env.POC_NEO4J_HTTP_URI || 'http://localhost:7474';
const NEO4J_USER = process.env.POC_NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.POC_NEO4J_PASSWORD || 'testpass';
const NEO4J_DATABASE = process.env.POC_NEO4J_DATABASE || 'neo4j';
const INPUT_FILE = process.env.POC_INPUT_FILE || 'scripts/sample-chunks.ndjson';
const BATCH_SIZE = parseInt(process.env.NEO4J_BATCH_SIZE || '50');

class Neo4jKnowledgeGraphBuilder {
  constructor(config = {}) {
    this.uri = config.uri || NEO4J_URI;
    this.user = config.user || NEO4J_USER;
    this.password = config.password || NEO4J_PASSWORD;
    this.database = config.database || NEO4J_DATABASE;
    this.batchSize = config.batchSize || BATCH_SIZE;
    
    this.stats = {
      documents: 0,
      chunks: 0,
      entities: 0,
      relationships: 0,
      errors: []
    };

    // Entity patterns for extraction
    this.patterns = {
      person: /(?:Mr\.|Ms\.|Dr\.|Prof\.)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
      organization: /(?:株式会社|会社|Inc\.|Corp\.|Ltd\.|LLC|Company)\s*([A-Za-z]+(?:\s+[A-Za-z]+)*)/g,
      project: /(?:プロジェクト|Project|計画|Plan)\s*([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*)/g,
      date: /(\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}日?)/g,
      money: /([\d,]+(?:\.\d+)?)\s*(?:円|ドル|USD|JPY|万円|億円)/g,
      percentage: /(\d+(?:\.\d+)?)\s*[%％]/g
    };
  }

  /**
   * Execute Cypher query
   */
  async executeCypher(query, parameters = {}) {
    const response = await fetch(`${this.uri}/db/${this.database}/tx/commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${this.user}:${this.password}`).toString('base64')
      },
      body: JSON.stringify({
        statements: [{
          statement: query,
          parameters: parameters
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cypher query failed: ${error}`);
    }

    const result = await response.json();
    
    if (result.errors && result.errors.length > 0) {
      throw new Error(`Cypher error: ${result.errors[0].message}`);
    }

    return result.results[0];
  }

  /**
   * Build Knowledge Graph from NDJSON file
   */
  async buildFromFile(filePath) {
    console.log(`📂 Reading chunks from: ${filePath}`);
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let batch = [];
    let lineNumber = 0;
    
    for await (const line of rl) {
      lineNumber++;
      
      if (!line.trim()) continue;
      
      try {
        const chunk = JSON.parse(line);
        
        if (!chunk.chunk_id || !chunk.content) {
          console.warn(`⚠️  Line ${lineNumber}: Missing required fields`);
          continue;
        }
        
        batch.push(chunk);
        
        if (batch.length >= this.batchSize) {
          await this.processBatch(batch);
          batch = [];
        }
        
      } catch (error) {
        console.error(`❌ Line ${lineNumber}: Invalid JSON`);
        this.stats.errors.push({ line: lineNumber, error: error.message });
      }
    }
    
    // Process remaining chunks
    if (batch.length > 0) {
      await this.processBatch(batch);
    }
  }

  /**
   * Process batch of chunks
   */
  async processBatch(chunks) {
    console.log(`📦 Processing batch of ${chunks.length} chunks...`);
    
    for (const chunk of chunks) {
      try {
        // Create document if not exists
        await this.createDocument(chunk);
        
        // Create chunk node
        await this.createChunk(chunk);
        
        // Extract and create entities
        const entities = await this.extractEntities(chunk);
        await this.createEntities(entities, chunk.chunk_id);
        
        // Create relationships
        await this.createRelationships(chunk, entities);
        
        this.stats.chunks++;
        
      } catch (error) {
        console.error(`  ❌ Failed to process chunk ${chunk.chunk_id}:`, error.message);
        this.stats.errors.push({ chunk: chunk.chunk_id, error: error.message });
      }
    }
    
    this.showProgress();
  }

  /**
   * Create or update document node
   */
  async createDocument(chunk) {
    const docId = chunk.doc_id;
    const title = chunk.title || 'Untitled';
    const path = chunk.path || '';
    const source = chunk.metadata?.source || 'unknown';
    
    try {
      await this.executeCypher(`
        MERGE (d:Document {id: $doc_id})
        SET d.title = $title,
            d.path = $path,
            d.source = $source,
            d.created_at = datetime(),
            d.labels = $labels
      `, {
        doc_id: docId,
        title: title,
        path: path,
        source: source,
        labels: chunk.labels || []
      });
      
      this.stats.documents++;
      
    } catch (error) {
      console.error(`Failed to create document ${docId}:`, error.message);
    }
  }

  /**
   * Create chunk node
   */
  async createChunk(chunk) {
    try {
      await this.executeCypher(`
        MERGE (c:Chunk {id: $chunk_id})
        SET c.sequence = $sequence,
            c.content = $content,
            c.token_count = $token_count,
            c.created_at = datetime()
        WITH c
        MATCH (d:Document {id: $doc_id})
        MERGE (c)-[:PART_OF]->(d)
      `, {
        chunk_id: chunk.chunk_id,
        doc_id: chunk.doc_id,
        sequence: chunk.sequence || 0,
        content: chunk.content.substring(0, 1000), // Store first 1000 chars
        token_count: chunk.metadata?.tokenCount || 0
      });
      
      // Create sequential relationships between chunks
      if (chunk.sequence > 0) {
        const prevChunkId = chunk.chunk_id.replace(`:${chunk.sequence}:`, `:${chunk.sequence - 1}:`);
        await this.executeCypher(`
          MATCH (c1:Chunk {id: $curr_id})
          MATCH (c2:Chunk {id: $prev_id})
          MERGE (c1)-[:FOLLOWS]->(c2)
        `, {
          curr_id: chunk.chunk_id,
          prev_id: prevChunkId
        });
      }
      
    } catch (error) {
      console.error(`Failed to create chunk ${chunk.chunk_id}:`, error.message);
    }
  }

  /**
   * Extract entities from chunk content
   */
  async extractEntities(chunk) {
    const content = chunk.content;
    const entities = {
      people: [],
      organizations: [],
      projects: [],
      topics: [],
      dates: [],
      amounts: []
    };
    
    // Extract people names
    const peopleMatches = content.matchAll(this.patterns.person);
    for (const match of peopleMatches) {
      const name = match[1]?.trim();
      if (name && name.split(' ').length >= 2) {
        entities.people.push(name);
      }
    }
    
    // Extract organizations
    const orgMatches = content.matchAll(this.patterns.organization);
    for (const match of orgMatches) {
      const org = match[1]?.trim();
      if (org) {
        entities.organizations.push(org);
      }
    }
    
    // Extract projects
    const projectMatches = content.matchAll(this.patterns.project);
    for (const match of projectMatches) {
      const project = match[1]?.trim();
      if (project) {
        entities.projects.push(project);
      }
    }
    
    // Extract topics from content (using keyword extraction)
    const topics = this.extractTopics(content);
    entities.topics = topics;
    
    // Extract dates
    const dateMatches = content.matchAll(this.patterns.date);
    for (const match of dateMatches) {
      entities.dates.push(match[1]);
    }
    
    // Extract monetary amounts
    const moneyMatches = content.matchAll(this.patterns.money);
    for (const match of moneyMatches) {
      entities.amounts.push(match[0]);
    }
    
    return entities;
  }

  /**
   * Extract topics using simple keyword extraction
   */
  extractTopics(content) {
    const keywords = [
      'AI', 'Machine Learning', 'Cloud', 'Security', 'データ',
      '売上', 'Budget', '予算', 'Compliance', 'GDPR',
      'Remote Work', 'リモートワーク', 'Project', 'Development'
    ];
    
    const found = [];
    const lowerContent = content.toLowerCase();
    
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        found.push(keyword);
      }
    }
    
    // Map to existing topics
    const topicMap = {
      'AI': 'Artificial Intelligence',
      'Machine Learning': 'Machine Learning',
      'Cloud': 'Cloud Computing',
      'Security': 'Data Security',
      'Budget': 'Budget Planning',
      '予算': 'Budget Planning',
      'Compliance': 'Compliance',
      'GDPR': 'Compliance',
      'Remote Work': 'Remote Work',
      'リモートワーク': 'Remote Work'
    };
    
    return found.map(k => topicMap[k] || k).filter((v, i, a) => a.indexOf(v) === i);
  }

  /**
   * Create entity nodes
   */
  async createEntities(entities, chunkId) {
    // Create or link to existing people
    for (const name of entities.people) {
      try {
        await this.executeCypher(`
          MERGE (p:Person {name: $name})
          WITH p
          MATCH (c:Chunk {id: $chunk_id})
          MERGE (c)-[:MENTIONS]->(p)
        `, { name, chunk_id: chunkId });
        
        this.stats.entities++;
      } catch (error) {
        // Ignore duplicate errors
      }
    }
    
    // Create or link to existing organizations
    for (const name of entities.organizations) {
      try {
        await this.executeCypher(`
          MERGE (o:Organization {name: $name})
          WITH o
          MATCH (c:Chunk {id: $chunk_id})
          MERGE (c)-[:MENTIONS]->(o)
        `, { name, chunk_id: chunkId });
        
        this.stats.entities++;
      } catch (error) {
        // Ignore duplicate errors
      }
    }
    
    // Create or link to existing projects
    for (const name of entities.projects) {
      try {
        await this.executeCypher(`
          MERGE (p:Project {name: $name})
          WITH p
          MATCH (c:Chunk {id: $chunk_id})
          MERGE (c)-[:MENTIONS]->(p)
        `, { name, chunk_id: chunkId });
        
        this.stats.entities++;
      } catch (error) {
        // Ignore duplicate errors
      }
    }
    
    // Link to existing topics
    for (const topicName of entities.topics) {
      try {
        await this.executeCypher(`
          MATCH (t:Topic {name: $topic_name})
          MATCH (c:Chunk {id: $chunk_id})
          MERGE (c)-[:RELATED_TO]->(t)
        `, { topic_name: topicName, chunk_id: chunkId });
        
        this.stats.relationships++;
      } catch (error) {
        // Topic might not exist, create it
        await this.executeCypher(`
          MERGE (t:Topic {name: $topic_name})
          WITH t
          MATCH (c:Chunk {id: $chunk_id})
          MERGE (c)-[:RELATED_TO]->(t)
        `, { topic_name: topicName, chunk_id: chunkId });
      }
    }
    
    // Store dates and amounts as properties
    if (entities.dates.length > 0 || entities.amounts.length > 0) {
      await this.executeCypher(`
        MATCH (c:Chunk {id: $chunk_id})
        SET c.mentioned_dates = $dates,
            c.mentioned_amounts = $amounts
      `, {
        chunk_id: chunkId,
        dates: entities.dates,
        amounts: entities.amounts
      });
    }
  }

  /**
   * Create relationships based on content analysis
   */
  async createRelationships(chunk, entities) {
    // Connect document to topics
    if (entities.topics.length > 0) {
      for (const topicName of entities.topics) {
        try {
          await this.executeCypher(`
            MATCH (d:Document {id: $doc_id})
            MATCH (t:Topic {name: $topic_name})
            MERGE (d)-[:COVERS]->(t)
          `, {
            doc_id: chunk.doc_id,
            topic_name: topicName
          });
          
          this.stats.relationships++;
        } catch (error) {
          // Ignore if relationship exists
        }
      }
    }
    
    // Create ACL relationships
    if (chunk.acl) {
      // User access
      for (const userId of chunk.acl.users || []) {
        try {
          await this.executeCypher(`
            MERGE (u:User {id: $user_id})
            WITH u
            MATCH (c:Chunk {id: $chunk_id})
            MERGE (u)-[:CAN_ACCESS]->(c)
          `, {
            user_id: userId,
            chunk_id: chunk.chunk_id
          });
          
          this.stats.relationships++;
        } catch (error) {
          // Ignore errors
        }
      }
      
      // Group access
      for (const groupId of chunk.acl.groups || []) {
        try {
          await this.executeCypher(`
            MERGE (g:Group {id: $group_id})
            WITH g
            MATCH (c:Chunk {id: $chunk_id})
            MERGE (g)-[:CAN_ACCESS]->(c)
          `, {
            group_id: groupId,
            chunk_id: chunk.chunk_id
          });
          
          this.stats.relationships++;
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    // Create source relationships
    const source = chunk.metadata?.source || chunk.path?.split(':')[0];
    if (source) {
      try {
        await this.executeCypher(`
          MERGE (s:Source {name: $source})
          WITH s
          MATCH (d:Document {id: $doc_id})
          MERGE (d)-[:FROM_SOURCE]->(s)
        `, {
          source: source,
          doc_id: chunk.doc_id
        });
        
        this.stats.relationships++;
      } catch (error) {
        // Ignore errors
      }
    }
  }

  /**
   * Create graph indices for better query performance
   */
  async createGraphIndices() {
    console.log('\n📇 Creating graph indices...');
    
    const indices = [
      'CREATE INDEX chunk_content_fulltext IF NOT EXISTS FOR (c:Chunk) ON (c.content)',
      'CREATE INDEX document_title_fulltext IF NOT EXISTS FOR (d:Document) ON (d.title)',
      'CREATE INDEX person_name_fulltext IF NOT EXISTS FOR (p:Person) ON (p.name)',
      'CREATE INDEX topic_name_fulltext IF NOT EXISTS FOR (t:Topic) ON (t.name)'
    ];
    
    for (const index of indices) {
      try {
        await this.executeCypher(index);
        console.log('  ✅ Created index');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.error('  ❌ Failed to create index:', error.message);
        }
      }
    }
  }

  /**
   * Run graph algorithms
   */
  async runGraphAlgorithms() {
    console.log('\n🧮 Running graph algorithms...');
    
    // Calculate PageRank for topics
    try {
      await this.executeCypher(`
        MATCH (t:Topic)
        WITH collect(t) as topics
        CALL apoc.algo.pageRank(topics) YIELD node, score
        SET node.pagerank = score
      `);
      console.log('  ✅ Calculated PageRank for topics');
    } catch (error) {
      console.log('  ℹ️  PageRank requires APOC plugin');
    }
    
    // Calculate degree centrality
    try {
      const result = await this.executeCypher(`
        MATCH (t:Topic)
        OPTIONAL MATCH (t)<-[r]-()
        WITH t, count(r) as degree
        SET t.degree = degree
        RETURN t.name as topic, degree
        ORDER BY degree DESC
        LIMIT 5
      `);
      
      console.log('  📊 Top topics by connections:');
      if (result.data) {
        for (const row of result.data) {
          console.log(`    ${row.row[0]}: ${row.row[1]} connections`);
        }
      }
    } catch (error) {
      console.error('  ❌ Failed to calculate degree:', error.message);
    }
  }

  /**
   * Test graph traversal queries
   */
  async testGraphTraversal() {
    console.log('\n🔍 Testing graph traversal...');
    
    // Find documents related to a topic
    console.log('\n  Documents related to "Artificial Intelligence":');
    try {
      const result = await this.executeCypher(`
        MATCH (t:Topic {name: 'Artificial Intelligence'})
        OPTIONAL MATCH (t)<-[:COVERS]-(d:Document)
        RETURN d.title as document
        LIMIT 5
      `);
      
      if (result.data) {
        for (const row of result.data) {
          if (row.row[0]) {
            console.log(`    - ${row.row[0]}`);
          }
        }
      }
    } catch (error) {
      console.error('    ❌ Query failed:', error.message);
    }
    
    // Find connected entities
    console.log('\n  Entity connections (2-hop):');
    try {
      const result = await this.executeCypher(`
        MATCH path = (c:Chunk)-[*1..2]-(e)
        WHERE c.id STARTS WITH 'doc1' 
        AND (e:Person OR e:Organization OR e:Topic)
        RETURN DISTINCT labels(e)[0] as type, 
               CASE 
                 WHEN e.name IS NOT NULL THEN e.name
                 WHEN e.title IS NOT NULL THEN e.title
                 ELSE 'Unknown'
               END as name
        LIMIT 10
      `);
      
      if (result.data) {
        for (const row of result.data) {
          console.log(`    ${row.row[0]}: ${row.row[1]}`);
        }
      }
    } catch (error) {
      console.error('    ❌ Query failed:', error.message);
    }
  }

  /**
   * Show progress
   */
  showProgress() {
    console.log(`  📊 Progress: Docs: ${this.stats.documents} | Chunks: ${this.stats.chunks} | Entities: ${this.stats.entities} | Relationships: ${this.stats.relationships}`);
  }

  /**
   * Get final statistics
   */
  async getFinalStats() {
    const nodeCount = await this.executeCypher('MATCH (n) RETURN count(n) as count');
    const relCount = await this.executeCypher('MATCH ()-[r]->() RETURN count(r) as count');
    
    return {
      ...this.stats,
      totalNodes: nodeCount.data?.[0]?.row[0] || 0,
      totalRelationships: relCount.data?.[0]?.row[0] || 0,
      errorCount: this.stats.errors.length
    };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Neo4j Knowledge Graph Builder for Graph RAG 10T POC');
  console.log('======================================================');
  console.log('  URI:', NEO4J_URI);
  console.log('  Database:', NEO4J_DATABASE);
  console.log('  Input File:', INPUT_FILE);
  console.log('  Batch Size:', BATCH_SIZE);
  console.log('======================================================\n');
  
  const builder = new Neo4jKnowledgeGraphBuilder();
  
  try {
    // Check if file exists
    const filePath = path.isAbsolute(INPUT_FILE) ? INPUT_FILE : path.join(process.cwd(), INPUT_FILE);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Input file not found: ${filePath}`);
    }
    
    // Build Knowledge Graph
    await builder.buildFromFile(filePath);
    
    // Create indices
    await builder.createGraphIndices();
    
    // Run algorithms
    await builder.runGraphAlgorithms();
    
    // Test traversal
    await builder.testGraphTraversal();
    
    // Get final statistics
    const stats = await builder.getFinalStats();
    
    console.log('\n✅ Knowledge Graph Building Complete!');
    console.log('📈 Final Statistics:');
    console.log(`  Documents: ${stats.documents}`);
    console.log(`  Chunks: ${stats.chunks}`);
    console.log(`  Entities: ${stats.entities}`);
    console.log(`  Relationships: ${stats.relationships}`);
    console.log(`  Total Nodes: ${stats.totalNodes}`);
    console.log(`  Total Relationships: ${stats.totalRelationships}`);
    
    if (stats.errorCount > 0) {
      console.log(`  ⚠️  Errors: ${stats.errorCount}`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export default Neo4jKnowledgeGraphBuilder;