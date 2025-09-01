#!/usr/bin/env node
/**
 * Box Connector for Graph RAG 10T POC
 * Handles OAuth2/JWT authentication and data extraction from Box
 * Supports folder traversal and incremental sync
 */

import { createHash } from 'crypto';

class BoxConnector {
  constructor(config) {
    this.config = {
      clientId: config.clientId || process.env.POC_BOX_CLIENT_ID,
      clientSecret: config.clientSecret || process.env.POC_BOX_CLIENT_SECRET,
      developerToken: config.developerToken || process.env.POC_BOX_DEVELOPER_TOKEN,
      enterpriseId: config.enterpriseId || process.env.POC_BOX_ENTERPRISE_ID,
      userId: config.userId || process.env.POC_BOX_USER_ID,
      batchSize: parseInt(config.batchSize || process.env.POC_BOX_BATCH_SIZE || '100'),
      maxRetries: 3,
      retryDelay: 1000
    };
    
    this.baseUrl = 'https://api.box.com/2.0';
    this.authUrl = 'https://api.box.com/oauth2/token';
    this.uploadUrl = 'https://upload.box.com/api/2.0';
    this.accessToken = this.config.developerToken; // Start with dev token
    this.tokenExpiry = null;
    this.syncState = {};
    this.stats = {
      filesProcessed: 0,
      foldersProcessed: 0,
      bytesProcessed: 0,
      errors: []
    };
  }

  /**
   * Authenticate with Box using OAuth2 or developer token
   */
  async authenticate() {
    // If developer token is provided, use it directly
    if (this.config.developerToken) {
      this.accessToken = this.config.developerToken;
      console.log('✅ Using Box developer token');
      return true;
    }

    // Otherwise use OAuth2 client credentials
    try {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        box_subject_type: 'enterprise',
        box_subject_id: this.config.enterpriseId
      });

