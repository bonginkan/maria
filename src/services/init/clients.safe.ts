/**
 * Safe Service Clients for OpenSearch, Qdrant, and Neo4j
 * Non-destructive operations with existence checks and error handling
 */

import neo4j, { Driver, _Session } from "neo4j-driver";

// Types
export interface IndexStats {
  bm25: { docs: number; size?: number };
  vector: { vectors: number; dimensions?: number };
  kg: { nodes: number; edges: number };
}

export interface Doc {
  id?: string;
  chunk_id?: string;
  doc_id?: string;
  content: string;
  title?: string;
  path?: string;
  [key: string]: any;
}

export interface Point {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface GraphNode {
  doc_id: string;
  title?: string;
  path?: string;
  chunk_id?: string;
  content?: string;
  type?: string;
  [key: string]: any;
}

/* ========== OpenSearch Safe Client ========== */

export class OpenSearchClient {
  constructor(
    private baseUrl: string = process.env.OPENSEARCH_URL ||
      "http://localhost:9200",
  ) {
    // TODO: Implement
  }

  /**
   * Ensure index exists (non-destructive)
   */
  async ensureIndex(
    index: string,
    mapping?: any,
  ): Promise<{ created: boolean; exists: boolean }> {
    try {
      // Check if index exists
      const headResponse = await fetch(`${this.baseUrl}/${index}`, {
        method: "HEAD",
      });

      if (headResponse.status === 200) {
        return { created: false, exists: true };
      }

      if (headResponse.status === 404) {
        // Create index
        const defaultMapping = mapping || {
          settings: {
            index: {
              number_of_shards: 1,
              number_of_replicas: 0,
            },
          },
          mappings: {
            dynamic: false,
            properties: {
              chunk_id: { type: "keyword" },
              doc_id: { type: "keyword" },
              content: { type: "text" },
              title: { type: "text" },
              _path: { type: "keyword" },
            },
          },
        };

        const createResponse = await fetch(`${this.baseUrl}/${index}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(defaultMapping),
        });

        if (!createResponse.ok) {
          const error = await createResponse.text();
          throw new Error(`Failed to create index: ${error}`);
        }

        return { created: true, exists: true };
      }

      throw new Error(
        `Unexpected status checking index: ${headResponse.status}`,
      );
    } catch (error) {
      console.error(`OpenSearch ensureIndex error:`, error);
      throw error;
    }
  }

  /**
   * Upsert documents (create or update)
   */
  async upsertDocs(
    index: string,
    docs: Doc[],
  ): Promise<{ upserted: number; errors: number }> {
    if (!docs.length) return { upserted: 0, errors: 0 };

    try {
      const body: string[] = [];

      for (const doc of docs) {
        const id = doc.id || doc.chunk_id || doc.doc_id || crypto.randomUUID();
        body.push(JSON.stringify({ index: { _index: index, _id: id } }));
        body.push(JSON.stringify(doc));
      }

      const response = await fetch(`${this.baseUrl}/_bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/x-ndjson" },
        body: body.join("\n") + "\n",
      });

      if (!response.ok) {
        throw new Error(`Bulk upsert failed: ${response.status}`);
      }

      const result = await response.json();
      const errors = result.errors
        ? result.items.filter((_item: any) => _item.index?.error).length
        : 0;

      return {
        upserted: docs.length - errors,
        errors,
      };
    } catch (error) {
      console.error(`OpenSearch upsertDocs error:`, error);
      throw error;
    }
  }

