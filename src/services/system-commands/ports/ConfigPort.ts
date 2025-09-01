/**
 * ConfigPort
 *
 * 設定管理の抽象化ポート
 * スキーマ検証・階層マージ・マイグレーションの責務を分離
 */

import {
  ValidationResult,
  MigrationResult,
} from "../contracts/SystemCommandContract";

export interface ConfigPort {
  // 基本操作
  get<T = any>(key: string): Promise<T | undefined>;
  set(key: string, value: any, options?: SetOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(prefix?: string): Promise<Record<string, any>>;

  // 階層管理
  getLayered<T = any>(key: string): Promise<LayeredConfig<T>>;
  setLayer(layer: ConfigLayer, key: string, value: any): Promise<void>;

  // 検証・マイグレーション
  validate(config: any, schema?: string): Promise<ValidationResult>;
  migrate(
    fromVersion: string,
    toVersion: string,
    dryRun?: boolean,
  ): Promise<MigrationResult>;

  // テンプレート
  applyTemplate(templateId: string, options?: TemplateOptions): Promise<void>;
  listTemplates(): Promise<ConfigTemplate[]>;

  // 履歴・監査
  getHistory(key?: string, limit?: number): Promise<ConfigHistoryEntry[]>;
  rollback(entryId: string): Promise<void>;

  // メタデータ
  getSchema(key: string): Promise<JSONSchema | undefined>;
  getVersion(): Promise<string>;
}

export interface SetOptions {
  validate?: boolean; // デフォルト: true
  layer?: ConfigLayer; // デフォルト: 'user'
  backup?: boolean; // デフォルト: true
  dryRun?: boolean; // デフォルト: false
}

export type ConfigLayer = "global" | "user" | "project" | "runtime";

export interface LayeredConfig<T> {
  value: T;
  layers: {
    global?: T;
    user?: T;
    project?: T;
    runtime?: T;
  };
  source: ConfigLayer; // どの層から値が来たか
  merged: boolean; // 複数層からマージされたか
}

export interface TemplateOptions {
  overwrite?: boolean; // 既存設定を上書きするか
  dryRun?: boolean;
  variables?: Record<string, any>; // テンプレート変数
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: string; // 'react', 'node', 'typescript', etc.
  variables: TemplateVariable[];
  config: any; // テンプレート設定
}

export interface TemplateVariable {
  name: string;
  type: "string" | "number" | "boolean" | "select";
  description: string;
  required: boolean;
  default?: any;
  options?: any[]; // select型の場合の選択肢
}

export interface ConfigHistoryEntry {
  id: string;
  timestamp: number;
  key: string;
  action: "set" | "delete" | "migrate" | "rollback";
  oldValue?: any;
  newValue?: any;
  layer: ConfigLayer;
  user?: string;
  reason?: string; // 変更理由
  checksum: string; // データ整合性チェック用
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: any;
}

export interface ConfigValidationError {
  path: string;
  message: string;
  expected: any;
  actual: any;
  severity: "error" | "warning";
}
