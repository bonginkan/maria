#!/usr/bin/env node
/**
 * Neo4j Setup Script v2.1 for Graph RAG 10T POC
 * Improved version with proper constraints, batch operations, and monitoring
 */

const NEO4J_URI = process.env.POC_NEO4J_HTTP_URI || 'http://localhost:7474';
const NEO4J_USER = process.env.POC_NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.POC_NEO4J_PASSWORD || 'testpass';
const NEO4J_DATABASE = process.env.POC_NEO4J_DATABASE || 'neo4j';

class Neo4jSetupV2 {
  constructor() {
    this.uri = NEO4J_URI;
    this.user = NEO4J_USER;
    this.password = NEO4J_PASSWORD;
    this.database = NEO4J_DATABASE;
    
    this.metrics = {
      startTime: Date.now(),
      constraintsCreated: 0,
      indexesCreated: 0,
      nodesCreated: 0,
      relationshipsCreated: 0,
      errors: []
    };
  }

  /**
   * Execute Cypher query with metrics
   */
  async executeCypher(query, parameters = {}, description = '') {
    const queryStart = Date.now();
    
    try {
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
        throw new Error(`Query failed: ${error}`);
      }

      const result = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        throw new Error(`Cypher error: ${result.errors[0].message}`);
      }

      const queryTime = Date.now() - queryStart;
      
      // Log slow queries
      if (queryTime > 1000) {
        console.warn(`⚠️  Slow query (${queryTime}ms): ${description || query.substring(0, 50)}`);
      }

