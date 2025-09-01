#!/usr/bin/env node
/**
 * Document Chunker with SimHash Deduplication for Graph RAG 10T POC
 * Splits documents into optimal chunks for embedding and retrieval
 * Implements SimHash for near-duplicate detection
 */

import { createHash } from 'crypto';

class DocumentChunker {
  constructor(config = {}) {
    this.config = {
      chunkSize: parseInt(config.chunkSize || process.env.POC_CHUNK_SIZE || '1500'),
      chunkOverlap: parseInt(config.chunkOverlap || process.env.POC_CHUNK_OVERLAP || '200'),
      minChunkSize: parseInt(config.minChunkSize || process.env.POC_CHUNK_MIN_SIZE || '100'),
      strategy: config.strategy || process.env.POC_CHUNK_STRATEGY || 'recursive',
      simhashThreshold: parseFloat(config.simhashThreshold || process.env.POC_SIMHASH_THRESHOLD || '0.85'),
      preserveStructure: config.preserveStructure !== false,
      includeMetadata: config.includeMetadata !== false
    };
    
    this.simhashIndex = new Map(); // Store simhashes for deduplication
    this.stats = {
      documentsProcessed: 0,
      chunksCreated: 0,
      duplicatesFound: 0,
      totalTokens: 0
    };
  }

  /**
   * Chunk a document based on its structure and content
   */
  async chunkDocument(document) {
    console.log(`✂️ Chunking document: ${document.originalName || 'Unknown'}`);
    
    const chunks = [];
    const baseMetadata = this.extractBaseMetadata(document);
    
    // Choose chunking strategy based on document type
    let rawChunks;
    
    if (document.structure) {
      switch (document.structure.type) {
        case 'document':
          rawChunks = await this.chunkStructuredDocument(document);
          break;
        case 'presentation':
          rawChunks = await this.chunkPresentation(document);
          break;
        case 'spreadsheet':
          rawChunks = await this.chunkSpreadsheet(document);
          break;
        case 'table':
          rawChunks = await this.chunkTable(document);
          break;
        default:
          rawChunks = await this.chunkPlainText(document.content);
      }
    } else {
      rawChunks = await this.chunkPlainText(document.content || '');
    }
    
    // Process each raw chunk
    for (let i = 0; i < rawChunks.length; i++) {
      const chunk = rawChunks[i];
      const chunkId = this.generateChunkId(document, i);
      
      // Calculate SimHash
      const simhash = this.calculateSimHash(chunk.text);
      
      // Check for near-duplicates
      const isDuplicate = this.checkDuplicate(simhash, chunk.text);
      
      if (isDuplicate) {
        this.stats.duplicatesFound++;
        console.log(`🔄 Duplicate chunk detected, skipping`);
        continue;
      }
      
      // Store SimHash
      this.simhashIndex.set(simhash, {
        chunkId,
        length: chunk.text.length,
        hash: this.generateHash(chunk.text)
      });
      
      // Create final chunk object
      const finalChunk = {
        chunk_id: chunkId,
        doc_id: document.id || document.originalName,
        sequence: i,
        title: document.metadata?.title || document.originalName,
        path: document.path || document.metadata?.sourceUrl || '',
        labels: this.extractLabels(document),
        acl: document.acl || { users: [], groups: [] },
        content: chunk.text,
        metadata: {
          ...baseMetadata,
          ...chunk.metadata,
          chunkIndex: i,
          totalChunks: rawChunks.length,
          tokenCount: this.estimateTokens(chunk.text),
          simhash: simhash.toString(16),
          strategy: this.config.strategy
        },
        embedding: null, // To be filled by embedding service
        hash: this.generateHash(chunk.text)
      };
      
      chunks.push(finalChunk);
      this.stats.chunksCreated++;
      this.stats.totalTokens += finalChunk.metadata.tokenCount;
    }
    
    this.stats.documentsProcessed++;
    
    console.log(`✅ Created ${chunks.length} chunks (${this.stats.duplicatesFound} duplicates removed)`);
    
    return chunks;
  }

  /**
   * Chunk structured document (PDF, DOCX)
   */
  async chunkStructuredDocument(document) {
    const chunks = [];
    const sections = document.structure.sections || [];
    
    if (this.config.preserveStructure) {
      // Preserve document structure
      for (const section of sections) {
        if (section.type === 'page') {
          // For pages, use sliding window
          const pageChunks = await this.chunkPlainText(section.content || section.text);
          pageChunks.forEach(chunk => {
            chunk.metadata = {
              ...chunk.metadata,
              pageNumber: section.number,
              sectionType: 'page'
            };
          });
          chunks.push(...pageChunks);
        } else if (section.type === 'heading' || section.type === 'paragraph') {
          // Keep headings with following content
          const text = section.text || section.content || '';
          if (text.length > this.config.minChunkSize) {
            chunks.push({
              text,
              metadata: {
                sectionType: section.type,
                headingLevel: section.level
              }
            });
          }
        }
      }
    } else {
      // Simple text chunking
      const fullText = document.content || sections.map(s => s.text || s.content || '').join('\n');
      return this.chunkPlainText(fullText);
    }
    
    return chunks;
  }

