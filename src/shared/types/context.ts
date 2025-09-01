/**
 * Port定義(インターフェース)
 * 副作用を抽象化し、テスト可能にする
 */

export interface ModelInfo {
  id: string;
  provider?: string;
  available?: boolean;
}

export interface ProviderPort {
  list(opts?: { signal?: AbortSignal }): Promise<ModelInfo[]>;
  switch(id: string, opts?: { signal?: AbortSignal }): Promise<void>;
}

export interface MemoryStats {
  l1?: number;
  l2?: number;
  tokens?: number;
}

export interface MemoryPort {
  stats(opts?: { signal?: AbortSignal }): Promise<MemoryStats>;
  clear(opts?: { signal?: AbortSignal }): Promise<void>;
}

export interface ChatPort {
  clear(opts?: { soft?: boolean; signal?: AbortSignal }): Promise<void>;
}

export interface UiPort {
  print(text: string): void;
  writeChunk?(chunk: string): void; // Streaming用(将来)
  startProgress?(label: string): void;
  endProgress?(): void;
}

/**
 * HandlerContext
 * すべてのコマンドハンドラに渡される共通コンテキスト
 */
export interface HandlerContext {
  // セッション情報
  session?: {
    history?: any[];
    id?: string;
  };

  // ユーザー情報
  user?: {
    id?: string;
    name?: string;
  };

  // ポート(副作用の抽象化)
  providers: ProviderPort;
  memory: MemoryPort;
  chat: ChatPort;
  ui?: UiPort;

  // 追加サービス
  services?: Record<string, unknown>;

  // タイムアウト/キャンセル用シグナル(必須)
  signal: AbortSignal;
}

/**
 * ルーターオプション
 */
export interface RouterOptions {
  timebox?: Record<string, number>;
  interactiveAllow?: Set<string>;
  onFinish?: (metrics: RouterMetrics) => void;
}

/**
 * RouterMetrics(observability用)
 */
export interface RouterMetrics {
  command: string;
  latencyMs: number;
  endReason: string;
  ok: boolean;
  errorCode?: string;
}
