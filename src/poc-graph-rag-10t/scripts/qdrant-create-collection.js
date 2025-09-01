#!/usr/bin/env node
/**
 * Qdrant Collection Creation Script for Graph RAG 10T POC
 * Creates optimized vector collection for semantic search
 * Supports HNSW indexing with configurable parameters
 */

const BASE_URL = process.env.POC_QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = process.env.POC_QDRANT_COLLECTION || 'maria_vectors';
const VECTOR_DIM = parseInt(process.env.POC_QDRANT_VECTOR_DIM || '1536'); // OpenAI ada-002
const DISTANCE = process.env.POC_QDRANT_DISTANCE || 'Cosine';

/**
 * Create Qdrant collection with optimized settings
 */
async function createCollection() {
  console.log('🔨 Creating Qdrant collection:', COLLECTION_NAME);
  
  // Collection configuration
  const collectionConfig = {
    vectors: {
      size: VECTOR_DIM,
      distance: DISTANCE, // Cosine, Euclid, or Dot
      
      // HNSW index configuration for fast ANN search
      hnsw_config: {
        m: parseInt(process.env.POC_QDRANT_HNSW_M || '16'), // Number of bi-directional links
        ef_construct: parseInt(process.env.POC_QDRANT_HNSW_EF || '100'), // Size of dynamic candidate list
        full_scan_threshold: 10000, // Switch to full scan if fewer points
        max_indexing_threads: 0, // Use all available threads
        on_disk: false, // Keep in memory for faster access
        payload_m: null // Use default payload indexing
      },
      
      // Quantization for memory efficiency (optional)
      quantization_config: null // Can add scalar/product quantization if needed
    },
    
    // Shard configuration
    shard_number: 2, // Number of shards for parallelism
    replication_factor: 1, // Number of replicas per shard
    write_consistency_factor: 1, // Write acknowledgment from N replicas
    
    // On-disk storage configuration
    on_disk_payload: false, // Keep payload in memory for speed
    
    // Optional: WAL configuration
    wal_config: {
      wal_capacity_mb: 32,
      wal_segments_ahead: 0
    },
    
    // Optional: Optimizers configuration  
    optimizers_config: {
      deleted_threshold: 0.2, // Trigger optimization when 20% deleted
      vacuum_min_vector_number: 1000, // Minimum vectors before vacuum
      default_segment_number: 0, // Auto-determine segment count
      max_segment_size: null, // No limit
      memmap_threshold: null, // Auto-determine
      indexing_threshold: 20000, // Start indexing after this many vectors
      flush_interval_sec: 5, // Flush to disk interval
      max_optimization_threads: 1 // Optimization thread count
    }
  };
  
  try {
    // Check if collection exists
    const checkResponse = await fetch(`${BASE_URL}/collections/${COLLECTION_NAME}`, {
      method: 'GET'
    });
    
    if (checkResponse.ok) {
      console.log('⚠️  Collection already exists, deleting...');
      
      // Delete existing collection
      const deleteResponse = await fetch(`${BASE_URL}/collections/${COLLECTION_NAME}`, {
        method: 'DELETE'
      });
      
      if (!deleteResponse.ok) {
        const error = await deleteResponse.text();
        console.error('❌ Failed to delete collection:', error);
      } else {
        console.log('✅ Existing collection deleted');
        // Wait for deletion to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Create new collection
    const createResponse = await fetch(`${BASE_URL}/collections/${COLLECTION_NAME}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(collectionConfig)
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create collection: ${error}`);
    }
    
    const result = await createResponse.json();
    console.log('✅ Collection created successfully:', result);
    
    // Wait for collection to be ready
    await waitForCollection();
    
    // Create payload indices for efficient filtering
    await createPayloadIndices();
    
    // Get collection info
    await getCollectionInfo();
    
  } catch (error) {
    console.error('❌ Error creating collection:', error.message);
    throw error;
  }
}

/**
 * Wait for collection to be ready
 */
async function waitForCollection() {
  console.log('⏳ Waiting for collection to be ready...');
  
  let retries = 10;
  while (retries > 0) {
    try {
      const response = await fetch(`${BASE_URL}/collections/${COLLECTION_NAME}`, {
        method: 'GET'
      });
      
      if (response.ok) {
        const info = await response.json();
        if (info.result?.status === 'green') {
          console.log('✅ Collection is ready');
          return;
        }
      }
    } catch (error) {
      // Ignore errors during waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    retries--;
  }
  
  console.warn('⚠️  Collection may not be fully ready');
}

/**
 * Create payload indices for efficient filtering
 */
async function createPayloadIndices() {
  console.log('📇 Creating payload indices...');
  
  const indices = [
    // Keyword indices for exact matching
    {
      field_name: 'doc_id',
      field_schema: 'keyword'
    },
    {
      field_name: 'path',
      field_schema: 'keyword'
    },
    {
      field_name: 'labels',
      field_schema: 'keyword'
    },
    {
      field_name: 'acl.users',
      field_schema: 'keyword'
    },
    {
      field_name: 'acl.groups',
      field_schema: 'keyword'
    },
    
    // Integer indices for range queries
    {
      field_name: 'sequence',
      field_schema: 'integer'
    },
    {
      field_name: 'metadata.tokenCount',
      field_schema: 'integer'
    },
    
    // Float indices for scoring
    {
      field_name: 'metadata.confidence',
      field_schema: 'float'
    }
  ];
  
  for (const index of indices) {
    try {
      const response = await fetch(
        `${BASE_URL}/collections/${COLLECTION_NAME}/index`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(index)
        }
      );
      
      if (response.ok) {
        console.log(`  ✅ Created index on ${index.field_name}`);
      } else {
        const error = await response.text();
        console.warn(`  ⚠️  Failed to create index on ${index.field_name}: ${error}`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Error creating index on ${index.field_name}:`, error.message);
    }
  }
}

/**
 * Get collection information
 */
async function getCollectionInfo() {
  console.log('\n📊 Collection Information:');
  
  try {
    const response = await fetch(`${BASE_URL}/collections/${COLLECTION_NAME}`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error('Failed to get collection info');
    }
    
    const info = await response.json();
    const config = info.result?.config;
    const status = info.result?.status;
    
    console.log('  Name:', COLLECTION_NAME);
    console.log('  Status:', status);
    console.log('  Vector size:', config?.params?.vectors?.size);
    console.log('  Distance:', config?.params?.vectors?.distance);
    console.log('  Shard count:', config?.params?.shard_number);
    console.log('  Point count:', info.result?.points_count || 0);
    console.log('  Segments:', info.result?.segments_count || 0);
    
    if (config?.params?.vectors?.hnsw_config) {
      const hnsw = config.params.vectors.hnsw_config;
      console.log('\n  HNSW Configuration:');
      console.log('    M:', hnsw.m);
      console.log('    EF construct:', hnsw.ef_construct);
      console.log('    Full scan threshold:', hnsw.full_scan_threshold);
    }
    
  } catch (error) {
    console.error('❌ Failed to get collection info:', error.message);
  }
}

/**
 * Create collection aliases
 */
async function createAliases() {
  console.log('\n🏷️  Creating collection aliases...');
  
  const aliases = [
    'maria_vectors_latest',
    'maria_vectors_search'
  ];
  
  for (const alias of aliases) {
    try {
      const response = await fetch(`${BASE_URL}/collections/aliases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          actions: [
            {
              create_alias: {
                collection_name: COLLECTION_NAME,
                alias_name: alias
              }
            }
          ]
        })
      });
      
      if (response.ok) {
        console.log(`  ✅ Created alias: ${alias}`);
      } else {
        const error = await response.text();
        console.warn(`  ⚠️  Failed to create alias ${alias}: ${error}`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Error creating alias ${alias}:`, error.message);
    }
  }
}

/**
 * Test vector operations
 */
async function testVectorOperations() {
  console.log('\n🧪 Testing vector operations...');
  
  // Create test vector
  const testVector = new Array(VECTOR_DIM).fill(0).map(() => Math.random());
  
  // Insert test point
  const testPoint = {
    id: 'test-vector-1',
    vector: testVector,
    payload: {
      doc_id: 'test-doc',
      title: 'Test Document',
      content: 'This is a test vector for validation',
      labels: ['test', 'validation'],
      metadata: {
        source: 'test',
        tokenCount: 10
      }
    }
  };
  
  try {
    // Upsert point
    console.log('  📤 Inserting test vector...');
    const upsertResponse = await fetch(
      `${BASE_URL}/collections/${COLLECTION_NAME}/points?wait=true`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          points: [testPoint]
        })
      }
    );
    
    if (!upsertResponse.ok) {
      const error = await upsertResponse.text();
      throw new Error(`Failed to insert test vector: ${error}`);
    }
    
    console.log('  ✅ Test vector inserted');
    
    // Search for similar vectors
    console.log('  🔍 Searching for similar vectors...');
    const searchResponse = await fetch(
      `${BASE_URL}/collections/${COLLECTION_NAME}/points/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vector: testVector,
          limit: 1,
          with_payload: true
        })
      }
    );
    
    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      throw new Error(`Search failed: ${error}`);
    }
    
    const searchResult = await searchResponse.json();
    if (searchResult.result && searchResult.result.length > 0) {
      const match = searchResult.result[0];
      console.log('  ✅ Search successful');
      console.log(`    ID: ${match.id}`);
      console.log(`    Score: ${match.score}`);
      console.log(`    Title: ${match.payload?.title}`);
    }
    
    // Delete test point
    console.log('  🗑️  Cleaning up test vector...');
    const deleteResponse = await fetch(
      `${BASE_URL}/collections/${COLLECTION_NAME}/points/delete?wait=true`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          points: ['test-vector-1']
        })
      }
    );
    
    if (deleteResponse.ok) {
      console.log('  ✅ Test vector deleted');
    }
    
  } catch (error) {
    console.error('  ❌ Test failed:', error.message);
  }
}