      const response = await fetch(this.authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
      
      console.log('✅ Box OAuth2 authentication successful');
      return true;
    } catch (error) {
      console.error('❌ Box authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Ensure valid access token
   */
  async ensureAuthenticated() {
    if (!this.accessToken || (this.tokenExpiry && Date.now() >= this.tokenExpiry)) {
      await this.authenticate();
    }
  }

  /**
   * Make authenticated API request with retry logic
   */
  async apiRequest(url, options = {}, retryCount = 0) {
    await this.ensureAuthenticated();

    const requestOptions = {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, requestOptions);

      if (response.status === 401 && retryCount < this.config.maxRetries) {
        this.accessToken = null;
        return this.apiRequest(url, options, retryCount + 1);
      }

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        console.log(`⏳ Rate limited, waiting ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.apiRequest(url, options, retryCount + 1);
      }

      if (!response.ok && retryCount < this.config.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * Math.pow(2, retryCount)));
        return this.apiRequest(url, options, retryCount + 1);
      }

      return response;
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * Math.pow(2, retryCount)));
        return this.apiRequest(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * List folder contents recursively
   */
  async listFolder(folderId = '0', recursive = true) {
    const items = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    console.log(`📁 Scanning folder ${folderId === '0' ? 'root' : folderId}`);

    while (hasMore) {
      const url = `${this.baseUrl}/folders/${folderId}/items?` + 
        `fields=id,type,name,size,modified_at,created_at,created_by,parent,path_collection,shared_link,permissions` +
        `&limit=${limit}&offset=${offset}`;

      const response = await this.apiRequest(url);
      
      if (!response.ok) {
        throw new Error(`Failed to list folder: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const entries = data.entries || [];

      for (const entry of entries) {
        if (entry.type === 'file' && this.isSupportedFileType(entry.name)) {
          items.push({
            id: entry.id,
            type: 'file',
            name: entry.name,
            path: this.buildPath(entry.path_collection),
            size: entry.size,
            lastModified: entry.modified_at,
            createdBy: entry.created_by?.name || 'Unknown',
            parent: entry.parent?.id,
            sharedLink: entry.shared_link?.url,
            acl: this.extractACL(entry)
          });
        } else if (entry.type === 'folder' && recursive) {
          this.stats.foldersProcessed++;
          // Recursively scan subfolders
          const subItems = await this.listFolder(entry.id, true);
          items.push(...subItems);
        }
      }

      offset += entries.length;
      hasMore = entries.length === limit;
    }

    return items;
  }

  /**
   * Get folder changes (for incremental sync)
   */
  async getChanges(streamPosition = '0') {
    const url = `${this.baseUrl}/events?` +
      `stream_position=${streamPosition}&stream_type=changes&limit=100`;

    const response = await this.apiRequest(url);
    
    if (!response.ok) {
      throw new Error(`Failed to get changes: ${response.status}`);
    }

    const data = await response.json();
    const changes = [];

    for (const event of data.entries || []) {
      if (event.source?.type === 'file' && this.isSupportedFileType(event.source.name)) {
        changes.push({
          eventType: event.event_type,
          file: {
            id: event.source.id,
            name: event.source.name,
            parent: event.source.parent?.id
          }
        });
      }
    }

    // Store new stream position for next sync
    this.syncState.streamPosition = data.next_stream_position;

    return changes;
  }

  /**
   * Download file content
   */
  async downloadFile(file) {
    try {
      const url = `${this.baseUrl}/files/${file.id}/content`;
      const response = await this.apiRequest(url);
      
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      this.stats.filesProcessed++;
      this.stats.bytesProcessed += buffer.byteLength;
      
      // Get additional metadata
      const metadata = await this.getFileMetadata(file.id);
      
      return {
        id: file.id,
        name: file.name,
        path: file.path,
        content: buffer,
        mimeType: this.getMimeType(file.name),
        metadata: {
          lastModified: file.lastModified,
          createdBy: file.createdBy,
          size: file.size,
          source: 'box',
          sourceUrl: file.sharedLink || `https://app.box.com/file/${file.id}`,
          ...metadata
        },
        acl: file.acl,
        hash: this.generateHash(buffer)
      };
    } catch (error) {
      console.error(`❌ Failed to download ${file.name}:`, error.message);
      this.stats.errors.push({ file: file.name, error: error.message });
      return null;
    }
  }

  /**
   * Get detailed file metadata
   */
  async getFileMetadata(fileId) {
    try {
      const url = `${this.baseUrl}/files/${fileId}?fields=tags,metadata,version_number,comment_count`;
      const response = await this.apiRequest(url);
      
      if (!response.ok) {
        return {};
      }
      
      const data = await response.json();
      return {
        tags: data.tags || [],
        version: data.version_number,
        comments: data.comment_count || 0,
        metadata: data.metadata || {}
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Get file/folder permissions
   */
  async getPermissions(itemId, itemType = 'files') {
    try {
      const url = `${this.baseUrl}/${itemType}/${itemId}/collaborations`;
      const response = await this.apiRequest(url);
      
      if (!response.ok) {
        return { users: [], groups: [] };
      }
      
      const data = await response.json();
      const acl = { users: [], groups: [] };
      
      for (const collab of data.entries || []) {
        if (collab.accessible_by?.type === 'user') {
          acl.users.push(collab.accessible_by.id);
        } else if (collab.accessible_by?.type === 'group') {
          acl.groups.push(collab.accessible_by.id);
        }
      }
      
      return acl;
    } catch (error) {
      console.warn(`⚠️ Could not get permissions for ${itemId}`);
      return { users: [], groups: [] };
    }
  }

  /**
   * Batch download files
   */
  async batchDownload(files, onProgress) {
    const results = [];
    const batches = this.createBatches(files, this.config.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📥 Processing batch ${i + 1}/${batches.length} (${batch.length} files)`);
      
      const batchPromises = batch.map(file => this.downloadFile(file));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults.filter(r => r !== null));
      
      if (onProgress) {
        onProgress({
          current: Math.min((i + 1) * this.config.batchSize, files.length),
          total: files.length,
          percentage: Math.round(((i + 1) / batches.length) * 100)
        });
      }
      
      // Rate limiting between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }

  /**
   * Search for files
   */
  async searchFiles(query, options = {}) {
    const url = `${this.baseUrl}/search?` +
      `query=${encodeURIComponent(query)}` +
      `&type=${options.type || 'file'}` +
      `&limit=${options.limit || 100}` +
      `&fields=id,type,name,size,modified_at,created_by,parent,path_collection`;

    const response = await this.apiRequest(url);
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();
    const files = [];

    for (const entry of data.entries || []) {
      if (entry.type === 'file' && this.isSupportedFileType(entry.name)) {
        files.push({
          id: entry.id,
          name: entry.name,
          path: this.buildPath(entry.path_collection),
          size: entry.size,
          lastModified: entry.modified_at,
          createdBy: entry.created_by?.name || 'Unknown'
        });
      }
    }

    return files;
  }

  /**
   * Build full path from path collection
   */
  buildPath(pathCollection) {
    if (!pathCollection || !pathCollection.entries) {
      return '/';
    }
    return '/' + pathCollection.entries.map(e => e.name).join('/');
  }

  /**
   * Extract ACL from item metadata
   */
  extractACL(item) {
    const acl = { users: [], groups: [] };
    
    if (item.created_by?.id) {
      acl.users.push(item.created_by.id);
    }
    
    if (item.permissions?.can_download === false) {
      acl.restricted = true;
    }
    
    return acl;
  }

  /**
   * Check if file type is supported
   */
  isSupportedFileType(filename) {
    const supported = [
      '.pdf', '.docx', '.doc', '.pptx', '.ppt', 
      '.xlsx', '.xls', '.txt', '.md', '.csv',
      '.json', '.xml', '.html', '.rtf'
    ];
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
    return ext && supported.includes(ext);
  }

  /**
   * Get MIME type from filename
   */
  getMimeType(filename) {
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.rtf': 'application/rtf'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Generate content hash for deduplication
   */
  generateHash(buffer) {
    return createHash('sha256').update(Buffer.from(buffer)).digest('hex');
  }

  /**
   * Create batches from array
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get connector statistics
   */
  getStats() {
    return {
      ...this.stats,
      bytesProcessedMB: (this.stats.bytesProcessed / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * Main ingestion flow
   */
  async ingest(options = {}) {
    console.log('🚀 Starting Box ingestion');
    
    try {
      // Authenticate
      await this.authenticate();
      
      // Get files (incremental if stream position available)
      let files = [];
      
      if (options.incremental && this.syncState.streamPosition) {
        console.log('📊 Using incremental sync');
        const changes = await this.getChanges(this.syncState.streamPosition);
        // Fetch full file info for changed files
        for (const change of changes) {
          if (change.eventType !== 'ITEM_TRASH') {
            const fileInfo = await this.getFileInfo(change.file.id);
            if (fileInfo) files.push(fileInfo);
          }
        }
      } else {
        // Full scan
        const folderId = options.folderId || '0';
        files = await this.listFolder(folderId, options.recursive !== false);
      }
      
      if (files.length === 0) {
        console.log('✅ No new files to process');
        return [];
      }
      
      console.log(`📁 Found ${files.length} files to process`);
      
      // Download files
      const downloadedFiles = await this.batchDownload(files, options.onProgress);
      
      console.log(`✅ Box ingestion complete: ${downloadedFiles.length} files processed`);
      console.log(`📊 Stats:`, this.getStats());
      
      return downloadedFiles;
    } catch (error) {
      console.error('❌ Box ingestion failed:', error);
      throw error;
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(fileId) {
    try {
      const url = `${this.baseUrl}/files/${fileId}`;
      const response = await this.apiRequest(url);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      if (!this.isSupportedFileType(data.name)) {
        return null;
      }
      
      return {
        id: data.id,
        name: data.name,
        path: this.buildPath(data.path_collection),
        size: data.size,
        lastModified: data.modified_at,
        createdBy: data.created_by?.name || 'Unknown',
        parent: data.parent?.id,
        sharedLink: data.shared_link?.url,
        acl: this.extractACL(data)
      };
    } catch (error) {
      return null;
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const connector = new BoxConnector({});
  
  connector.ingest({
    recursive: true,
    onProgress: (progress) => {
      console.log(`Progress: ${progress.current}/${progress.total} (${progress.percentage}%)`);
    }
  })
  .then(files => {
    console.log(`\n✅ Ingested ${files.length} files from Box`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export default BoxConnector;