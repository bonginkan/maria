#!/usr/bin/env node
/**
 * Universal Document Parser for Graph RAG 10T POC
 * Handles PDF, DOCX, PPTX, XLSX, and text formats
 * Includes OCR capabilities for scanned documents
 */

import { createHash } from 'crypto';

class DocumentParser {
  constructor(config = {}) {
    this.config = {
      enableOCR: config.enableOCR !== false && (process.env.POC_ENABLE_OCR === 'true'),
      ocrLanguages: config.ocrLanguages || ['eng', 'jpn'],
      maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
      extractTables: config.extractTables !== false,
      extractImages: config.extractImages !== false,
      extractMetadata: config.extractMetadata !== false
    };
    
    this.stats = {
      filesProcessed: 0,
      bytesProcessed: 0,
      errors: [],
      supportedFormats: {
        pdf: 0,
        docx: 0,
        pptx: 0,
        xlsx: 0,
        txt: 0,
        other: 0
      }
    };
  }

  /**
   * Parse document based on MIME type or extension
   */
  async parse(file) {
    console.log(`📄 Parsing ${file.name} (${this.formatSize(file.content.byteLength)})`);
    
    // Check file size
    if (file.content.byteLength > this.config.maxFileSize) {
      throw new Error(`File too large: ${this.formatSize(file.content.byteLength)} > ${this.formatSize(this.config.maxFileSize)}`);
    }
    
    const fileType = this.detectFileType(file.name, file.mimeType);
    let result;
    
    try {
      switch (fileType) {
        case 'pdf':
          result = await this.parsePDF(file);
          this.stats.supportedFormats.pdf++;
          break;
          
        case 'docx':
          result = await this.parseDOCX(file);
          this.stats.supportedFormats.docx++;
          break;
          
        case 'pptx':
          result = await this.parsePPTX(file);
          this.stats.supportedFormats.pptx++;
          break;
          
        case 'xlsx':
          result = await this.parseXLSX(file);
          this.stats.supportedFormats.xlsx++;
          break;
          
        case 'txt':
        case 'md':
        case 'csv':
          result = await this.parseText(file);
          this.stats.supportedFormats.txt++;
          break;
          
        case 'html':
        case 'xml':
          result = await this.parseMarkup(file);
          this.stats.supportedFormats.other++;
          break;
          
        case 'json':
          result = await this.parseJSON(file);
          this.stats.supportedFormats.other++;
          break;
          
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
      
      this.stats.filesProcessed++;
      this.stats.bytesProcessed += file.content.byteLength;
      
      return {
        ...result,
        fileType,
        originalName: file.name,
        originalSize: file.content.byteLength,
        hash: file.hash || this.generateHash(file.content)
      };
      
    } catch (error) {
      console.error(`❌ Error parsing ${file.name}:`, error.message);
      this.stats.errors.push({ file: file.name, error: error.message });
      throw error;
    }
  }

  /**
   * Parse PDF documents
   */
  async parsePDF(file) {
    console.log('📑 Parsing PDF document');
    
    // For POC, simulate PDF parsing
    // In production, use pdf.js or similar library
    const buffer = Buffer.from(file.content);
    
    // Simulate extracted content
    const pages = [];
    const pageCount = Math.max(1, Math.floor(buffer.byteLength / 10000)); // Rough estimate
    
    for (let i = 1; i <= pageCount; i++) {
      pages.push({
        pageNumber: i,
        text: `[Page ${i} content from ${file.name}]\n` +
              `This is simulated content for POC purposes.\n` +
              `In production, actual PDF text extraction would occur here.`,
        tables: [],
        images: []
      });
    }
    
    // Check if OCR is needed (simulate by checking if "text" is low)
    const textDensity = buffer.byteLength > 50000 ? 0.8 : 0.3;
    
    if (textDensity < 0.5 && this.config.enableOCR) {
      console.log('🔍 Low text density detected, applying OCR');
      // In production, apply OCR using Tesseract.js
      for (const page of pages) {
        page.text += '\n[OCR extracted text would appear here]';
        page.isOCR = true;
      }
    }
    
    // Extract metadata
    const metadata = {
      title: file.metadata?.title || file.name.replace(/\.pdf$/i, ''),
      author: file.metadata?.createdBy || 'Unknown',
      creationDate: file.metadata?.created || new Date().toISOString(),
      modificationDate: file.metadata?.lastModified || new Date().toISOString(),
      pageCount,
      hasText: textDensity > 0.5,
      hasImages: pageCount > 2,
      hasTables: false
    };
    
    return {
      content: pages.map(p => p.text).join('\n\n'),
      pages,
      metadata,
      structure: {
        type: 'document',
        format: 'pdf',
        sections: pages.map(p => ({
          type: 'page',
          number: p.pageNumber,
          content: p.text,
          isOCR: p.isOCR || false
        }))
      }
    };
  }

  /**
   * Parse DOCX documents
   */
  async parseDOCX(file) {
    console.log('📝 Parsing DOCX document');
    
    // For POC, simulate DOCX parsing
    // In production, use mammoth.js or similar
    const buffer = Buffer.from(file.content);
    
    // Simulate document structure
    const sections = [
      {
        type: 'heading',
        level: 1,
        text: 'Document Title'
      },
      {
        type: 'paragraph',
        text: `Content from ${file.name}. This is simulated extraction for POC.`
      },
      {
        type: 'paragraph',
        text: 'In production, actual DOCX parsing would extract all paragraphs, headings, tables, and images.'
      }
    ];
    
    // Add more content based on file size
    const paragraphCount = Math.max(5, Math.floor(buffer.byteLength / 1000));
    for (let i = 0; i < paragraphCount; i++) {
      sections.push({
        type: 'paragraph',
        text: `Paragraph ${i + 1}: Sample content representing document text.`
      });
    }
    
    // Extract tables if present
    const tables = [];
    if (this.config.extractTables && buffer.byteLength > 5000) {
      tables.push({
        rows: [
          ['Header 1', 'Header 2', 'Header 3'],
          ['Data 1', 'Data 2', 'Data 3'],
          ['Data 4', 'Data 5', 'Data 6']
        ]
      });
    }
    
    const metadata = {
      title: file.metadata?.title || file.name.replace(/\.docx$/i, ''),
      author: file.metadata?.createdBy || 'Unknown',
      wordCount: paragraphCount * 50,
      paragraphCount,
      tableCount: tables.length
    };
    
    return {
      content: sections.filter(s => s.text).map(s => s.text).join('\n\n'),
      sections,
      tables,
      metadata,
      structure: {
        type: 'document',
        format: 'docx',
        sections
      }
    };
  }

  /**
   * Parse PPTX presentations
   */
  async parsePPTX(file) {
    console.log('🎭 Parsing PPTX presentation');
    
    // For POC, simulate PPTX parsing
    const buffer = Buffer.from(file.content);
    
    // Simulate slide extraction
    const slideCount = Math.max(5, Math.floor(buffer.byteLength / 5000));
    const slides = [];
    
    for (let i = 1; i <= slideCount; i++) {
      slides.push({
        slideNumber: i,
        title: `Slide ${i} Title`,
        content: `Content from slide ${i}:\n` +
                `• Bullet point 1\n` +
                `• Bullet point 2\n` +
                `• Bullet point 3`,
        notes: i % 3 === 0 ? `Speaker notes for slide ${i}` : '',
        hasImages: i % 4 === 0,
        hasCharts: i % 5 === 0
      });
    }
    
    const metadata = {
      title: file.metadata?.title || file.name.replace(/\.pptx$/i, ''),
      author: file.metadata?.createdBy || 'Unknown',
      slideCount,
      hasNotes: slides.some(s => s.notes),
      presentationTheme: 'Default'
    };
    
    return {
      content: slides.map(s => 
        `[Slide ${s.slideNumber}] ${s.title}\n${s.content}${s.notes ? '\nNotes: ' + s.notes : ''}`
      ).join('\n\n'),
      slides,
      metadata,
      structure: {
        type: 'presentation',
        format: 'pptx',
        slides: slides.map(s => ({
          number: s.slideNumber,
          title: s.title,
          content: s.content,
          notes: s.notes
        }))
      }
    };
  }

  /**
   * Parse XLSX spreadsheets
   */
  async parseXLSX(file) {
    console.log('📊 Parsing XLSX spreadsheet');
    
    // For POC, simulate XLSX parsing
    const buffer = Buffer.from(file.content);
    
    // Simulate sheet extraction
    const sheets = [
      {
        name: 'Sheet1',
        rows: [
          ['Column A', 'Column B', 'Column C', 'Column D'],
          ['Data 1', 'Value 100', '2024-01-15', 'Active'],
          ['Data 2', 'Value 200', '2024-02-20', 'Pending'],
          ['Data 3', 'Value 150', '2024-03-10', 'Complete']
        ]
      }
    ];
    
    // Add more sheets for larger files
    if (buffer.byteLength > 10000) {
      sheets.push({
        name: 'Summary',
        rows: [
          ['Metric', 'Value'],
          ['Total Revenue', '450'],
          ['Active Items', '25'],
          ['Completion Rate', '85%']
        ]
      });
    }
    
    const metadata = {
      title: file.metadata?.title || file.name.replace(/\.xlsx$/i, ''),
      author: file.metadata?.createdBy || 'Unknown',
      sheetCount: sheets.length,
      totalRows: sheets.reduce((sum, s) => sum + s.rows.length, 0),
      totalColumns: Math.max(...sheets.map(s => s.rows[0]?.length || 0))
    };
    
    // Convert to text format
    const content = sheets.map(sheet => 
      `[Sheet: ${sheet.name}]\n` +
      sheet.rows.map(row => row.join('\t')).join('\n')
    ).join('\n\n');
    
    return {
      content,
      sheets,
      metadata,
      structure: {
        type: 'spreadsheet',
        format: 'xlsx',
        sheets: sheets.map(s => ({
          name: s.name,
          rowCount: s.rows.length,
          columnCount: s.rows[0]?.length || 0,
          data: s.rows
        }))
      }
    };
  }

  /**
   * Parse plain text files
   */
  async parseText(file) {
    console.log('📄 Parsing text file');
    
    const buffer = Buffer.from(file.content);
    const text = buffer.toString('utf-8');
    
    // Detect structure (markdown, csv, etc.)
    const lines = text.split('\n');
    const fileExt = file.name.split('.').pop().toLowerCase();
    
    let structure = { type: 'text', format: fileExt };
    
    if (fileExt === 'csv') {
      // Parse CSV structure
      const delimiter = text.includes('\t') ? '\t' : ',';
      const rows = lines.map(line => line.split(delimiter));
      
      structure = {
        type: 'table',
        format: 'csv',
        headers: rows[0] || [],
        rows: rows.slice(1),
        rowCount: rows.length - 1,
        columnCount: rows[0]?.length || 0
      };
    } else if (fileExt === 'md') {
      // Parse markdown structure
      const headings = lines.filter(l => l.startsWith('#'));
      const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
      
      structure = {
        type: 'markdown',
        format: 'md',
        headingCount: headings.length,
        codeBlockCount: codeBlocks.length,
        lineCount: lines.length
      };
    }
    
    const metadata = {
      encoding: 'utf-8',
      lineCount: lines.length,
      wordCount: text.split(/\s+/).length,
      charCount: text.length,
      fileType: fileExt
    };
    
    return {
      content: text,
      metadata,
      structure
    };
  }

  /**
   * Parse HTML/XML markup
   */
  async parseMarkup(file) {
    console.log('🌐 Parsing markup file');
    
    const buffer = Buffer.from(file.content);
    const markup = buffer.toString('utf-8');
    
    // Basic text extraction (remove tags)
    const textContent = markup
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract metadata from meta tags or XML attributes
    const title = markup.match(/<title>(.*?)<\/title>/i)?.[1] || 
                 markup.match(/<h1[^>]*>(.*?)<\/h1>/i)?.[1] || '';
    
    const metadata = {
      title,
      format: file.name.endsWith('.xml') ? 'xml' : 'html',
      hasScripts: /<script/i.test(markup),
      hasStyles: /<style/i.test(markup),
      charCount: textContent.length
    };
    
    return {
      content: textContent,
      originalMarkup: markup.substring(0, 1000) + '...',
      metadata,
      structure: {
        type: 'markup',
        format: metadata.format
      }
    };
  }

  /**
   * Parse JSON files
   */
  async parseJSON(file) {
    console.log('🔧 Parsing JSON file');
    
    const buffer = Buffer.from(file.content);
    const jsonString = buffer.toString('utf-8');
    
    try {
      const data = JSON.parse(jsonString);
      
      // Convert to readable text format
      const content = this.jsonToText(data);
      
      const metadata = {
        format: 'json',
        isArray: Array.isArray(data),
        keyCount: typeof data === 'object' && !Array.isArray(data) ? Object.keys(data).length : 0,
        depth: this.getJsonDepth(data)
      };
      
      return {
        content,
        data,
        metadata,
        structure: {
          type: 'structured',
          format: 'json',
          schema: this.extractJsonSchema(data)
        }
      };
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  }

  /**
   * Convert JSON to readable text
   */
  jsonToText(obj, indent = 0) {
    const spacing = '  '.repeat(indent);
    let text = '';
    
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => {
        text += `${spacing}[${i}]: ${typeof item === 'object' ? '\n' : ''}${this.jsonToText(item, indent + 1)}\n`;
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        text += `${spacing}${key}: ${typeof value === 'object' ? '\n' : ''}${this.jsonToText(value, indent + 1)}\n`;
      });
    } else {
      text = String(obj);
    }
    
    return text;
  }

