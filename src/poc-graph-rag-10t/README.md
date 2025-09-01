# Graph RAG 10T POC

エンタープライズ向け10TB規模対応可能なGraph RAGシステムのPOC実装

## 🚀 Quick Start

### 1. 環境準備

```bash
# リポジトリクローン
cd poc-graph-rag-10t

# 環境変数設定
cp .env.poc .env
# .envファイルを編集して必要な認証情報を設定

# Docker環境起動
npm run docker:up

# ヘルスチェック（全サービスが healthy になるまで待つ）
npm run docker:logs
```

### 2. インデックス初期化

```bash
# 各インデックスのセットアップ
npm run setup:all
```

### 3. データ取り込み

```bash
# すべてのデータソースから取り込み
npm run ingest:all

# インデックス構築
npm run index:all
```

### 4. テスト実行

```bash
# Golden Test実行
npm run test:golden

# A/Bテスト（KGブーストあり/なし）
npm run test:golden:ab
```

## 📁 プロジェクト構成

```
poc-graph-rag-10t/
├── src/
│   ├── connectors/          # データソースコネクタ
│   │   ├── sharepoint.js    # SharePoint接続
│   │   ├── box.js          # Box接続
│   │   └── database.js     # DB接続
│   ├── parsers/            # ドキュメント解析
│   │   ├── chunker.js      # チャンク分割
│   │   └── ocr.js          # OCR処理
│   ├── indexers/           # インデックス構築
│   │   ├── opensearch.js   # BM25インデックス
│   │   └── qdrant.js       # ベクトルインデックス
│   ├── kg/                 # Knowledge Graph
│   │   ├── builder.js      # KG構築
│   │   └── schema.js       # スキーマ定義
│   ├── search/             # 検索実装
│   │   ├── hybrid.js       # ハイブリッド検索
│   │   └── acl-filter.js   # ACLフィルタ
│   └── api/                # API層
│       └── search.js       # 検索エンドポイント
├── scripts/                # 運用スクリプト
├── tests/                  # テスト
│   └── golden/            # Golden Test
├── docker-compose.yml     # Docker設定
├── .env.poc              # 環境変数サンプル
└── SOW_GRAPH_RAG_10T_POC.md  # Statement of Work
```

## 🔧 主要コマンド

### Docker管理

```bash
npm run docker:up      # サービス起動
npm run docker:down    # サービス停止
npm run docker:clean   # 完全クリーンアップ
npm run docker:logs    # ログ確認
```

### データ処理

```bash
npm run ingest:sharepoint  # SharePointからデータ取得
npm run ingest:box         # Boxからデータ取得
npm run ingest:db          # DBからデータ取得
npm run index:opensearch   # BM25インデックス構築
npm run index:qdrant       # ベクトルインデックス構築
npm run index:neo4j        # Knowledge Graph構築
```

### テスト

```bash
npm run test:golden        # 基本的なGolden Test
npm run test:golden:ab     # A/Bテスト（nDCG/MRR計測）
npm run benchmark          # パフォーマンスベンチマーク
```

## 🎯 技術スタック

- **全文検索**: OpenSearch (BM25)
- **ベクトル検索**: Qdrant (HNSW/IVF-PQ)
- **Knowledge Graph**: Neo4j
- **Runtime**: Node.js 20+ (Native fetch API)
- **Container**: Docker Compose

## 📊 パフォーマンス目標

- p95レイテンシ < 1.8秒
- nDCG@10 > 0.7
- MRR > 0.6
- 5000件以上のドキュメント処理
- ACL違反ゼロ

## 🔍 検索API仕様

### エンドポイント

```
POST /api/search
```

### リクエスト

```json
{
  "query": "2024年度の売上実績を教えて",
  "topK": 10,
  "kgBoost": true
}
```

### レスポンス

```json
{
  "answer": "2024年度の売上実績は...",
  "sources": [
    {
      "id": "db:sales_2024#row:102",
      "path": "/db/sales",
      "snippet": "FY2024 revenue...",
      "confidence": 0.92
    }
  ],
  "latency_ms": 1234
}
```

## 🚦 動作確認

### 各サービスのUI

- **OpenSearch**: http://localhost:9200
- **OpenSearch Dashboards**: http://localhost:5601
- **Qdrant**: http://localhost:6333/dashboard
- **Neo4j Browser**: http://localhost:7474 (neo4j/testpass)
- **Grafana**: http://localhost:3001 (admin/admin)

### ヘルスチェック

```bash
# OpenSearch
curl http://localhost:9200/_cluster/health

# Qdrant
curl http://localhost:6333/healthz

# Neo4j
curl http://localhost:7474

# PostgreSQL
docker exec postgres-poc pg_isready
```

## 📝 開発タイムライン

- **Week 1**: データ取り込み基盤
- **Week 2**: インデックス構築
- **Week 3**: 検索・統合層
- **Week 4**: 評価・最適化

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. すべてのDockerコンテナが起動しているか
2. `.env`ファイルの設定が正しいか
3. `docker compose logs`でエラーログを確認
4. メモリ不足の場合はDocker Desktopのメモリ割り当てを増やす

## 📄 ライセンス

MIT License