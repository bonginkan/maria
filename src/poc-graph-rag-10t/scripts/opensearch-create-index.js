#!/usr/bin/env node
/**
 * OpenSearch Index Creation Script for Graph RAG 10T POC
 * Creates optimized index for BM25 full-text search
 * Supports Japanese and English text analysis
 */

const BASE_URL = process.env.POC_OPENSEARCH_URL || 'http://localhost:9200';
const INDEX_NAME = process.env.POC_OPENSEARCH_INDEX || 'maria_chunks';
const USERNAME = process.env.POC_OPENSEARCH_USERNAME || 'admin';
const PASSWORD = process.env.POC_OPENSEARCH_PASSWORD || 'admin';

/**
 * Create OpenSearch index with optimized settings
 */
async function createIndex() {
  console.log('🔨 Creating OpenSearch index:', INDEX_NAME);
  
  // Index configuration
  const indexConfig = {
    settings: {
      index: {
        number_of_shards: parseInt(process.env.POC_OPENSEARCH_SHARDS || '2'),
        number_of_replicas: parseInt(process.env.POC_OPENSEARCH_REPLICAS || '1'),
        refresh_interval: process.env.POC_OPENSEARCH_REFRESH_INTERVAL || '1s',
        max_result_window: 50000,
        
        // Analysis settings
        analysis: {
          tokenizer: {
            // Japanese tokenizer (Kuromoji)
            kuromoji_tokenizer: {
              type: 'kuromoji_tokenizer',
              mode: 'search'
            },
            // N-gram tokenizer for partial matching
            ngram_tokenizer: {
              type: 'ngram',
              min_gram: 2,
              max_gram: 3,
              token_chars: ['letter', 'digit']
            }
          },
          
          analyzer: {
            // Japanese analyzer
            japanese_analyzer: {
              type: 'custom',
              tokenizer: 'kuromoji_tokenizer',
              filter: [
                'kuromoji_baseform',
                'kuromoji_part_of_speech',
                'cjk_width',
                'ja_stop',
                'lowercase',
                'kuromoji_stemmer'
              ]
            },
            
            // English analyzer
            english_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: [
                'lowercase',
                'english_stop',
                'english_stemmer',
                'asciifolding'
              ]
            },
            
            // Hybrid analyzer for mixed content
            hybrid_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: [
                'lowercase',
                'cjk_width',
                'asciifolding'
              ]
            },
            
            // Edge n-gram for autocomplete
            edge_ngram_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: [
                'lowercase',
                'edge_ngram_filter'
              ]
            },
            
            // Keyword analyzer for exact matching
            keyword_lowercase: {
              type: 'custom',
              tokenizer: 'keyword',
              filter: ['lowercase']
            }
          },
          
          filter: {
            // English stemmer
            english_stop: {
              type: 'stop',
              stopwords: '_english_'
            },
            english_stemmer: {
              type: 'stemmer',
              language: 'english'
            },
            
            // Japanese stop words
            ja_stop: {
              type: 'ja_stop',
              stopwords: ['_japanese_']
            },
            
            // Edge n-gram filter
            edge_ngram_filter: {
              type: 'edge_ngram',
              min_gram: 1,
              max_gram: 20
            }
          }
        },
        
        // Similarity settings for BM25
        similarity: {
          default: {
            type: 'BM25',
            b: 0.75,
            k1: 1.2
          }
        }
      }
    },
    
    mappings: {
      dynamic: 'false',
      properties: {
        // Document identification
        chunk_id: {
          type: 'keyword',
          ignore_above: 256
        },
        doc_id: {
          type: 'keyword',
          ignore_above: 256
        },
        sequence: {
          type: 'integer'
        },
        
        // Content fields with multi-language support
        title: {
          type: 'text',
          analyzer: 'hybrid_analyzer',
          fields: {
            japanese: {
              type: 'text',
              analyzer: 'japanese_analyzer'
            },
            english: {
              type: 'text',
              analyzer: 'english_analyzer'
            },
            keyword: {
              type: 'keyword',
              ignore_above: 256
            },
            suggest: {
              type: 'text',
              analyzer: 'edge_ngram_analyzer',
              search_analyzer: 'standard'
            }
          }
        },
        
        content: {
          type: 'text',
          analyzer: 'hybrid_analyzer',
          fields: {
            japanese: {
              type: 'text',
              analyzer: 'japanese_analyzer'
            },
            english: {
              type: 'text',
              analyzer: 'english_analyzer'
            },
            ngram: {
              type: 'text',
              analyzer: 'ngram_tokenizer'
            }
          }
        },
        
        // Metadata fields
        path: {
          type: 'keyword',
          ignore_above: 512
        },
        
        labels: {
          type: 'keyword',
          ignore_above: 64
        },
        
        // ACL fields for security filtering
        'acl.users': {
          type: 'keyword',
          ignore_above: 128
        },
        'acl.groups': {
          type: 'keyword',
          ignore_above: 128
        },
        
        // Metadata object
        metadata: {
          type: 'object',
          enabled: false
        },
        
        // Embedding vector (stored but not indexed here)
        embedding: {
          type: 'binary',
          doc_values: false
        },
        
        // Content hash for deduplication
        hash: {
          type: 'keyword',
          ignore_above: 64
        },
        
        // Timestamps
        indexed_at: {
          type: 'date',
          format: 'strict_date_optional_time||epoch_millis'
        },
        
        // Scoring boost field
        boost: {
          type: 'float'
        }
      }
    }
  };
  
  try {
    // Check if index exists
    const checkResponse = await fetch(`${BASE_URL}/${INDEX_NAME}`, {
      method: 'HEAD',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
      }
    });
    
    if (checkResponse.ok) {
      console.log('⚠️  Index already exists, deleting...');
      
      // Delete existing index
      const deleteResponse = await fetch(`${BASE_URL}/${INDEX_NAME}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
        }
      });
      
      if (!deleteResponse.ok) {
        const error = await deleteResponse.text();
        console.error('❌ Failed to delete index:', error);
      } else {
        console.log('✅ Existing index deleted');
      }
    }
    
    // Create new index
    const createResponse = await fetch(`${BASE_URL}/${INDEX_NAME}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
      },
      body: JSON.stringify(indexConfig)
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create index: ${error}`);
    }
    
    const result = await createResponse.json();
    console.log('✅ Index created successfully:', result);
    
    // Set up index aliases for easy management
    const aliasResponse = await fetch(`${BASE_URL}/_aliases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
      },
      body: JSON.stringify({
        actions: [
          {
            add: {
              index: INDEX_NAME,
              alias: 'maria_search'
            }
          }
        ]
      })
    });
    
    if (aliasResponse.ok) {
      console.log('✅ Alias "maria_search" created');
    }
    
    // Get index info
    const infoResponse = await fetch(`${BASE_URL}/${INDEX_NAME}/_settings`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
      }
    });
    
    if (infoResponse.ok) {
      const settings = await infoResponse.json();
      console.log('\n📊 Index settings:');
      console.log('  - Shards:', settings[INDEX_NAME].settings.index.number_of_shards);
      console.log('  - Replicas:', settings[INDEX_NAME].settings.index.number_of_replicas);
      console.log('  - Refresh interval:', settings[INDEX_NAME].settings.index.refresh_interval);
    }
    
    // Test analyzers
    await testAnalyzers();
    
  } catch (error) {
    console.error('❌ Error creating index:', error.message);
    process.exit(1);
  }
}