  /**
   * Get JSON depth
   */
  getJsonDepth(obj, currentDepth = 0) {
    if (typeof obj !== 'object' || obj === null) return currentDepth;
    
    const depths = Object.values(obj).map(v => this.getJsonDepth(v, currentDepth + 1));
    return Math.max(currentDepth, ...depths);
  }

  /**
   * Extract simplified JSON schema
   */
  extractJsonSchema(obj) {
    if (Array.isArray(obj)) {
      return { type: 'array', items: obj.length > 0 ? this.extractJsonSchema(obj[0]) : {} };
    } else if (typeof obj === 'object' && obj !== null) {
      const schema = { type: 'object', properties: {} };
      for (const [key, value] of Object.entries(obj)) {
        schema.properties[key] = typeof value === 'object' ? this.extractJsonSchema(value) : { type: typeof value };
      }
      return schema;
    } else {
      return { type: typeof obj };
    }
  }

  /**
   * Detect file type from name and MIME type
   */
  detectFileType(filename, mimeType) {
    const ext = filename.toLowerCase().split('.').pop();
    
    // Check by extension first
    const extMap = {
      pdf: 'pdf',
      docx: 'docx',
      doc: 'docx',
      pptx: 'pptx',
      ppt: 'pptx',
      xlsx: 'xlsx',
      xls: 'xlsx',
      txt: 'txt',
      md: 'md',
      csv: 'csv',
      html: 'html',
      htm: 'html',
      xml: 'xml',
      json: 'json'
    };
    
    if (extMap[ext]) return extMap[ext];
    
    // Check by MIME type
    if (mimeType) {
      if (mimeType.includes('pdf')) return 'pdf';
      if (mimeType.includes('word')) return 'docx';
      if (mimeType.includes('presentation')) return 'pptx';
      if (mimeType.includes('sheet')) return 'xlsx';
      if (mimeType.includes('text')) return 'txt';
      if (mimeType.includes('json')) return 'json';
      if (mimeType.includes('html')) return 'html';
      if (mimeType.includes('xml')) return 'xml';
    }
    
    return 'unknown';
  }

  /**
   * Generate content hash
   */
  generateHash(buffer) {
    return createHash('sha256').update(Buffer.from(buffer)).digest('hex');
  }

  /**
   * Format file size
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Get parser statistics
   */
  getStats() {
    return {
      ...this.stats,
      bytesProcessedMB: (this.stats.bytesProcessed / 1024 / 1024).toFixed(2),
      successRate: this.stats.filesProcessed > 0 
        ? ((this.stats.filesProcessed / (this.stats.filesProcessed + this.stats.errors.length)) * 100).toFixed(1) + '%'
        : '0%'
    };
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const parser = new DocumentParser({ enableOCR: true });
  
  // Test with a sample file
  const testFile = {
    name: 'test.pdf',
    content: Buffer.from('Sample PDF content'),
    mimeType: 'application/pdf',
    metadata: {
      createdBy: 'Test User',
      lastModified: new Date().toISOString()
    }
  };
  
  parser.parse(testFile)
    .then(result => {
      console.log('\n✅ Parse result:', JSON.stringify(result.metadata, null, 2));
      console.log('📊 Parser stats:', parser.getStats());
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Parse error:', error);
      process.exit(1);
    });
}

export default DocumentParser;