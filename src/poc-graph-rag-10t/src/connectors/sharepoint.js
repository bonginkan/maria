#!/usr/bin/env node
/**
 * SharePoint Connector for Graph RAG 10T POC
 * Handles OAuth2 authentication and data extraction from SharePoint
 * Supports delta sync for incremental updates
 */

import { createHash } from 'crypto';

class SharePointConnector {
  constructor(config) {
    this.config = {
      tenantId: config.tenantId || process.env.POC_SHAREPOINT_TENANT_ID,
      clientId: config.clientId || process.env.POC_SHAREPOINT_CLIENT_ID,
      clientSecret: config.clientSecret || process.env.POC_SHAREPOINT_CLIENT_SECRET,
      siteId: config.siteId || process.env.POC_SHAREPOINT_SITE_ID,
      driveId: config.driveId || process.env.POC_SHAREPOINT_DRIVE_ID,
      apiVersion: config.apiVersion || process.env.POC_SHAREPOINT_API_VERSION || 'v1.0',
      batchSize: parseInt(config.batchSize || process.env.POC_SHAREPOINT_BATCH_SIZE || '100'),
      maxRetries: 3,
      retryDelay: 1000
    };
    
    this.baseUrl = `https://graph.microsoft.com/${this.config.apiVersion}`;
    this.tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.deltaLink = null;
    this.stats = {
      filesProcessed: 0,
      bytesProcessed: 0,
      errors: []
    };
  }

  /**
   * Authenticate with SharePoint using OAuth2 client credentials flow
   */
  async authenticate() {
    try {
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      });

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early
      
      console.log('✅ SharePoint authentication successful');
      return true;
    } catch (error) {
      console.error('❌ SharePoint authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Ensure valid access token
   */
  async ensureAuthenticated() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
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
        // Token might be expired, re-authenticate
        this.accessToken = null;
        return this.apiRequest(url, options, retryCount + 1);
      }

      if (response.status === 429) {
        // Rate limited, wait and retry
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
   * List all documents in the drive with delta support
   */
  async listDocuments(useDelta = true) {
    const documents = [];
    let nextLink = null;

    // Use delta link if available for incremental sync
    if (useDelta && this.deltaLink) {
      nextLink = this.deltaLink;
      console.log('📊 Using delta sync for incremental updates');
    } else {
      nextLink = `${this.baseUrl}/sites/${this.config.siteId}/drives/${this.config.driveId}/root/delta`;
      console.log('📊 Starting full document scan');
    }

    while (nextLink) {
      const response = await this.apiRequest(nextLink);
      
      if (!response.ok) {
        throw new Error(`Failed to list documents: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Process items
      for (const item of data.value || []) {
        if (item.file && this.isSupportedFileType(item.name)) {
          documents.push({
            id: item.id,
            name: item.name,
            path: item.parentReference?.path || '',
            size: item.size,
            mimeType: item.file.mimeType,
            lastModified: item.lastModifiedDateTime,
            createdBy: item.createdBy?.user?.displayName || 'Unknown',
            webUrl: item.webUrl,
            downloadUrl: item['@microsoft.graph.downloadUrl'],
            eTag: item.eTag,
            deleted: item.deleted || false,
            acl: this.extractACL(item)
          });
        }
      }

      // Get next page or delta link
      nextLink = data['@odata.nextLink'] || null;
      
      // Save delta link for next sync
      if (data['@odata.deltaLink']) {
        this.deltaLink = data['@odata.deltaLink'];
        console.log('💾 Saved delta link for next sync');
      }
    }

    console.log(`📁 Found ${documents.length} documents`);
    return documents;
  }

  /**
   * Download file content
   */
  async downloadFile(document) {
    if (!document.downloadUrl) {
      console.warn(`⚠️ No download URL for ${document.name}`);
      return null;
    }

    try {
      const response = await this.apiRequest(document.downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      this.stats.filesProcessed++;
      this.stats.bytesProcessed += buffer.byteLength;
      
      return {
        id: document.id,
        name: document.name,
        path: document.path,
        content: buffer,
        mimeType: document.mimeType,
        metadata: {
          lastModified: document.lastModified,
          createdBy: document.createdBy,
          size: document.size,
          eTag: document.eTag,
          source: 'sharepoint',
          sourceUrl: document.webUrl
        },
        acl: document.acl,
        hash: this.generateHash(buffer)
      };
    } catch (error) {
      console.error(`❌ Failed to download ${document.name}:`, error.message);
      this.stats.errors.push({ file: document.name, error: error.message });
      return null;
    }
  }

  /**
   * Batch download documents
   */
  async batchDownload(documents, onProgress) {
    const results = [];
    const batches = this.createBatches(documents, this.config.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📥 Processing batch ${i + 1}/${batches.length} (${batch.length} files)`);
      
      const batchPromises = batch.map(doc => this.downloadFile(doc));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults.filter(r => r !== null));
      
      if (onProgress) {
        onProgress({
          current: Math.min((i + 1) * this.config.batchSize, documents.length),
          total: documents.length,
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
   * Get document permissions/ACL
   */
  async getDocumentPermissions(documentId) {
    try {
      const url = `${this.baseUrl}/drives/${this.config.driveId}/items/${documentId}/permissions`;
      const response = await this.apiRequest(url);
      
      if (!response.ok) {
        return { users: [], groups: [] };
      }
      
      const data = await response.json();
      const acl = { users: [], groups: [] };
      
      for (const perm of data.value || []) {
        if (perm.grantedTo?.user) {
          acl.users.push(perm.grantedTo.user.id);
        }
        if (perm.grantedTo?.group) {
          acl.groups.push(perm.grantedTo.group.id);
        }
      }
      
      return acl;
    } catch (error) {
      console.warn(`⚠️ Could not get permissions for ${documentId}`);
      return { users: [], groups: [] };
    }
  }

  /**
   * Extract ACL from item metadata
   */
  extractACL(item) {
    const acl = { users: [], groups: [] };
    
    // Extract from shared property
    if (item.shared) {
      if (item.shared.owner?.user) {
        acl.users.push(item.shared.owner.user.id);
      }
      if (item.shared.owner?.group) {
        acl.groups.push(item.shared.owner.group.id);
      }
    }
    
    // Extract from createdBy
    if (item.createdBy?.user?.id) {
      acl.users.push(item.createdBy.user.id);
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
    console.log('🚀 Starting SharePoint ingestion');
    
    try {
      // Authenticate
      await this.authenticate();
      
      // List documents
      const documents = await this.listDocuments(options.useDelta !== false);
      
      if (documents.length === 0) {
        console.log('✅ No new documents to process');
        return [];
      }
      
      // Download documents
      const files = await this.batchDownload(documents, options.onProgress);
      
      console.log(`✅ SharePoint ingestion complete: ${files.length} files processed`);
      console.log(`📊 Stats:`, this.getStats());
      
      return files;
    } catch (error) {
      console.error('❌ SharePoint ingestion failed:', error);
      throw error;
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const connector = new SharePointConnector({});
  
  connector.ingest({
    onProgress: (progress) => {
      console.log(`Progress: ${progress.current}/${progress.total} (${progress.percentage}%)`);
    }
  })
  .then(files => {
    console.log(`\n✅ Ingested ${files.length} files from SharePoint`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export default SharePointConnector;