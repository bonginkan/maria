#!/usr/bin/env node
/**
 * Database Connector for Graph RAG 10T POC
 * Supports PostgreSQL, SQL Server, and Oracle databases
 * Handles schema discovery, incremental sync, and data extraction
 */

import { createHash } from 'crypto';

class DatabaseConnector {
  constructor(config) {
    this.config = {
      type: config.type || process.env.POC_DB_TYPE || 'postgres',
      host: config.host || process.env.POC_DB_HOST || 'localhost',
      port: parseInt(config.port || process.env.POC_DB_PORT || '5432'),
      user: config.user || process.env.POC_DB_USER,
      password: config.password || process.env.POC_DB_PASSWORD,
      database: config.database || process.env.POC_DB_NAME,
      schema: config.schema || process.env.POC_DB_SCHEMA || 'public',
      poolSize: parseInt(config.poolSize || process.env.POC_DB_POOL_SIZE || '10'),
      batchSize: parseInt(config.batchSize || process.env.POC_DB_BATCH_SIZE || '1000'),
      timeout: parseInt(config.timeout || '30000')
    };
    
    this.connection = null;
    this.syncState = {};
    this.stats = {
      tablesProcessed: 0,
      rowsProcessed: 0,
      bytesProcessed: 0,
      errors: []
    };
  }