  /**
   * Delete documents
   */
  async deleteDocs(
    index: string,
    ids: string[],
  ): Promise<{ deleted: number; errors: number }> {
    if (!ids.length) return { deleted: 0, errors: 0 };

    try {
      const body: string[] = [];

      for (const id of ids) {
        body.push(JSON.stringify({ delete: { _index: index, _id: id } }));
      }

      const response = await fetch(`${this.baseUrl}/_bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/x-ndjson" },
        body: body.join("\n") + "\n",
      });

      if (!response.ok) {
        throw new Error(`Bulk delete failed: ${response.status}`);
      }

      const result = await response.json();
      const errors = result.errors
        ? result.items.filter((_item: any) => _item.delete?.error).length
        : 0;

      return {
        deleted: ids.length - errors,
        errors,
      };
    } catch (error) {
      console.error(`OpenSearch deleteDocs error:`, error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getStats(index: string): Promise<{ docs: number; size: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/${index}/_stats`);
      if (!response.ok) {
        return { docs: 0, size: 0 };
      }

      const stats = await response.json();
      const indexStats = stats.indices?.[index];

      return {
        docs: indexStats?.primaries?.docs?.count || 0,
        size: indexStats?.primaries?.store?.size_in_bytes || 0,
      };
    } catch (error) {
      console.warn(`Failed to get OpenSearch stats:`, error);
      return { docs: 0, size: 0 };
    }
  }
}

/* ========== Qdrant Safe Client ========== */

export class QdrantClient {
  constructor(
    private baseUrl: string = process.env.QDRANT_URL || "http://localhost:6333",
  ) {
    // TODO: Implement
  }

  /**
   * Ensure collection exists (non-destructive)
   */
  async ensureCollection(
    collection: string,
    dimension: number = 768,
  ): Promise<{ created: boolean; exists: boolean }> {
    try {
      // Check if collection exists
      const getResponse = await fetch(
        `${this.baseUrl}/collections/${collection}`,
      );

      if (getResponse.status === 200) {
        return { created: false, exists: true };
      }

      if (getResponse.status === 404) {
        // Create collection
        const config = {
          vectors: {
            size: dimension,
            distance: "Cosine",
          },
        };

        const createResponse = await fetch(
          `${this.baseUrl}/collections/${collection}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
          },
        );

        if (!createResponse.ok) {
          const error = await createResponse.text();
          throw new Error(`Failed to create collection: ${error}`);
        }

        return { created: true, exists: true };
      }

      throw new Error(
        `Unexpected status checking collection: ${getResponse.status}`,
      );
    } catch (error) {
      console.error(`Qdrant ensureCollection error:`, error);
      throw error;
    }
  }

  /**
   * Upsert points (vectors)
   */
  async upsertPoints(
    collection: string,
    points: Point[],
  ): Promise<{ upserted: number; errors: number }> {
    if (!points.length) return { upserted: 0, errors: 0 };

    try {
      const response = await fetch(
        `${this.baseUrl}/collections/${collection}/points?wait=true`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to upsert points: ${error}`);
      }

      const result = await response.json();

      return {
        upserted: result.result?.operation_id ? points.length : 0,
        errors: 0,
      };
    } catch (error) {
      console.error(`Qdrant upsertPoints error:`, error);
      return { upserted: 0, errors: points.length };
    }
  }