  /**
   * Chunk presentation (PPTX)
   */
  async chunkPresentation(document) {
    const chunks = [];
    const slides = document.slides || document.structure.slides || [];
    
    for (const slide of slides) {
      const slideText = [
        slide.title ? `Title: ${slide.title}` : '',
        slide.content || '',
        slide.notes ? `Notes: ${slide.notes}` : ''
      ].filter(Boolean).join('\n');
      
      if (slideText.length > this.config.minChunkSize) {
        chunks.push({
          text: slideText,
          metadata: {
            slideNumber: slide.number || slide.slideNumber,
            hasNotes: !!slide.notes,
            sectionType: 'slide'
          }
        });
      }
    }
    
    return chunks;
  }

  /**
   * Chunk spreadsheet (XLSX)
   */
  async chunkSpreadsheet(document) {
    const chunks = [];
    const sheets = document.sheets || document.structure.sheets || [];
    
    for (const sheet of sheets) {
      if (sheet.rows && sheet.rows.length > 0) {
        // Chunk by rows
        const rowBatches = this.batchRows(sheet.rows, 50); // 50 rows per chunk
        
        for (let i = 0; i < rowBatches.length; i++) {
          const batch = rowBatches[i];
          const text = batch.map(row => row.join('\t')).join('\n');
          
          if (text.length > this.config.minChunkSize) {
            chunks.push({
              text,
              metadata: {
                sheetName: sheet.name,
                rowRange: `${i * 50 + 1}-${Math.min((i + 1) * 50, sheet.rows.length)}`,
                columnCount: sheet.columnCount || batch[0]?.length,
                sectionType: 'table'
              }
            });
          }
        }
      } else if (sheet.data) {
        // Alternative format
        const text = JSON.stringify(sheet.data, null, 2);
        chunks.push({
          text,
          metadata: {
            sheetName: sheet.name,
            sectionType: 'data'
          }
        });
      }
    }
    
    return chunks;
  }

  /**
   * Chunk table data
   */
  async chunkTable(document) {
    const chunks = [];
    const rows = document.structure.rows || [];
    
    if (rows.length > 0) {
      const rowBatches = this.batchRows(rows, 30);
      
      for (let i = 0; i < rowBatches.length; i++) {
        const batch = rowBatches[i];
        const headers = document.structure.headers || batch[0] || [];
        const text = [
          headers.join('\t'),
          ...batch.slice(headers === batch[0] ? 1 : 0).map(row => row.join('\t'))
        ].join('\n');
        
        chunks.push({
          text,
          metadata: {
            rowRange: `${i * 30 + 1}-${Math.min((i + 1) * 30, rows.length)}`,
            columnCount: headers.length,
            sectionType: 'table'
          }
        });
      }
    }
    
    return chunks;
  }

  /**
   * Chunk plain text using sliding window
   */
  async chunkPlainText(text) {
    const chunks = [];
    
    if (!text || text.length === 0) {
      return chunks;
    }
    
    // Normalize text
    const normalizedText = this.normalizeText(text);
    
    // Split into sentences
    const sentences = this.splitIntoSentences(normalizedText);
    
    if (this.config.strategy === 'recursive') {
      return this.recursiveChunk(sentences);
    } else if (this.config.strategy === 'semantic') {
      return this.semanticChunk(sentences);
    } else {
      // Default: fixed size sliding window
      return this.slidingWindowChunk(sentences);
    }
  }

  /**
   * Sliding window chunking
   */
  slidingWindowChunk(sentences) {
    const chunks = [];
    let currentChunk = [];
    let currentTokens = 0;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokens = this.estimateTokens(sentence);
      
      if (currentTokens + sentenceTokens > this.config.chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          text: currentChunk.join(' '),
          metadata: {
            startSentence: i - currentChunk.length,
            endSentence: i - 1
          }
        });
        
