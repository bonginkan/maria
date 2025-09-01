#!/usr/bin/env node
/**
 * OpenSearch Document Indexing Script for Graph RAG 10T POC
 * Indexes chunks from NDJSON files into OpenSearch
 * Supports bulk indexing with progress tracking
 */

import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';

const BASE_URL = process.env.POC_OPENSEARCH_URL || 'http://localhost:9200';
const INDEX_NAME = process.env.POC_OPENSEARCH_INDEX || 'maria_chunks';
const USERNAME = process.env.POC_OPENSEARCH_USERNAME || 'admin';
const PASSWORD = process.env.POC_OPENSEARCH_PASSWORD || 'admin';
const BATCH_SIZE = parseInt(process.env.POC_OPENSEARCH_BATCH_SIZE || '100');
const INPUT_FILE = process.env.POC_INPUT_FILE || 'scripts/sample-chunks.ndjson';

class OpenSearchIndexer {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || BASE_URL;
    this.indexName = config.indexName || INDEX_NAME;
    this.username = config.username || USERNAME;
    this.password = config.password || PASSWORD;
    this.batchSize = config.batchSize || BATCH_SIZE;
    
    this.stats = {
      totalDocuments: 0,
      indexedDocuments: 0,
      failedDocuments: 0,
      totalBytes: 0,
      startTime: Date.now()
    };
  }

  /**
   * Get authorization header
   */
  getAuthHeader() {
    return 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');
  }

  /**
   * Index documents using bulk API
   */
  async indexBulk(documents) {
    const bulkBody = [];
    
    for (const doc of documents) {
      // Add bulk action
      bulkBody.push(JSON.stringify({
        index: {
          _index: this.indexName,
          _id: doc.chunk_id
        }
      }));
      
      // Add document with indexed_at timestamp
      bulkBody.push(JSON.stringify({
        ...doc,
        indexed_at: new Date().toISOString()
      }));
    }
    
    const bulkData = bulkBody.join('\n') + '\n';
    this.stats.totalBytes += Buffer.byteLength(bulkData);
    
    try {
      const response = await fetch(`${this.baseUrl}/_bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Authorization': this.getAuthHeader()
        },
        body: bulkData
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bulk indexing failed: ${error}`);
      }
      
      const result = await response.json();
      
      // Process bulk response
      let successCount = 0;
      let failureCount = 0;
      
      for (const item of result.items || []) {
        if (item.index) {
          if (item.index.status >= 200 && item.index.status < 300) {
            successCount++;
          } else {
            failureCount++;
            console.error(`  ❌ Failed to index ${item.index._id}: ${item.index.error?.reason}`);
          }
        }
      }
      
      this.stats.indexedDocuments += successCount;
      this.stats.failedDocuments += failureCount;
      
      return {
        success: successCount,
        failed: failureCount,
        took: result.took
      };
      
    } catch (error) {
      console.error('❌ Bulk indexing error:', error.message);
      this.stats.failedDocuments += documents.length;
      throw error;
    }
  }

  /**
   * Index documents from NDJSON file
   */
  async indexFromFile(filePath) {
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
        const doc = JSON.parse(line);
        
        // Validate document structure
        if (!doc.chunk_id || !doc.content) {
          console.warn(`⚠️  Line ${lineNumber}: Missing required fields, skipping`);
          continue;
        }
        
        // Process embedding if it's an array (convert to base64)
        if (Array.isArray(doc.embedding)) {
          doc.embedding = Buffer.from(new Float32Array(doc.embedding).buffer).toString('base64');
        }
        
        batch.push(doc);
        this.stats.totalDocuments++;
        
        // Index batch when it reaches the batch size
        if (batch.length >= this.batchSize) {
          await this.processBatch(batch);
          batch = [];
        }
        
      } catch (error) {
        console.error(`❌ Line ${lineNumber}: Invalid JSON - ${error.message}`);
        this.stats.failedDocuments++;
      }
    }
    
    // Index remaining documents
    if (batch.length > 0) {
      await this.processBatch(batch);
    }
  }

  /**
   * Process a batch of documents
   */
  async processBatch(batch) {
    console.log(`📤 Indexing batch of ${batch.length} documents...`);
    
    try {
      const result = await this.indexBulk(batch);
      console.log(`  ✅ Indexed: ${result.success}, Failed: ${result.failed}, Took: ${result.took}ms`);
      
      // Show progress
      this.showProgress();
      
    } catch (error) {
      console.error(`  ❌ Batch failed:`, error.message);
    }
  }

  /**
   * Index documents from array
   */
  async indexDocuments(documents) {
    console.log(`📊 Indexing ${documents.length} documents`);
    
    const batches = [];
    for (let i = 0; i < documents.length; i += this.batchSize) {
      batches.push(documents.slice(i, i + this.batchSize));
    }
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`\n📦 Processing batch ${i + 1}/${batches.length}`);
      await this.processBatch(batches[i]);
    }
  }

  /**
   * Update document in index
   */
  async updateDocument(chunkId, updates) {
    try {
      const response = await fetch(`${this.baseUrl}/${this.indexName}/_update/${chunkId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader()
        },
        body: JSON.stringify({
          doc: updates
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Update failed: ${error}`);
      }
      
      return await response.json();
      
    } catch (error) {
      console.error(`❌ Failed to update ${chunkId}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete document from index
   */
  async deleteDocument(chunkId) {
    try {
      const response = await fetch(`${this.baseUrl}/${this.indexName}/_doc/${chunkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': this.getAuthHeader()
        }
      });
      
      if (!response.ok && response.status !== 404) {
        const error = await response.text();
        throw new Error(`Delete failed: ${error}`);
      }
      
      return response.status !== 404;
      
    } catch (error) {
      console.error(`❌ Failed to delete ${chunkId}:`, error.message);
      throw error;
    }
  }

  /**
   * Refresh index to make documents searchable
   */
  async refreshIndex() {
    console.log('\n🔄 Refreshing index...');
    
    try {
      const response = await fetch(`${this.baseUrl}/${this.indexName}/_refresh`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader()
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Refresh failed: ${error}`);
      }
      
      console.log('✅ Index refreshed');
      return await response.json();
      
    } catch (error) {
      console.error('❌ Refresh failed:', error.message);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats() {
    try {
      const response = await fetch(`${this.baseUrl}/${this.indexName}/_stats`, {
        headers: {
          'Authorization': this.getAuthHeader()
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Stats failed: ${error}`);
      }
      
      const stats = await response.json();
      return {
        documentCount: stats._all?.primaries?.docs?.count || 0,
        sizeInBytes: stats._all?.primaries?.store?.size_in_bytes || 0,
        indexing: stats._all?.primaries?.indexing || {}
      };
      
    } catch (error) {
      console.error('❌ Failed to get stats:', error.message);
      return null;
    }
  }

  /**
   * Show progress
   */
  showProgress() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rate = Math.round(this.stats.indexedDocuments / elapsed);
    const progress = this.stats.totalDocuments > 0 
      ? Math.round((this.stats.indexedDocuments / this.stats.totalDocuments) * 100)
      : 0;
    
    console.log(`  📊 Progress: ${progress}% | Rate: ${rate} docs/sec | Total: ${this.stats.indexedDocuments}/${this.stats.totalDocuments}`);
  }

  /**
   * Get final statistics
   */
  getFinalStats() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    
    return {
      ...this.stats,
      elapsedTime: elapsed,
      averageRate: Math.round(this.stats.indexedDocuments / elapsed),
      successRate: this.stats.totalDocuments > 0 
        ? ((this.stats.indexedDocuments / this.stats.totalDocuments) * 100).toFixed(1) + '%'
        : '0%',
      totalSizeMB: (this.stats.totalBytes / 1024 / 1024).toFixed(2)
    };
  }
}

