#!/usr/bin/env node
/**
 * Neo4j Setup Script for Graph RAG 10T POC
 * Creates graph database schema and constraints
 * Initializes Core-KG and Document subgraph structures
 */

const NEO4J_URI = process.env.POC_NEO4J_HTTP_URI || 'http://localhost:7474';
const NEO4J_BOLT_URI = process.env.POC_NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.POC_NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.POC_NEO4J_PASSWORD || 'testpass';
const NEO4J_DATABASE = process.env.POC_NEO4J_DATABASE || 'neo4j';

/**
 * Execute Cypher query via HTTP API
 */
async function executeCypher(query, parameters = {}) {
  const response = await fetch(`${NEO4J_URI}/db/${NEO4J_DATABASE}/tx/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`${NEO4J_USER}:${NEO4J_PASSWORD}`).toString('base64')
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
 * Clear existing data (for POC only)
 */
async function clearDatabase() {
  console.log('🗑️  Clearing existing data...');
  
  try {
    // Delete all relationships and nodes
    await executeCypher('MATCH (n) DETACH DELETE n');
    console.log('✅ Database cleared');
  } catch (error) {
    console.error('❌ Failed to clear database:', error.message);
  }
}

/**
 * Create constraints and indexes
 */
async function createConstraints() {
  console.log('🔐 Creating constraints and indexes...');
  
  const constraints = [
    // Core entity constraints
    {
      name: 'document_id_unique',
      query: 'CREATE CONSTRAINT document_id_unique IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE'
    },
    {
      name: 'chunk_id_unique',
      query: 'CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE'
    },
    {
      name: 'person_id_unique',
      query: 'CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE'
    },
    {
      name: 'organization_id_unique',
      query: 'CREATE CONSTRAINT organization_id_unique IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE'
    },
    {
      name: 'project_id_unique',
      query: 'CREATE CONSTRAINT project_id_unique IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE'
    },
    {
      name: 'topic_name_unique',
      query: 'CREATE CONSTRAINT topic_name_unique IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE'
    },
    {
      name: 'department_name_unique',
      query: 'CREATE CONSTRAINT department_name_unique IF NOT EXISTS FOR (d:Department) REQUIRE d.name IS UNIQUE'
    }
  ];

  for (const constraint of constraints) {
    try {
      await executeCypher(constraint.query);
      console.log(`  ✅ Created constraint: ${constraint.name}`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`  ℹ️  Constraint already exists: ${constraint.name}`);
      } else {
        console.error(`  ❌ Failed to create constraint ${constraint.name}:`, error.message);
      }
    }
  }

  // Create additional indexes for performance
  const indexes = [
    {
      name: 'document_source_index',
      query: 'CREATE INDEX document_source_index IF NOT EXISTS FOR (d:Document) ON (d.source)'
    },
    {
      name: 'document_date_index',
      query: 'CREATE INDEX document_date_index IF NOT EXISTS FOR (d:Document) ON (d.created_at)'
    },
    {
      name: 'chunk_sequence_index',
      query: 'CREATE INDEX chunk_sequence_index IF NOT EXISTS FOR (c:Chunk) ON (c.sequence)'
    },
    {
      name: 'person_name_index',
      query: 'CREATE INDEX person_name_index IF NOT EXISTS FOR (p:Person) ON (p.name)'
    },
    {
      name: 'organization_name_index',
      query: 'CREATE INDEX organization_name_index IF NOT EXISTS FOR (o:Organization) ON (o.name)'
    },
    {
      name: 'topic_category_index',
      query: 'CREATE INDEX topic_category_index IF NOT EXISTS FOR (t:Topic) ON (t.category)'
    }
  ];

  for (const index of indexes) {
    try {
      await executeCypher(index.query);
      console.log(`  ✅ Created index: ${index.name}`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`  ℹ️  Index already exists: ${index.name}`);
      } else {
        console.error(`  ❌ Failed to create index ${index.name}:`, error.message);
      }
    }
  }
}

/**
 * Create sample Core-KG entities
 */
async function createCoreEntities() {
  console.log('\n👥 Creating Core-KG entities...');

  // Create Organizations
  const organizations = [
    { id: 'org-1', name: 'Acme Corporation', industry: 'Technology' },
    { id: 'org-2', name: 'Global Industries', industry: 'Finance' },
    { id: 'org-3', name: 'Research Lab', industry: 'R&D' }
  ];

  for (const org of organizations) {
    await executeCypher(
      'MERGE (o:Organization {id: $id}) SET o.name = $name, o.industry = $industry',
      org
    );
  }
  console.log(`  ✅ Created ${organizations.length} organizations`);

  // Create Departments
  const departments = [
    { name: 'Engineering', org_id: 'org-1' },
    { name: 'Sales', org_id: 'org-1' },
    { name: 'Marketing', org_id: 'org-1' },
    { name: 'HR', org_id: 'org-1' },
    { name: 'R&D', org_id: 'org-3' }
  ];

  for (const dept of departments) {
    await executeCypher(`
      MERGE (d:Department {name: $name})
      WITH d
      MATCH (o:Organization {id: $org_id})
      MERGE (d)-[:BELONGS_TO]->(o)
    `, dept);
  }
  console.log(`  ✅ Created ${departments.length} departments`);

  // Create People
  const people = [
    { id: 'person-1', name: 'John Smith', title: 'Sales Manager', dept: 'Sales' },
    { id: 'person-2', name: 'Jane Doe', title: 'Senior Sales Rep', dept: 'Sales' },
    { id: 'person-3', name: 'Mike Johnson', title: 'Tech Lead', dept: 'Engineering' },
    { id: 'person-4', name: 'Sarah Williams', title: 'Marketing Director', dept: 'Marketing' },
    { id: 'person-5', name: 'Tom Brown', title: 'HR Manager', dept: 'HR' }
  ];

  for (const person of people) {
    await executeCypher(`
      MERGE (p:Person {id: $id})
      SET p.name = $name, p.title = $title
      WITH p
      MATCH (d:Department {name: $dept})
      MERGE (p)-[:WORKS_IN]->(d)
    `, person);
  }
  console.log(`  ✅ Created ${people.length} people`);

  // Create Projects
  const projects = [
    { id: 'proj-1', name: 'AI Platform Development', status: 'active', budget: 500000 },
    { id: 'proj-2', name: 'Cloud Migration', status: 'active', budget: 300000 },
    { id: 'proj-3', name: 'Customer Portal', status: 'completed', budget: 200000 }
  ];

  for (const project of projects) {
    await executeCypher(
      'MERGE (p:Project {id: $id}) SET p.name = $name, p.status = $status, p.budget = $budget',
      project
    );
  }
  console.log(`  ✅ Created ${projects.length} projects`);

  // Create Topics
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

  for (const topic of topics) {
    await executeCypher(
      'MERGE (t:Topic {name: $name}) SET t.category = $category',
      topic
    );
  }
  console.log(`  ✅ Created ${topics.length} topics`);

  // Create relationships between entities
  await createCoreRelationships();
}

/**
 * Create relationships between Core-KG entities
 */
async function createCoreRelationships() {
  console.log('\n🔗 Creating Core-KG relationships...');

  // Project assignments
  const assignments = [
    { person_id: 'person-3', project_id: 'proj-1', role: 'Lead Developer' },
    { person_id: 'person-1', project_id: 'proj-2', role: 'Business Owner' },
    { person_id: 'person-4', project_id: 'proj-3', role: 'Product Owner' }
  ];

  for (const assignment of assignments) {
    await executeCypher(`
      MATCH (p:Person {id: $person_id})
      MATCH (proj:Project {id: $project_id})
      MERGE (p)-[:ASSIGNED_TO {role: $role}]->(proj)
    `, assignment);
  }

  // Project topics
  const projectTopics = [
    { project_id: 'proj-1', topics: ['Artificial Intelligence', 'Machine Learning'] },
    { project_id: 'proj-2', topics: ['Cloud Computing', 'Data Security'] },
    { project_id: 'proj-3', topics: ['Customer Experience'] }
  ];

  for (const pt of projectTopics) {
    for (const topicName of pt.topics) {
      await executeCypher(`
        MATCH (p:Project {id: $project_id})
        MATCH (t:Topic {name: $topic_name})
        MERGE (p)-[:RELATED_TO]->(t)
      `, { project_id: pt.project_id, topic_name: topicName });
    }
  }

  // Manager relationships
  await executeCypher(`
    MATCH (manager:Person {id: 'person-1'})
    MATCH (report:Person {id: 'person-2'})
    MERGE (report)-[:REPORTS_TO]->(manager)
  `);

  console.log('  ✅ Created Core-KG relationships');
}

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  console.log('\n📊 Database Statistics:');

  try {
    // Count nodes by label
    const nodeStats = await executeCypher(`
      CALL db.labels() YIELD label
      CALL apoc.cypher.run('MATCH (n:' + label + ') RETURN count(n) as count', {}) YIELD value
      RETURN label, value.count as count
      ORDER BY label
    `);

    console.log('\n  Node counts:');
    if (nodeStats.data && nodeStats.data.length > 0) {
      for (const row of nodeStats.data) {
        console.log(`    ${row.row[0]}: ${row.row[1]}`);
      }
    }

    // Count relationships by type
    const relStats = await executeCypher(`
      CALL db.relationshipTypes() YIELD relationshipType
      CALL apoc.cypher.run('MATCH ()-[r:' + relationshipType + ']->() RETURN count(r) as count', {}) YIELD value
      RETURN relationshipType, value.count as count
      ORDER BY relationshipType
    `);

    console.log('\n  Relationship counts:');
    if (relStats.data && relStats.data.length > 0) {
      for (const row of relStats.data) {
        console.log(`    ${row.row[0]}: ${row.row[1]}`);
      }
    }
  } catch (error) {
    // Fallback if APOC is not available
    try {
      const simpleStats = await executeCypher(`
        MATCH (n)
        RETURN count(n) as nodeCount
      `);
      
      const relCount = await executeCypher(`
        MATCH ()-[r]->()
        RETURN count(r) as relCount
      `);
      
      console.log(`  Total nodes: ${simpleStats.data[0]?.row[0] || 0}`);
      console.log(`  Total relationships: ${relCount.data[0]?.row[0] || 0}`);
    } catch (err) {
      console.warn('  ⚠️  Could not retrieve statistics');
    }
  }
}

/**
 * Test graph queries
 */
async function testGraphQueries() {
  console.log('\n🧪 Testing graph queries...');

  // Test 1: Find projects and their topics
  console.log('\n  Test 1: Projects and their topics');
  try {
    const result = await executeCypher(`
      MATCH (p:Project)-[:RELATED_TO]->(t:Topic)
      RETURN p.name as project, collect(t.name) as topics
      ORDER BY p.name
    `);
    
    if (result.data) {
      for (const row of result.data) {
        console.log(`    ${row.row[0]}: ${row.row[1].join(', ')}`);
      }
    }
  } catch (error) {
    console.error('    ❌ Test failed:', error.message);
  }

  // Test 2: Find people in departments
  console.log('\n  Test 2: People and their departments');
  try {
    const result = await executeCypher(`
      MATCH (p:Person)-[:WORKS_IN]->(d:Department)
      RETURN d.name as department, collect(p.name) as people
      ORDER BY d.name
    `);
    
    if (result.data) {
      for (const row of result.data) {
        console.log(`    ${row.row[0]}: ${row.row[1].join(', ')}`);
      }
    }
  } catch (error) {
    console.error('    ❌ Test failed:', error.message);
  }

  // Test 3: Organization structure
  console.log('\n  Test 3: Organization structure');
  try {
    const result = await executeCypher(`
      MATCH (d:Department)-[:BELONGS_TO]->(o:Organization)
      RETURN o.name as org, collect(d.name) as departments
      ORDER BY o.name
    `);
    
    if (result.data) {
      for (const row of result.data) {
        console.log(`    ${row.row[0]}: ${row.row[1].join(', ')}`);
      }
    }
  } catch (error) {
    console.error('    ❌ Test failed:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Neo4j Setup for Graph RAG 10T POC');
  console.log('====================================');
  console.log('  URI:', NEO4J_URI);
  console.log('  Database:', NEO4J_DATABASE);
  console.log('  User:', NEO4J_USER);
  console.log('====================================\n');

  // Wait for Neo4j to be ready
  let retries = 30;
  while (retries > 0) {
    try {
      const response = await fetch(`${NEO4J_URI}/db/${NEO4J_DATABASE}/tx/commit`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${NEO4J_USER}:${NEO4J_PASSWORD}`).toString('base64'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statements: [] })
      });

      if (response.ok) {
        console.log('✅ Neo4j is ready');
        break;
      }
    } catch (error) {
      console.log(`⏳ Waiting for Neo4j... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      retries--;
    }
  }

  if (retries === 0) {
    console.error('❌ Neo4j is not responding');
    process.exit(1);
  }

  try {
    // Clear existing data (optional for POC)
    if (process.env.CLEAR_NEO4J === 'true') {
      await clearDatabase();
    }

    // Create constraints and indexes
    await createConstraints();

    // Create Core-KG entities
    await createCoreEntities();

    // Get statistics
    await getDatabaseStats();

    // Test queries
    await testGraphQueries();

    console.log('\n✅ Neo4j setup complete!');
    console.log('📝 Next step: Run neo4j-build-kg.js to build Knowledge Graph from chunks');

  } catch (error) {
    console.error('❌ Setup failed:', error);
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

export { executeCypher, createConstraints, createCoreEntities };