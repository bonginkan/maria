import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

export interface AuditEntry {
  ts: string; // ISO timestamp
  tenantId: string;
  userId: string;
  action: string; // 'project:update' など
  resource: string; // 'project:123'
  details?: Record<string, unknown>;
}

export interface AuditRecord extends AuditEntry {
  _prev?: string; // 前レコードのHMAC
  _hmac: string; // 現レコードのHMAC
}

export class AuditLogger {
  constructor(
    private file: string,
    private key: Buffer,
  ) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  private _hmac(data: string): string {
    return crypto.createHmac("sha256", this.key).update(data).digest("hex");
  }

  /** 末尾の HMAC を取得 */
  private getLastHmac(): string | undefined {
    if (!fs.existsSync(this.file)) return undefined;

    const content = fs.readFileSync(this.file, "utf-8").trim();
    if (!content) return undefined;

    const lines = content.split("\n");
    if (!lines.length) return undefined;

    try {
      const last = JSON.parse(lines.at(-1) || "{}");
      return last._hmac;
    } catch {
      return undefined;
    }
  }

  /** エントリを追加してHMACチェーンを更新 */
  append(entry: AuditEntry): AuditRecord {
    const payload = {
      ...entry,
      ts: entry.ts || new Date().toISOString(),
    };

    const _prev = this.getLastHmac();
    const _toMac = JSON.stringify({ ...payload, _prev });
    const _hmac = this._hmac(_toMac);
    const rec: AuditRecord = { ...payload, _prev, _hmac };

    fs.appendFileSync(this.file, JSON.stringify(rec) + "\n");
    return rec;
  }

  /** チェーン整合性を検証 */
  verify(): { ok: boolean; tamperIndex?: number } {
    if (!fs.existsSync(this.file)) return { ok: true };

    const content = fs.readFileSync(this.file, "utf-8").trim();
    if (!content) return { ok: true };

    const lines = content.split("\n").filter(Boolean);
    let _prev: string | undefined;

    for (let i = 0; i < lines.length; i++) {
      try {
        const obj = JSON.parse(lines[i]);
        const { ts, tenantId, userId, action, resource, details } = obj;

        const expectedPayload = {
          ts,
          tenantId,
          userId,
          action,
          resource,
          details,
          _prev,
        };
        const expected = this._hmac(JSON.stringify(expectedPayload));

        if (expected !== obj._hmac) {
          return { ok: false, tamperIndex: i };
        }

        _prev = obj._hmac;
      } catch (error) {
        return { ok: false, tamperIndex: i };
      }
    }

    return { ok: true };
  }

  /** 全エントリを読み取り */
  readAll(): AuditRecord[] {
    if (!fs.existsSync(this.file)) return [];

    const content = fs.readFileSync(this.file, "utf-8").trim();
    if (!content) return [];

    const lines = content.split("\n").filter(Boolean);
    return lines.map((line) => JSON.parse(line));
  }

  /** 特定のテナントのエントリのみを取得 */
  readByTenant(tenantId: string): AuditRecord[] {
    return this.readAll().filter((record) => record.tenantId === tenantId);
  }

  /** ファイルサイズと行数の統計 */
  getStats(): {
    fileSize: number;
    recordCount: number;
    oldestRecord?: string;
    newestRecord?: string;
  } {
    if (!fs.existsSync(this.file)) {
      return { fileSize: 0, recordCount: 0 };
    }

    const stats = fs.statSync(this.file);
    const records = this.readAll();

    return {
      fileSize: stats.size,
      recordCount: records.length,
      oldestRecord: records[0]?.ts,
      newestRecord: records[records.length - 1]?.ts,
    };
  }
}