/**
 * Test the configured analyzers
 */
async function testAnalyzers() {
  console.log('\n🧪 Testing analyzers...');
  
  const testCases = [
    {
      analyzer: 'japanese_analyzer',
      text: '人工知能の研究開発を進めています'
    },
    {
      analyzer: 'english_analyzer',
      text: 'Artificial intelligence research and development'
    },
    {
      analyzer: 'hybrid_analyzer',
      text: 'AI開発とMachine Learning'
    }
  ];
  
  for (const testCase of testCases) {
    try {
      const response = await fetch(`${BASE_URL}/${INDEX_NAME}/_analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
        },
        body: JSON.stringify({
          analyzer: testCase.analyzer,
          text: testCase.text
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`\n  ${testCase.analyzer}:`);
        console.log(`    Input: "${testCase.text}"`);
        console.log(`    Tokens: ${result.tokens.map(t => t.token).join(', ')}`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to test ${testCase.analyzer}:`, error.message);
    }
  }
}

/**
 * Create index templates for future indices
 */
async function createIndexTemplate() {
  console.log('\n📋 Creating index template...');
  
  const template = {
    index_patterns: ['maria_chunks_*'],
    priority: 100,
    template: {
      settings: {
        number_of_shards: 2,
        number_of_replicas: 1,
        'index.refresh_interval': '1s'
      }
    }
  };
  
  try {
    const response = await fetch(`${BASE_URL}/_index_template/maria_chunks_template`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
      },
      body: JSON.stringify(template)
    });
    
    if (response.ok) {
      console.log('✅ Index template created');
    } else {
      const error = await response.text();
      console.warn('⚠️  Failed to create template:', error);
    }
  } catch (error) {
    console.warn('⚠️  Template creation error:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 OpenSearch Index Setup for Graph RAG 10T POC');
  console.log('================================================');
  console.log('  URL:', BASE_URL);
  console.log('  Index:', INDEX_NAME);
  console.log('================================================\n');
  
  // Wait for OpenSearch to be ready
  let retries = 30;
  while (retries > 0) {
    try {
      const response = await fetch(`${BASE_URL}/_cluster/health`, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
        }
      });
      
      if (response.ok) {
        const health = await response.json();
        console.log('✅ OpenSearch is ready. Cluster status:', health.status);
        break;
      }
    } catch (error) {
      console.log(`⏳ Waiting for OpenSearch... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      retries--;
    }
  }
  
  if (retries === 0) {
    console.error('❌ OpenSearch is not responding');
    process.exit(1);
  }
  
  // Create index
  await createIndex();
  
  // Create template for future indices
  await createIndexTemplate();
  
  console.log('\n✅ OpenSearch setup complete!');
  console.log('📝 Next step: Run opensearch-index-chunks.js to index documents');
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { createIndex, testAnalyzers };