        // Start new chunk with overlap
        const overlapSentences = this.calculateOverlapSentences(currentChunk);
        currentChunk = overlapSentences;
        currentTokens = overlapSentences.reduce((sum, s) => sum + this.estimateTokens(s), 0);
      }
      
      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
    }
    
    // Add final chunk
    if (currentChunk.length > 0 && currentTokens >= this.config.minChunkSize) {
      chunks.push({
        text: currentChunk.join(' '),
        metadata: {
          startSentence: sentences.length - currentChunk.length,
          endSentence: sentences.length - 1
        }
      });
    }
    
    return chunks;
  }

  /**
   * Recursive chunking (split at natural boundaries)
   */
  recursiveChunk(sentences) {
    const chunks = [];
    const separators = ['\n\n', '\n', '. ', ', ', ' '];
    
    const recursiveSplit = (text, depth = 0) => {
      if (depth >= separators.length) {
        return [text];
      }
      
      const separator = separators[depth];
      const parts = text.split(separator);
      const result = [];
      let currentPart = '';
      
      for (const part of parts) {
        const combined = currentPart ? currentPart + separator + part : part;
        const tokens = this.estimateTokens(combined);
        
        if (tokens <= this.config.chunkSize) {
          currentPart = combined;
        } else {
          if (currentPart) {
            result.push(currentPart);
          }
          
          if (tokens > this.config.chunkSize) {
            // Recursively split larger parts
            result.push(...recursiveSplit(part, depth + 1));
          } else {
            currentPart = part;
          }
        }
      }
      
      if (currentPart) {
        result.push(currentPart);
      }
      
      return result;
    };
    
    const fullText = sentences.join(' ');
    const textChunks = recursiveSplit(fullText);
    
    return textChunks.map((text, i) => ({
      text,
      metadata: {
        chunkMethod: 'recursive',
        depth: 0
      }
    }));
  }

  /**
   * Semantic chunking (group by meaning)
   */
  semanticChunk(sentences) {
    // For POC, use paragraph-based semantic chunking
    // In production, use sentence embeddings for better semantic grouping
    const chunks = [];
    let currentChunk = [];
    let currentTokens = 0;
    let lastTopicWords = new Set();
    
    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);
      const topicWords = this.extractTopicWords(sentence);
      
      // Check topic similarity
      const similarity = this.calculateTopicSimilarity(lastTopicWords, topicWords);
      
      if (similarity < 0.3 && currentChunk.length > 0 && currentTokens >= this.config.minChunkSize) {
        // Topic change detected, save chunk
        chunks.push({
          text: currentChunk.join(' '),
          metadata: {
            topicWords: Array.from(lastTopicWords).slice(0, 5),
            chunkMethod: 'semantic'
          }
        });
        
        currentChunk = [];
        currentTokens = 0;
      }
      
      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
      lastTopicWords = topicWords;
      
      // Check size limit
      if (currentTokens >= this.config.chunkSize) {
        chunks.push({
          text: currentChunk.join(' '),
          metadata: {
            topicWords: Array.from(lastTopicWords).slice(0, 5),
            chunkMethod: 'semantic'
          }
        });
        
        currentChunk = [];
        currentTokens = 0;
      }
    }
    
    // Add final chunk
    if (currentChunk.length > 0 && currentTokens >= this.config.minChunkSize) {
      chunks.push({
        text: currentChunk.join(' '),
        metadata: {
          topicWords: Array.from(lastTopicWords).slice(0, 5),
          chunkMethod: 'semantic'
        }
      });
    }
    
    return chunks;
  }

  /**
   * Calculate SimHash for deduplication
   */
  calculateSimHash(text) {
    // Simple SimHash implementation
    const features = this.extractFeatures(text);
    const hashBits = 64;
    const v = new Array(hashBits).fill(0);
    
    for (const feature of features) {
      const hash = this.hashFeature(feature);
      for (let i = 0; i < hashBits; i++) {
        const bit = (hash >> i) & 1;
        v[i] += bit ? 1 : -1;
      }
    }
    
    let simhash = 0n;
    for (let i = 0; i < hashBits; i++) {
      if (v[i] > 0) {
        simhash |= (1n << BigInt(i));
      }
    }
    
    return simhash;
  }

  /**
   * Extract features for SimHash
   */
  extractFeatures(text) {
    const words = text.toLowerCase().split(/\s+/);
    const features = [];
    
    // Word shingles (n-grams)
    for (let i = 0; i < words.length - 2; i++) {
      features.push(words.slice(i, i + 3).join(' '));
    }
    
    return features;
  }

  /**
   * Hash a feature
   */
  hashFeature(feature) {
    const hash = createHash('sha256').update(feature).digest();
    return parseInt(hash.toString('hex').substring(0, 16), 16);
  }

  /**
   * Check if chunk is duplicate using SimHash
   */
  checkDuplicate(simhash, text) {
    const threshold = this.config.simhashThreshold;
    
    for (const [storedHash, info] of this.simhashIndex.entries()) {
      const similarity = this.calculateSimHashSimilarity(simhash, storedHash);
      
      if (similarity >= threshold) {
        // Additional check: if texts are very similar in length
        const lengthRatio = Math.min(text.length, info.length) / Math.max(text.length, info.length);
        
        if (lengthRatio > 0.8) {
          return true; // Found duplicate
        }
      }
    }
    
    return false;
  }

  /**
   * Calculate similarity between two SimHashes
   */
  calculateSimHashSimilarity(hash1, hash2) {
    const xor = hash1 ^ hash2;
    const differentBits = this.countBits(xor);
    return 1 - (differentBits / 64);
  }

  /**
   * Count set bits in number
   */
  countBits(n) {
    let count = 0;
    let num = n;
    
    while (num) {
      count++;
      num &= num - 1n;
    }
    
    return count;
  }

  /**
   * Split text into sentences
   */
  splitIntoSentences(text) {
    // Simple sentence splitting
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Calculate overlap sentences
   */
  calculateOverlapSentences(sentences) {
    const overlapTokens = this.config.chunkOverlap;
    const overlap = [];
    let tokens = 0;
    
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentenceTokens = this.estimateTokens(sentences[i]);
      
      if (tokens + sentenceTokens <= overlapTokens) {
        overlap.unshift(sentences[i]);
        tokens += sentenceTokens;
      } else {
        break;
      }
    }
    
    return overlap;
  }

  /**
   * Extract topic words from text
   */
  extractTopicWords(text) {
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were']);
    
    const topicWords = new Set();
    
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word)) {
        topicWords.add(word);
      }
    }
    
    return topicWords;
  }

  /**
   * Calculate topic similarity
   */
  calculateTopicSimilarity(set1, set2) {
    if (set1.size === 0 || set2.size === 0) return 0;
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Normalize text
   */
  normalizeText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Estimate token count
   */
  estimateTokens(text) {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate chunk ID
   */
  generateChunkId(document, index) {
    const docId = document.id || document.originalName || 'unknown';
    const hash = this.generateHash(`${docId}:${index}`);
    
    return `${docId}:chunk:${index}:${hash.substring(0, 8)}`;
  }

  /**
   * Generate content hash
   */
  generateHash(content) {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Extract base metadata
   */
  extractBaseMetadata(document) {
    return {
      source: document.source || 'unknown',
      fileType: document.fileType || 'unknown',
      originalSize: document.originalSize || 0,
      createdAt: document.metadata?.creationDate || new Date().toISOString(),
      modifiedAt: document.metadata?.modificationDate || new Date().toISOString(),
      author: document.metadata?.author || 'Unknown'
    };
  }

  /**
   * Extract labels from document
   */
  extractLabels(document) {
    const labels = [];
    
    if (document.metadata?.tags) {
      labels.push(...document.metadata.tags);
    }
    
    if (document.fileType) {
      labels.push(document.fileType);
    }
    
    if (document.source) {
      labels.push(document.source);
    }
    
    return labels;
  }

  /**
   * Batch rows for chunking
   */
  batchRows(rows, batchSize) {
    const batches = [];
    
    for (let i = 0; i < rows.length; i += batchSize) {
      batches.push(rows.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Get chunker statistics
   */
  getStats() {
    return {
      ...this.stats,
      averageChunkSize: this.stats.chunksCreated > 0 
        ? Math.round(this.stats.totalTokens / this.stats.chunksCreated)
        : 0,
      deduplicationRate: this.stats.chunksCreated > 0
        ? ((this.stats.duplicatesFound / (this.stats.chunksCreated + this.stats.duplicatesFound)) * 100).toFixed(1) + '%'
        : '0%',
      simhashIndexSize: this.simhashIndex.size
    };
  }

  /**
   * Clear SimHash index
   */
  clearIndex() {
    this.simhashIndex.clear();
    console.log('🗑️ SimHash index cleared');
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const chunker = new DocumentChunker({
    chunkSize: 1500,
    chunkOverlap: 200,
    strategy: 'recursive'
  });
  
  // Test with sample document
  const testDocument = {
    id: 'test-doc-1',
    originalName: 'test.pdf',
    content: `This is the first paragraph of the test document. It contains important information about the subject matter.
    
    This is the second paragraph with different content. It discusses various aspects of the topic in detail.
    
    The third paragraph continues the discussion. It provides additional context and examples.
    
    This is a duplicate paragraph. It contains important information about the subject matter.
    
    The final paragraph concludes the document with a summary of key points.`,
    metadata: {
      title: 'Test Document',
      author: 'Test Author'
    },
    structure: {
      type: 'document',
      format: 'pdf'
    }
  };
  
  chunker.chunkDocument(testDocument)
    .then(chunks => {
      console.log(`\n✅ Created ${chunks.length} chunks`);
      chunks.forEach((chunk, i) => {
        console.log(`\nChunk ${i + 1}:`);
        console.log(`  ID: ${chunk.chunk_id}`);
        console.log(`  Tokens: ${chunk.metadata.tokenCount}`);
        console.log(`  Content: ${chunk.content.substring(0, 100)}...`);
      });
      console.log('\n📊 Chunker stats:', chunker.getStats());
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Chunking error:', error);
      process.exit(1);
    });
}

export default DocumentChunker;