      return result.results[0];
    } catch (error) {
      this.metrics.errors.push({
        query: description || query.substring(0, 100),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check APOC availability
   */
  async checkAPOC() {
    try {
      await this.executeCypher('RETURN apoc.version() as version');
      console.log('✅ APOC plugin is available');
      return true;
    } catch (error) {
      console.log('ℹ️  APOC not available - some features will be skipped');
      return false;
    }
  }

  /**
   * Clear database (optional)
   */
  async clearDatabase() {
    if (process.env.CLEAR_NEO4J !== 'true') {
      console.log('ℹ️  Skipping database clear (set CLEAR_NEO4J=true to clear)');
      return;
    }

    console.log('🗑️  Clearing existing data...');
    
    try {
      // Use APOC if available for better performance
      const hasAPOC = await this.checkAPOC();
      
      if (hasAPOC) {
        await this.executeCypher('CALL apoc.periodic.iterate("MATCH (n) RETURN n", "DETACH DELETE n", {batchSize:1000})');
      } else {
        await this.executeCypher('MATCH (n) DETACH DELETE n');
      }
      
      console.log('✅ Database cleared');
    } catch (error) {
      console.error('❌ Failed to clear database:', error.message);
    }
  }

  /**
   * Create constraints and indexes from schema file
   */
  async createSchemaConstraints() {
    console.log('🔐 Creating constraints and indexes...\n');
    
    const constraints = [
      // Core entity constraints with consistent naming
      { name: 'doc_id', query: 'CREATE CONSTRAINT doc_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE' },
      { name: 'para_chunk_id', query: 'CREATE CONSTRAINT para_chunk_id IF NOT EXISTS FOR (p:Paragraph) REQUIRE p.chunk_id IS UNIQUE' },
      { name: 'topic_name', query: 'CREATE CONSTRAINT topic_name IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE' },
      { name: 'person_id', query: 'CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE' },
      { name: 'org_id', query: 'CREATE CONSTRAINT org_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE' },
      { name: 'dept_name', query: 'CREATE CONSTRAINT dept_name IF NOT EXISTS FOR (d:Department) REQUIRE d.name IS UNIQUE' },
      { name: 'proj_id', query: 'CREATE CONSTRAINT proj_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE' },
      { name: 'source_name', query: 'CREATE CONSTRAINT source_name IF NOT EXISTS FOR (s:Source) REQUIRE s.name IS UNIQUE' },
      { name: 'user_id', query: 'CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE' },
      { name: 'group_id', query: 'CREATE CONSTRAINT group_id IF NOT EXISTS FOR (g:Group) REQUIRE g.id IS UNIQUE' }
    ];

    for (const constraint of constraints) {
      try {
        await this.executeCypher(constraint.query, {}, `Create constraint ${constraint.name}`);
        console.log(`  ✅ Created constraint: ${constraint.name}`);
        this.metrics.constraintsCreated++;
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ℹ️  Constraint exists: ${constraint.name}`);
        } else {
          console.error(`  ❌ Failed constraint ${constraint.name}:`, error.message);
        }
      }
    }
  }

  /**
   * Create performance indexes
   */
  async createIndexes() {
    console.log('\n📇 Creating performance indexes...\n');
    
    const indexes = [
      { name: 'doc_source', query: 'CREATE INDEX doc_source IF NOT EXISTS FOR (d:Document) ON (d.source)' },
      { name: 'doc_created', query: 'CREATE INDEX doc_created IF NOT EXISTS FOR (d:Document) ON (d.created_at)' },
      { name: 'para_sequence', query: 'CREATE INDEX para_sequence IF NOT EXISTS FOR (p:Paragraph) ON (p.sequence)' },
      { name: 'para_token_count', query: 'CREATE INDEX para_token_count IF NOT EXISTS FOR (p:Paragraph) ON (p.token_count)' },
      { name: 'topic_category', query: 'CREATE INDEX topic_category IF NOT EXISTS FOR (t:Topic) ON (t.category)' },
      { name: 'topic_pagerank', query: 'CREATE INDEX topic_pagerank IF NOT EXISTS FOR (t:Topic) ON (t.pagerank)' },
      { name: 'person_name', query: 'CREATE INDEX person_name IF NOT EXISTS FOR (p:Person) ON (p.name)' },
      { name: 'org_name', query: 'CREATE INDEX org_name IF NOT EXISTS FOR (o:Organization) ON (o.name)' },
      { name: 'proj_status', query: 'CREATE INDEX proj_status IF NOT EXISTS FOR (p:Project) ON (p.status)' }
    ];

    for (const index of indexes) {
      try {
        await this.executeCypher(index.query, {}, `Create index ${index.name}`);
        console.log(`  ✅ Created index: ${index.name}`);
        this.metrics.indexesCreated++;
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ℹ️  Index exists: ${index.name}`);
        } else {
          console.error(`  ❌ Failed index ${index.name}:`, error.message);
        }
      }
    }
  }

  /**
   * Create fulltext indexes (Neo4j 5.x syntax)
   */
  async createFulltextIndexes() {
    console.log('\n🔍 Creating fulltext indexes...\n');
    
    const fulltextIndexes = [
      {
        name: 'paragraph_content_fts',
        query: 'CREATE FULLTEXT INDEX paragraph_content_fts IF NOT EXISTS FOR (p:Paragraph) ON EACH [p.content]'
      },
      {
        name: 'document_title_fts',
        query: 'CREATE FULLTEXT INDEX document_title_fts IF NOT EXISTS FOR (d:Document) ON EACH [d.title]'
      },
      {
        name: 'topic_name_fts',
        query: 'CREATE FULLTEXT INDEX topic_name_fts IF NOT EXISTS FOR (t:Topic) ON EACH [t.name]'
      },
      {
        name: 'person_name_fts',
        query: 'CREATE FULLTEXT INDEX person_name_fts IF NOT EXISTS FOR (p:Person) ON EACH [p.name]'
      }
    ];

    for (const index of fulltextIndexes) {
      try {
        await this.executeCypher(index.query, {}, `Create fulltext index ${index.name}`);
        console.log(`  ✅ Created fulltext index: ${index.name}`);
        this.metrics.indexesCreated++;
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ℹ️  Fulltext index exists: ${index.name}`);
        } else {
          console.error(`  ❌ Failed fulltext index ${index.name}:`, error.message);
        }
      }
    }
  }

  /**
   * Create Core-KG entities using batch operations
   */
  async createCoreEntitiesBatch() {
    console.log('\n👥 Creating Core-KG entities (batch mode)...\n');

    // Organizations batch
    const organizations = [
      { id: 'org-1', name: 'Acme Corporation', industry: 'Technology' },
      { id: 'org-2', name: 'Global Industries', industry: 'Finance' },
      { id: 'org-3', name: 'Research Lab', industry: 'R&D' }
    ];

    await this.executeCypher(`
      UNWIND $orgs as org
      MERGE (o:Organization {id: org.id})
      ON CREATE SET o.name = org.name, o.industry = org.industry
      ON MATCH SET o.name = org.name, o.industry = org.industry
      RETURN count(o) as created
    `, { orgs: organizations }, 'Create organizations batch');
    
    console.log(`  ✅ Created ${organizations.length} organizations`);
    this.metrics.nodesCreated += organizations.length;

    // Departments with relationships batch
    const departments = [
      { name: 'Engineering', org_id: 'org-1', description: 'Product development and engineering' },
      { name: 'Sales', org_id: 'org-1', description: 'Sales and business development' },
      { name: 'Marketing', org_id: 'org-1', description: 'Marketing and communications' },
      { name: 'HR', org_id: 'org-1', description: 'Human resources' },
      { name: 'R&D', org_id: 'org-3', description: 'Research and development' }
    ];

    await this.executeCypher(`
      UNWIND $depts as dept
      MERGE (d:Department {name: dept.name})
      ON CREATE SET d.description = dept.description
      ON MATCH SET d.description = dept.description
      WITH d, dept
      MATCH (o:Organization {id: dept.org_id})
      MERGE (d)-[:BELONGS_TO]->(o)
      RETURN count(d) as created
    `, { depts: departments }, 'Create departments batch');
    
    console.log(`  ✅ Created ${departments.length} departments`);
    this.metrics.nodesCreated += departments.length;
    this.metrics.relationshipsCreated += departments.length;

    // People batch with department relationships
    const people = [
      { id: 'person-1', name: 'John Smith', title: 'Sales Manager', email: 'john.smith@acme.com', dept: 'Sales' },
      { id: 'person-2', name: 'Jane Doe', title: 'Senior Sales Rep', email: 'jane.doe@acme.com', dept: 'Sales' },
      { id: 'person-3', name: 'Mike Johnson', title: 'Tech Lead', email: 'mike.johnson@acme.com', dept: 'Engineering' },
      { id: 'person-4', name: 'Sarah Williams', title: 'Marketing Director', email: 'sarah.williams@acme.com', dept: 'Marketing' },
      { id: 'person-5', name: 'Tom Brown', title: 'HR Manager', email: 'tom.brown@acme.com', dept: 'HR' }
    ];

    await this.executeCypher(`
      UNWIND $people as person
      MERGE (p:Person {id: person.id})
      ON CREATE SET p.name = person.name, p.title = person.title, p.email = person.email
      ON MATCH SET p.name = person.name, p.title = person.title, p.email = person.email
      WITH p, person
      MATCH (d:Department {name: person.dept})
      MERGE (p)-[:WORKS_IN]->(d)
      RETURN count(p) as created
    `, { people }, 'Create people batch');
    
    console.log(`  ✅ Created ${people.length} people`);
    this.metrics.nodesCreated += people.length;
    this.metrics.relationshipsCreated += people.length;

    // Projects batch
    const projects = [
      { id: 'proj-1', name: 'AI Platform Development', status: 'active', budget: 500000 },
      { id: 'proj-2', name: 'Cloud Migration', status: 'active', budget: 300000 },
      { id: 'proj-3', name: 'Customer Portal', status: 'completed', budget: 200000 }
    ];

    await this.executeCypher(`
      UNWIND $projects as proj
      MERGE (p:Project {id: proj.id})
      ON CREATE SET p.name = proj.name, p.status = proj.status, p.budget = proj.budget
      ON MATCH SET p.name = proj.name, p.status = proj.status, p.budget = proj.budget
      RETURN count(p) as created
    `, { projects }, 'Create projects batch');
    
    console.log(`  ✅ Created ${projects.length} projects`);
    this.metrics.nodesCreated += projects.length;

    // Topics batch
    const topics = [
      { name: 'Artificial Intelligence', category: 'Technology' },
      { name: 'Machine Learning', category: 'Technology' },
      { name: 'Cloud Computing', category: 'Infrastructure' },
      { name: 'Data Security', category: 'Security' },
      { name: 'Customer Experience', category: 'Business' },
      { name: 'Remote Work', category: 'HR' },
      { name: 'Budget Planning', category: 'Finance' },
      { name: 'Compliance', category: 'Legal' }
    ];

    await this.executeCypher(`
      UNWIND $topics as topic
      MERGE (t:Topic {name: topic.name})
      ON CREATE SET t.category = topic.category, t.pagerank = 0.15, t.degree = 0
      ON MATCH SET t.category = topic.category
      RETURN count(t) as created
    `, { topics }, 'Create topics batch');
    
    console.log(`  ✅ Created ${topics.length} topics`);
    this.metrics.nodesCreated += topics.length;
  }

  /**
   * Create Core-KG relationships batch
   */
  async createCoreRelationshipsBatch() {
    console.log('\n🔗 Creating Core-KG relationships (batch)...\n');

    // Project assignments batch
    const assignments = [
      { person_id: 'person-3', project_id: 'proj-1', role: 'Lead Developer' },
      { person_id: 'person-1', project_id: 'proj-2', role: 'Business Owner' },
      { person_id: 'person-4', project_id: 'proj-3', role: 'Product Owner' }
    ];

    await this.executeCypher(`
      UNWIND $assignments as a
      MATCH (person:Person {id: a.person_id})
      MATCH (project:Project {id: a.project_id})
      MERGE (person)-[:ASSIGNED_TO {role: a.role}]->(project)
      RETURN count(*) as created
    `, { assignments }, 'Create project assignments');
    
    this.metrics.relationshipsCreated += assignments.length;

    // Project-Topic relationships batch
    const projectTopics = [
      { project_id: 'proj-1', topic_names: ['Artificial Intelligence', 'Machine Learning'] },
      { project_id: 'proj-2', topic_names: ['Cloud Computing', 'Data Security'] },
      { project_id: 'proj-3', topic_names: ['Customer Experience'] }
    ];

    await this.executeCypher(`
      UNWIND $projectTopics as pt
      MATCH (project:Project {id: pt.project_id})
      UNWIND pt.topic_names as topic_name
      MATCH (topic:Topic {name: topic_name})
      MERGE (project)-[:RELATED_TO]->(topic)
      RETURN count(*) as created
    `, { projectTopics }, 'Create project-topic relationships');
    
    const topicRelCount = projectTopics.reduce((sum, pt) => sum + pt.topic_names.length, 0);
    this.metrics.relationshipsCreated += topicRelCount;

    // Manager relationships
    await this.executeCypher(`
      MATCH (manager:Person {id: 'person-1'})
      MATCH (report:Person {id: 'person-2'})
      MERGE (report)-[:REPORTS_TO]->(manager)
      RETURN count(*) as created
    `, {}, 'Create manager relationships');
    
    this.metrics.relationshipsCreated += 1;

    console.log('  ✅ Created all Core-KG relationships');
  }

  /**
   * Validate schema compliance
   */
  async validateSchema() {
    console.log('\n✅ Validating schema...\n');

    try {
      // Count nodes by label
      const nodeStats = await this.executeCypher(`
        CALL db.labels() YIELD label
        RETURN label, 
               size([(n) WHERE label IN labels(n) | n]) as count
        ORDER BY count DESC
      `);

      console.log('  Node counts:');
      if (nodeStats.data) {
        for (const row of nodeStats.data) {
          console.log(`    ${row.row[0]}: ${row.row[1]}`);
        }
      }

      // Count relationships
      const relStats = await this.executeCypher(`
        MATCH ()-[r]->()
        RETURN type(r) as type, count(r) as count
        ORDER BY count DESC
      `);

      console.log('\n  Relationship counts:');
      if (relStats.data) {
        for (const row of relStats.data) {
          console.log(`    ${row.row[0]}: ${row.row[1]}`);
        }
      }

    } catch (error) {
      console.error('  ❌ Validation failed:', error.message);
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const elapsed = (Date.now() - this.metrics.startTime) / 1000;
    
    return {
      ...this.metrics,
      elapsedTime: elapsed,
      operationsPerSecond: Math.round((this.metrics.nodesCreated + this.metrics.relationshipsCreated) / elapsed)
    };
  }

  /**
   * Main setup execution
   */
  async setup() {
    console.log('🚀 Neo4j Setup v2.1 for Graph RAG 10T POC');
    console.log('==========================================');
    console.log('  URI:', this.uri);
    console.log('  Database:', this.database);
    console.log('==========================================\n');

    try {
      // Wait for Neo4j
      await this.waitForNeo4j();

      // Check APOC availability
      const hasAPOC = await this.checkAPOC();

      // Clear if requested
      await this.clearDatabase();

      // Create schema
      await this.createSchemaConstraints();
      await this.createIndexes();
      await this.createFulltextIndexes();

      // Create Core-KG
      await this.createCoreEntitiesBatch();
      await this.createCoreRelationshipsBatch();

      // Validate
      await this.validateSchema();

      // Show metrics
      const metrics = this.getMetrics();
      console.log('\n📊 Setup Metrics:');
      console.log(`  Constraints created: ${metrics.constraintsCreated}`);
      console.log(`  Indexes created: ${metrics.indexesCreated}`);
      console.log(`  Nodes created: ${metrics.nodesCreated}`);
      console.log(`  Relationships created: ${metrics.relationshipsCreated}`);
      console.log(`  Elapsed time: ${metrics.elapsedTime.toFixed(2)}s`);
      console.log(`  Operations/sec: ${metrics.operationsPerSecond}`);
      
      if (metrics.errors.length > 0) {
        console.log(`\n  ⚠️  Errors encountered: ${metrics.errors.length}`);
        metrics.errors.forEach(err => {
          console.log(`    - ${err.query}: ${err.error}`);
        });
      }

      console.log('\n✅ Neo4j setup v2.1 complete!');
      console.log('📝 Next: Run neo4j-build-kg-v2.js for optimized KG building');

    } catch (error) {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    }
  }

  /**
   * Wait for Neo4j to be ready
   */
  async waitForNeo4j() {
    let retries = 30;
    while (retries > 0) {
      try {
        const response = await fetch(`${this.uri}/db/${this.database}/tx/commit`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${this.user}:${this.password}`).toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ statements: [] })
        });

        if (response.ok) {
          console.log('✅ Neo4j is ready\n');
          return;
        }
      } catch (error) {
        // Continue waiting
      }
      
      console.log(`⏳ Waiting for Neo4j... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      retries--;
    }

    throw new Error('Neo4j is not responding');
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new Neo4jSetupV2();
  setup.setup().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export default Neo4jSetupV2;