  /**
   * Delete points
   */
  async deletePoints(
    collection: string,
    ids: (string | number)[],
  ): Promise<{ deleted: number; errors: number }> {
    if (!ids.length) return { deleted: 0, errors: 0 };

    try {
      const response = await fetch(
        `${this.baseUrl}/collections/${collection}/points/delete?wait=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: ids }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete points: ${error}`);
      }

      return {
        deleted: ids.length,
        errors: 0,
      };
    } catch (error) {
      console.error(`Qdrant deletePoints error:`, error);
      return { deleted: 0, errors: ids.length };
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(
    collection: string,
  ): Promise<{ vectors: number; dimensions: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/collections/${collection}`);
      if (!response.ok) {
        return { vectors: 0, dimensions: 0 };
      }

      const data = await response.json();

      return {
        vectors: data.result?.vectors_count || 0,
        dimensions: data.result?.config?.params?.vectors?.size || 0,
      };
    } catch (error) {
      console.warn(`Failed to get Qdrant stats:`, error);
      return { vectors: 0, dimensions: 0 };
    }
  }
}

/* ========== Neo4j Safe Client ========== */

export class Neo4jClient {
  private driver: Driver | null = null;

  constructor(
    private uri: string = process.env.NEO4J_URL || "bolt://localhost:7687",
    private user: string = process.env.NEO4J_USER || "neo4j",
    private password: string = process.env.NEO4J_PASSWORD || "testpass",
  ) {
    // TODO: Implement
  }

  /**
   * Get or create driver connection
   */
  private getDriver(): Driver {
    if (!this.driver) {
      this.driver = neo4j.driver(
        this.uri,
        neo4j.auth.basic(this.user, this.password),
      );
    }
    return this.driver;
  }

  /**
   * Ensure schema exists (constraints and indexes)
   */
  async ensureSchema(): Promise<{ created: boolean; constraints: string[] }> {
    const session = this.getDriver().session();
    const constraints: string[] = [];

    try {
      // Create constraints (IF NOT EXISTS in Neo4j 4.4+)
      const constraintQueries = [
        `CREATE CONSTRAINT doc_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE`,
        `CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (p:Paragraph) REQUIRE p.chunk_id IS UNIQUE`,
        `CREATE CONSTRAINT topic_name IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE`,
        `CREATE CONSTRAINT file_path IF NOT EXISTS FOR (f:File) REQUIRE f.path IS UNIQUE`,
        `CREATE CONSTRAINT class_name IF NOT EXISTS FOR (c:Class) REQUIRE (c.name, c.file) IS UNIQUE`,
        `CREATE CONSTRAINT function_name IF NOT EXISTS FOR (fn:Function) REQUIRE (fn.name, fn.file) IS UNIQUE`,
      ];

      for (const query of constraintQueries) {
        try {
          await session.run(query);
          constraints.push(query.match(/FOR \(.*:(\w+)\)/)?.[1] || "unknown");
        } catch (error: any) {
          // Constraint might already exist, which is fine
          if (!error.message?.includes("already exists")) {
            console.warn(`Failed to create constraint:`, error.message);
          }
        }
      }

      // Create indexes
      const indexQueries = [
        `CREATE INDEX doc_title IF NOT EXISTS FOR (d:Document) ON (d.title)`,
        `CREATE INDEX file_language IF NOT EXISTS FOR (f:File) ON (f.language)`,
        `CREATE INDEX function_complexity IF NOT EXISTS FOR (fn:Function) ON (fn.complexity)`,
      ];

      for (const query of indexQueries) {
        try {
          await session.run(query);
        } catch (error: any) {
          if (!error.message?.includes("already exists")) {
            console.warn(`Failed to create index:`, error.message);
          }
        }
      }

      return { created: constraints.length > 0, constraints };
    } finally {
      await session.close();
    }
  }

  /**
   * Apply differential updates (upserts and deletes)
   */
  async applyDiff(
    upserts: GraphNode[],
    deletes?: {
      paragraphIds?: string[];
      documentIds?: string[];
      fileIds?: string[];
    },
  ): Promise<{ upserted: number; deleted: number }> {
    const session = this.getDriver().session();
    let upsertCount = 0;
    let deleteCount = 0;

    try {
      // Perform upserts
      if (upserts.length > 0) {
        const result = await session.run(
          `
          UNWIND $rows AS r
          MERGE (d:Document {id: r.doc_id})
            ON CREATE SET 
              d.title = r.title,
              d._path = r._path,
              d.created = timestamp()
            ON MATCH SET
              d.title = COALESCE(r.title, d.title),
              d._path = COALESCE(r._path, d._path),
              d.updated = timestamp()
          WITH d, r
          WHERE r.chunk_id IS NOT NULL
          MERGE (p:Paragraph {chunk_id: r.chunk_id})
            ON CREATE SET
              p.content = r.content,
              p.created = timestamp()
            ON MATCH SET
              p.content = COALESCE(r.content, p.content),
              p.updated = timestamp()
          MERGE (p)-[:DERIVED_FROM]->(d)
          RETURN count(DISTINCT d) as docs, count(DISTINCT p) as chunks
        `,
          { rows: upserts },
        );

        const summary = result.records[0];
        upsertCount =
          (summary?.get("docs") || 0) + (summary?.get("chunks") || 0);
      }

      // Perform deletes
      if (deletes?.paragraphIds?.length) {
        const result = await session.run(
          `
          UNWIND $ids AS id
          MATCH (p:Paragraph {chunk_id: id})
          DETACH DELETE p
          RETURN count(p) as deleted
        `,
          { ids: deletes.paragraphIds },
        );

        deleteCount += result.records[0]?.get("deleted") || 0;
      }

      if (deletes?.documentIds?.length) {
        const result = await session.run(
          `
          UNWIND $ids AS id
          MATCH (d:Document {id: id})
          DETACH DELETE d
          RETURN count(d) as deleted
        `,
          { ids: deletes.documentIds },
        );

        deleteCount += result.records[0]?.get("deleted") || 0;
      }

      if (deletes?.fileIds?.length) {
        const result = await session.run(
          `
          UNWIND $ids AS id
          MATCH (f:File {_path: id})
          DETACH DELETE f
          RETURN count(f) as deleted
        `,
          { ids: deletes.fileIds },
        );

        deleteCount += result.records[0]?.get("deleted") || 0;
      }

      return { upserted: upsertCount, deleted: deleteCount };
    } finally {
      await session.close();
    }
  }

  /**
   * Create code graph nodes and relationships
   */
  async createCodeGraph(
    files: any[],
    dependencies: any[],
  ): Promise<{ nodes: number; edges: number }> {
    const session = this.getDriver().session();

    try {
      // Create file nodes
      const fileResult = await session.run(
        `
        UNWIND $files AS f
        MERGE (file:File {_path: f.path})
          SET file.language = f.language,
              file.size = f.size,
              file.hash = f.hash,
              file.lastModified = f.lastModified
        RETURN count(file) as count
      `,
        { files },
      );

      const nodeCount = fileResult.records[0]?.get("count") || 0;

      // Create dependency relationships
      const depResult = await session.run(
        `
        UNWIND $deps AS d
        MATCH (from:File {_path: d.from})
        MERGE (to:File {_path: d.to})
        MERGE (from)-[r:IMPORTS]->(to)
          SET r.count = COALESCE(r.count, 0) + d.count
        RETURN count(r) as count
      `,
        { deps: dependencies },
      );

      const edgeCount = depResult.records[0]?.get("count") || 0;

      return { nodes: nodeCount, edges: edgeCount };
    } finally {
      await session.close();
    }
  }

  /**
   * Get graph statistics
   */
  async getStats(): Promise<{
    nodes: number;
    edges: number;
    nodeTypes: Record<string, number>;
  }> {
    const session = this.getDriver().session();

    try {
      // Get node counts by label
      const nodeResult = await session.run(`
        CALL db.labels() YIELD label
        WITH label
        CALL {
          WITH label
          MATCH (n)
          WHERE label IN labels(n)
          RETURN count(n) as count
        }
        RETURN label, count
      `);

      const nodeTypes: Record<string, number> = {};
      let totalNodes = 0;

      nodeResult.records.forEach((record) => {
        const label = record.get("label");
        const count = record.get("count");
        nodeTypes[label] = count;
        totalNodes += count;
      });

      // Get total edge count
      const edgeResult = await session.run(`
        MATCH ()-[r]->()
        RETURN count(r) as count
      `);

      const edges = edgeResult.records[0]?.get("count") || 0;

      return {
        nodes: totalNodes,
        edges,
        nodeTypes,
      };
    } catch (error) {
      console.warn(`Failed to get Neo4j stats:`, error);
      return { nodes: 0, edges: 0, nodeTypes: {} };
    } finally {
      await session.close();
    }
  }

  /**
   * Close driver connection
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }
}

/* ========== Factory Functions ========== */

let openSearchClient: OpenSearchClient | null = null;
let qdrantClient: QdrantClient | null = null;
let neo4jClient: Neo4jClient | null = null;

export function getOpenSearchClient(): OpenSearchClient {
  if (!openSearchClient) {
    openSearchClient = new OpenSearchClient();
  }
  return openSearchClient;
}

export function getQdrantClient(): QdrantClient {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient();
  }
  return qdrantClient;
}

export function getNeo4jClient(): Neo4jClient {
  if (!neo4jClient) {
    neo4jClient = new Neo4jClient();
  }
  return neo4jClient;
}

/**
 * Clean up all connections
 */
export async function closeAllClients(): Promise<void> {
  if (neo4jClient) {
    await neo4jClient.close();
    neo4jClient = null;
  }
  // OpenSearch and Qdrant don't maintain persistent connections
  openSearchClient = null;
  qdrantClient = null;
}