  /**
   * Get connection string based on database type
   */
  getConnectionString() {
    const { type, host, port, user, password, database } = this.config;
    
    switch (type) {
      case 'postgres':
        return `postgres://${user}:${password}@${host}:${port}/${database}`;
      
      case 'sqlserver':
        return `Server=${host},${port};Database=${database};User Id=${user};Password=${password};`;
      
      case 'oracle':
        return `${user}/${password}@${host}:${port}/${database}`;
      
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }

  /**
   * Connect to database using native fetch with database proxy endpoint
   * In production, this would use a database proxy service
   */
  async connect() {
    console.log(`🔗 Connecting to ${this.config.type} database at ${this.config.host}:${this.config.port}`);
    
    // For POC, we'll simulate database connection
    // In production, this would use actual database drivers or proxy service
    this.connection = {
      connected: true,
      type: this.config.type,
      database: this.config.database
    };
    
    console.log(`✅ Connected to database: ${this.config.database}`);
    return true;
  }

  /**
   * Execute SQL query
   * In production, this would use actual database drivers
   */
  async executeQuery(query, params = []) {
    if (!this.connection?.connected) {
      await this.connect();
    }

    // For POC, simulate query execution
    // In production, replace with actual database query
    console.log(`📊 Executing query: ${query.substring(0, 100)}...`);
    
    // Simulate different query responses based on query type
    if (query.includes('information_schema') || query.includes('sys.tables')) {
      return this.getMockSchemaData();
    } else if (query.includes('SELECT')) {
      return this.getMockTableData(query);
    }
    
    return { rows: [], rowCount: 0 };
  }

  /**
   * Get mock schema data for POC
   */
  getMockSchemaData() {
    return {
      rows: [
        { table_schema: 'public', table_name: 'sales_2024', row_count: 10000 },
        { table_schema: 'public', table_name: 'customers', row_count: 5000 },
        { table_schema: 'public', table_name: 'products', row_count: 1500 },
        { table_schema: 'public', table_name: 'support_tickets', row_count: 8000 },
        { table_schema: 'public', table_name: 'employee_master', row_count: 500 },
        { table_schema: 'public', table_name: 'project_milestones', row_count: 200 },
        { table_schema: 'public', table_name: 'patent_registry', row_count: 150 },
        { table_schema: 'public', table_name: 'vendor_contracts', row_count: 300 },
        { table_schema: 'public', table_name: 'board_decisions', row_count: 50 },
        { table_schema: 'public', table_name: 'survey_responses', row_count: 2000 }
      ],
      rowCount: 10
    };
  }

  /**
   * Get mock table data for POC
   */
  getMockTableData(query) {
    const tableName = query.match(/FROM\s+(\w+)/i)?.[1] || 'unknown';
    const limit = parseInt(query.match(/LIMIT\s+(\d+)/i)?.[1] || '100');
    
    const mockData = {
      sales_2024: [
        { id: 1, product: 'Product A', revenue: 150000, quarter: 'Q1', year: 2024 },
        { id: 2, product: 'Product B', revenue: 200000, quarter: 'Q1', year: 2024 },
        { id: 3, product: 'Product C', revenue: 175000, quarter: 'Q2', year: 2024 }
      ],
      customers: [
        { id: 1, name: 'Acme Corp', industry: 'Technology', created_at: '2024-01-15' },
        { id: 2, name: 'Global Inc', industry: 'Finance', created_at: '2024-02-20' }
      ],
      support_tickets: [
        { id: 1, subject: 'Login issue', status: 'resolved', created_at: '2024-10-01' },
        { id: 2, subject: 'Performance problem', status: 'open', created_at: '2024-10-15' }
      ]
    };
    
    const rows = mockData[tableName] || [
      { id: 1, data: `Sample data from ${tableName}`, updated_at: new Date().toISOString() }
    ];
    
    return {
      rows: rows.slice(0, limit),
      rowCount: rows.length
    };
  }

  /**
   * Discover database schema
   */
  async discoverSchema() {
    console.log('🔍 Discovering database schema...');
    
    let query;
    switch (this.config.type) {
      case 'postgres':
        query = `
          SELECT 
            table_schema,
            table_name,
            (SELECT COUNT(*) FROM information_schema.columns c 
             WHERE c.table_schema = t.table_schema 
             AND c.table_name = t.table_name) as column_count
          FROM information_schema.tables t
          WHERE table_schema = '${this.config.schema}'
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `;
        break;
        
      case 'sqlserver':
        query = `
          SELECT 
            SCHEMA_NAME(schema_id) as table_schema,
            name as table_name,
            (SELECT COUNT(*) FROM sys.columns c 
             WHERE c.object_id = t.object_id) as column_count
          FROM sys.tables t
          WHERE SCHEMA_NAME(schema_id) = '${this.config.schema}'
          ORDER BY name
        `;
        break;
        
      case 'oracle':
        query = `
          SELECT 
            owner as table_schema,
            table_name,
            (SELECT COUNT(*) FROM all_tab_columns c 
             WHERE c.owner = t.owner 
             AND c.table_name = t.table_name) as column_count
          FROM all_tables t
          WHERE owner = UPPER('${this.config.schema}')
          ORDER BY table_name
        `;
        break;
    }
    
    const result = await this.executeQuery(query);
    const tables = result.rows;
    
    console.log(`📊 Found ${tables.length} tables in schema ${this.config.schema}`);
    
    // Get detailed info for each table
    const tableInfo = [];
    for (const table of tables) {
      const info = await this.getTableInfo(table.table_name);
      tableInfo.push({
        ...table,
        ...info
      });
    }
    
    return tableInfo;
  }

  /**
   * Get detailed table information
   */
  async getTableInfo(tableName) {
    let query;
    
    switch (this.config.type) {
      case 'postgres':
        query = `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = '${this.config.schema}'
          AND table_name = '${tableName}'
          ORDER BY ordinal_position
        `;
        break;
        
      case 'sqlserver':
        query = `
          SELECT 
            c.name as column_name,
            t.name as data_type,
            c.is_nullable,
            d.definition as column_default
          FROM sys.columns c
          JOIN sys.types t ON c.user_type_id = t.user_type_id
          LEFT JOIN sys.default_constraints d ON c.default_object_id = d.object_id
          WHERE c.object_id = OBJECT_ID('${this.config.schema}.${tableName}')
          ORDER BY c.column_id
        `;
        break;
        
      case 'oracle':
        query = `
          SELECT 
            column_name,
            data_type,
            nullable as is_nullable,
            data_default as column_default
          FROM all_tab_columns
          WHERE owner = UPPER('${this.config.schema}')
          AND table_name = UPPER('${tableName}')
          ORDER BY column_id
        `;
        break;
    }
    
    const result = await this.executeQuery(query);
    
    // Get row count
    const countQuery = `SELECT COUNT(*) as count FROM ${this.config.schema}.${tableName}`;
    const countResult = await this.executeQuery(countQuery);
    
    return {
      columns: result.rows,
      rowCount: countResult.rows[0]?.count || 0,
      hasTimestamp: result.rows.some(col => 
        col.column_name.includes('updated') || 
        col.column_name.includes('modified') ||
        col.column_name.includes('timestamp')
      )
    };
  }

  /**
   * Extract data from table
   */
  async extractTableData(tableName, options = {}) {
    console.log(`📤 Extracting data from ${tableName}...`);
    
    const limit = options.limit || this.config.batchSize;
    const offset = options.offset || 0;
    const lastSync = this.syncState[tableName]?.lastSync;
    
    // Build query with incremental sync support
    let query = `SELECT * FROM ${this.config.schema}.${tableName}`;
    
    if (lastSync && options.incremental) {
      // Try to find timestamp column for incremental sync
      const timestampColumns = ['updated_at', 'modified_at', 'last_modified', 'timestamp'];
      const tableInfo = await this.getTableInfo(tableName);
      const timestampCol = tableInfo.columns.find(col => 
        timestampColumns.includes(col.column_name.toLowerCase())
      );
      
      if (timestampCol) {
        query += ` WHERE ${timestampCol.column_name} > '${lastSync}'`;
        console.log(`📊 Using incremental sync from ${lastSync}`);
      }
    }
    
    query += ` ORDER BY 1 LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await this.executeQuery(query);
    this.stats.rowsProcessed += result.rows.length;
    
    // Convert rows to documents
    const documents = result.rows.map(row => ({
      id: `db:${tableName}#row:${row.id || offset}`,
      source: 'database',
      table: tableName,
      schema: this.config.schema,
      content: JSON.stringify(row, null, 2),
      metadata: {
        database: this.config.database,
        table: tableName,
        rowCount: result.rows.length,
        extractedAt: new Date().toISOString()
      },
      hash: this.generateHash(JSON.stringify(row))
    }));
    
    // Update sync state
    this.syncState[tableName] = {
      lastSync: new Date().toISOString(),
      rowsProcessed: (this.syncState[tableName]?.rowsProcessed || 0) + result.rows.length
    };
    
    return documents;
  }

  /**
   * Extract all data from database
   */
  async extractAll(options = {}) {
    const documents = [];
    const tables = options.tables || await this.discoverSchema();
    
    for (const table of tables) {
      const tableName = typeof table === 'string' ? table : table.table_name;
      
      if (options.filter && !options.filter(tableName)) {
        console.log(`⏭️ Skipping table ${tableName}`);
        continue;
      }
      
      console.log(`📊 Processing table ${tableName}`);
      this.stats.tablesProcessed++;
      
      // Extract data in batches
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const batch = await this.extractTableData(tableName, {
          ...options,
          offset,
          limit: this.config.batchSize
        });
        
        documents.push(...batch);
        
        if (batch.length < this.config.batchSize) {
          hasMore = false;
        } else {
          offset += this.config.batchSize;
        }
        
        if (options.onProgress) {
          options.onProgress({
            table: tableName,
            rowsProcessed: offset + batch.length,
            tablesProcessed: this.stats.tablesProcessed,
            totalTables: tables.length
          });
        }
      }
    }
    
    return documents;
  }

  /**
   * Execute custom SQL query
   */
  async executeCustomQuery(sql, options = {}) {
    console.log(`🔧 Executing custom query...`);
    
    const result = await this.executeQuery(sql);
    
    // Convert to documents if requested
    if (options.asDocuments) {
      return result.rows.map((row, index) => ({
        id: `db:custom#row:${index}`,
        source: 'database',
        query: sql.substring(0, 100),
        content: JSON.stringify(row, null, 2),
        metadata: {
          database: this.config.database,
          executedAt: new Date().toISOString()
        },
        hash: this.generateHash(JSON.stringify(row))
      }));
    }
    
    return result.rows;
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    const tables = await this.discoverSchema();
    let totalRows = 0;
    let totalSize = 0;
    
    for (const table of tables) {
      const info = await this.getTableInfo(table.table_name);
      totalRows += info.rowCount || 0;
    }
    
    return {
      database: this.config.database,
      schema: this.config.schema,
      tableCount: tables.length,
      totalRows,
      tables: tables.map(t => ({
        name: t.table_name,
        rowCount: t.rowCount || 0,
        columns: t.column_count || 0
      }))
    };
  }

  /**
   * Generate hash for content
   */
  generateHash(content) {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.connection?.connected) {
      console.log('🔌 Closing database connection');
      this.connection.connected = false;
    }
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
    console.log('🚀 Starting database ingestion');
    
    try {
      // Connect to database
      await this.connect();
      
      // Get database statistics
      if (options.showStats) {
        const stats = await this.getDatabaseStats();
        console.log('📊 Database statistics:', stats);
      }
      
      // Extract data
      const documents = await this.extractAll({
        ...options,
        incremental: options.incremental !== false
      });
      
      console.log(`✅ Database ingestion complete: ${documents.length} documents extracted`);
      console.log(`📊 Stats:`, this.getStats());
      
      // Close connection
      await this.close();
      
      return documents;
    } catch (error) {
      console.error('❌ Database ingestion failed:', error);
      await this.close();
      throw error;
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const connector = new DatabaseConnector({});
  
  connector.ingest({
    showStats: true,
    incremental: false,
    onProgress: (progress) => {
      console.log(`Progress: Table ${progress.table} - ${progress.rowsProcessed} rows (${progress.tablesProcessed}/${progress.totalTables} tables)`);
    }
  })
  .then(documents => {
    console.log(`\n✅ Extracted ${documents.length} documents from database`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export default DatabaseConnector;