/**
 * Test search functionality
 */
async function testSearch(query = 'AI') {
  console.log(`\n🔍 Testing search with query: "${query}"`);
  
  const searchBody = {
    query: {
      multi_match: {
        query: query,
        fields: [
          'title^2',
          'title.japanese^2',
          'title.english^2',
          'content',
          'content.japanese',
          'content.english'
        ],
        type: 'best_fields',
        operator: 'or',
        fuzziness: 'AUTO'
      }
    },
    highlight: {
      fields: {
        content: {},
        title: {}
      }
    },
    size: 5
  };
  
  try {
    const response = await fetch(`${BASE_URL}/${INDEX_NAME}/_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
      },
      body: JSON.stringify(searchBody)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Search failed: ${error}`);
    }
    
    const result = await response.json();
    
    console.log(`  Found ${result.hits.total.value} results (showing top ${Math.min(5, result.hits.total.value)}):\n`);
    
    for (const hit of result.hits.hits) {
      console.log(`  📄 ${hit._source.title || 'Untitled'}`);
      console.log(`     ID: ${hit._id}`);
      console.log(`     Score: ${hit._score.toFixed(3)}`);
      
      if (hit.highlight?.content) {
        console.log(`     Highlight: ${hit.highlight.content[0].substring(0, 150)}...`);
      } else {
        console.log(`     Content: ${hit._source.content.substring(0, 150)}...`);
      }
      console.log();
    }
    
  } catch (error) {
    console.error('❌ Search test failed:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 OpenSearch Document Indexing for Graph RAG 10T POC');
  console.log('=====================================================');
  console.log('  URL:', BASE_URL);
  console.log('  Index:', INDEX_NAME);
  console.log('  Batch Size:', BATCH_SIZE);
  console.log('  Input File:', INPUT_FILE);
  console.log('=====================================================\n');
  
  const indexer = new OpenSearchIndexer();
  
  try {
    // Check if file exists
    const filePath = path.isAbsolute(INPUT_FILE) ? INPUT_FILE : path.join(process.cwd(), INPUT_FILE);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Input file not found: ${filePath}`);
    }
    
    // Index documents
    await indexer.indexFromFile(filePath);
    
    // Refresh index
    await indexer.refreshIndex();
    
    // Get index statistics
    const indexStats = await indexer.getIndexStats();
    if (indexStats) {
      console.log('\n📊 Index Statistics:');
      console.log(`  Documents: ${indexStats.documentCount}`);
      console.log(`  Size: ${(indexStats.sizeInBytes / 1024 / 1024).toFixed(2)} MB`);
    }
    
    // Show final statistics
    const finalStats = indexer.getFinalStats();
    console.log('\n✅ Indexing Complete!');
    console.log('📈 Final Statistics:');
    console.log(`  Total Documents: ${finalStats.totalDocuments}`);
    console.log(`  Indexed: ${finalStats.indexedDocuments}`);
    console.log(`  Failed: ${finalStats.failedDocuments}`);
    console.log(`  Success Rate: ${finalStats.successRate}`);
    console.log(`  Total Size: ${finalStats.totalSizeMB} MB`);
    console.log(`  Elapsed Time: ${finalStats.elapsedTime.toFixed(1)}s`);
    console.log(`  Average Rate: ${finalStats.averageRate} docs/sec`);
    
    // Test search
    await testSearch('AI');
    await testSearch('売上');
    
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

export default OpenSearchIndexer;