/**
 * Configure collection optimizer
 */
async function configureOptimizer() {
  console.log('\n⚙️  Configuring collection optimizer...');
  
  const optimizerConfig = {
    max_optimization_threads: 2,
    deleted_threshold: 0.2,
    vacuum_min_vector_number: 1000
  };
  
  try {
    const response = await fetch(
      `${BASE_URL}/collections/${COLLECTION_NAME}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          optimizers_config: optimizerConfig
        })
      }
    );
    
    if (response.ok) {
      console.log('  ✅ Optimizer configured');
    } else {
      const error = await response.text();
      console.warn('  ⚠️  Failed to configure optimizer:', error);
    }
  } catch (error) {
    console.warn('  ⚠️  Error configuring optimizer:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Qdrant Collection Setup for Graph RAG 10T POC');
  console.log('================================================');
  console.log('  URL:', BASE_URL);
  console.log('  Collection:', COLLECTION_NAME);
  console.log('  Vector Dimension:', VECTOR_DIM);
  console.log('  Distance Metric:', DISTANCE);
  console.log('================================================\n');
  
  // Wait for Qdrant to be ready
  let retries = 30;
  while (retries > 0) {
    try {
      const response = await fetch(`${BASE_URL}/collections`);
      
      if (response.ok) {
        console.log('✅ Qdrant is ready');
        break;
      }
    } catch (error) {
      console.log(`⏳ Waiting for Qdrant... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      retries--;
    }
  }
  
  if (retries === 0) {
    console.error('❌ Qdrant is not responding');
    process.exit(1);
  }
  
  try {
    // Create collection
    await createCollection();
    
    // Create aliases
    await createAliases();
    
    // Configure optimizer
    await configureOptimizer();
    
    // Test operations
    await testVectorOperations();
    
    console.log('\n✅ Qdrant setup complete!');
    console.log('📝 Next step: Run qdrant-index-vectors.js to index vectors');
    
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

export { createCollection, createPayloadIndices, getCollectionInfo };