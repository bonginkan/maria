# Statement of Work (SOW) - Graph RAG 10T POC

## プロジェクト概要

**プロジェクト名**: Graph RAG 10T POC  
**プロジェクトコード**: POC-GR10T-2025  
**期間**: 4週間（2025年1月〜2月）  
**目的**: エンタープライズ向け10TB規模対応可能なGraph RAGシステムのPOC実装

### ビジネス目標
- SharePoint/Box/DBから大規模データを統合検索
- BM25+Vector+Knowledge Graphによるハイブリッド検索の実現
- 出典付き回答と根拠の可視化
- p95レイテンシ < 1.8秒の実現

---

## 技術アーキテクチャ

### コア技術スタック
- **全文検索**: OpenSearch (BM25)
- **ベクトル検索**: Qdrant (HNSW/IVF-PQ)
- **Knowledge Graph**: Neo4j
- **Runtime**: Node.js 20+ (Native fetch API)
- **Container**: Docker Compose

### データフロー
```
外部データソース → Parser/OCR → Chunker → Triple Index
                                    ↓
                         [BM25] [Vector] [Graph]
                                    ↓
                          Hybrid Retrieval (RRF)
                                    ↓
                          LLM Orchestration
                                    ↓
                          Answer + Citations
```

---

## 実装スコープ

### Week 1: データ取り込み基盤
#### 成果物
- [ ] SharePointコネクタ (`src/connectors/sharepoint.js`)
  - OAuth2認証実装
  - Delta API対応
  - メタデータ抽出
  
- [ ] Boxコネクタ (`src/connectors/box.js`)
  - OAuth2/JWT認証
  - フォルダ再帰取得
  - ACL情報保持

- [ ] DBコネクタ (`src/connectors/database.js`)
  - PostgreSQL/SQL Server対応
  - カーソルベース取得
  - スキーマ自動検出

- [ ] Parser実装 (`src/parsers/`)
  - PDF/DOCX/PPTX/Excel対応
  - OCR統合（Tesseract）
  - 構造化データ抽出

- [ ] Chunker実装 (`src/parsers/chunker.js`)
  - 1-2k tokensチャンク分割
  - SimHash重複排除
  - チャンクID生成

#### 受け入れ基準
- 3つのデータソースから取り込み成功
- 5種類のファイル形式をパース可能
- チャンク重複率 < 5%

### Week 2: インデックス構築
#### 成果物
- [ ] OpenSearchインデクサ (`src/indexers/opensearch.js`)
  - マッピング定義
  - 日本語アナライザ設定
  - バルクインデックス実装

- [ ] Qdrantインデクサ (`src/indexers/qdrant.js`)
  - コレクション作成
  - ベクトル投入（バッチ処理）
  - メタデータフィルタ設定

- [ ] Neo4j KG構築 (`src/kg/builder.js`)
  - Core-KGスキーマ定義
  - Doc-subgraph生成
  - 関係性エッジ抽出

#### 受け入れ基準
- 1000件以上のドキュメント索引化
- KGノード数 > 5000
- インデックス構築時間 < 30分

### Week 3: 検索・統合層
#### 成果物
- [ ] Hybrid Retriever (`src/search/hybrid.js`)
  - BM25+Vector融合（RRF）
  - KGブースト実装
  - Cross-Encoder reranking

- [ ] ACLフィルタ (`src/search/acl-filter.js`)
  - ユーザー権限チェック
  - グループ権限展開
  - 監査ログ出力

- [ ] 検索API (`src/api/search.js`)
  - REST/GraphQLエンドポイント
  - ストリーミング対応
  - エラーハンドリング

- [ ] 検索UI (`src/ui/search-app.html`)
  - シンプルなWeb UI
  - 出典ハイライト表示
  - フィードバック収集

#### 受け入れ基準
- p95レイテンシ < 1.8秒
- 出典付き回答3件以上表示
- ACL違反ゼロ

### Week 4: 評価・最適化
#### 成果物
- [ ] Golden Test Suite (`tests/golden/`)
  - 30問のテストクエリ
  - nDCG@10/MRR測定
  - A/Bテスト実装

- [ ] パフォーマンス最適化
  - インデックスチューニング
  - キャッシュ戦略
  - 並列処理最適化

- [ ] ドキュメント
  - 運用手順書
  - API仕様書
  - トラブルシューティングガイド

#### 受け入れ基準
- nDCG@10 > 0.7
- MRR > 0.6
- 全テストケース合格

---

## プロジェクト体制

### 役割分担
- **プロジェクトリード**: 全体設計・進捗管理
- **バックエンド開発**: コネクタ・インデクサ実装
- **インフラ**: Docker環境構築・チューニング
- **QA**: テスト設計・実行

### コミュニケーション
- 日次スタンドアップ: 10:00
- 週次レビュー: 金曜 15:00
- Slackチャンネル: #poc-graph-rag

---

## リスク管理

### 技術リスク
| リスク | 影響度 | 対策 |
|--------|--------|------|
| 10TB規模でのパフォーマンス劣化 | 高 | 段階的スケール検証、インデックス分割 |
| 日本語処理の精度不足 | 中 | 複数アナライザの比較評価 |
| KG構築の計算コスト | 中 | 増分更新、バッチ処理最適化 |

### 運用リスク
| リスク | 影響度 | 対策 |
|--------|--------|------|
| データソースAPI制限 | 低 | レート制限実装、リトライ戦略 |
| ストレージ容量不足 | 中 | 容量監視、アーカイブ戦略 |

---

## 成果物一覧

### コード成果物
```
poc-graph-rag-10t/
├── src/
│   ├── connectors/      # データソース接続
│   ├── parsers/         # ファイル解析
│   ├── indexers/        # インデックス構築
│   ├── search/          # 検索実装
│   ├── kg/              # Knowledge Graph
│   └── api/             # API層
├── scripts/             # 運用スクリプト
├── tests/               # テストスイート
├── config/              # 設定ファイル
└── docs/                # ドキュメント
```

### ドキュメント成果物
1. アーキテクチャ設計書
2. API仕様書（OpenAPI 3.0）
3. 運用手順書
4. パフォーマンスレポート
5. セキュリティ評価書

---

## 予算・リソース

### インフラコスト（月額見積）
- OpenSearch: 2GB RAM × 3ノード
- Qdrant: 4GB RAM × 2ノード  
- Neo4j: 4GB RAM × 1ノード
- ストレージ: 500GB SSD

### 開発環境要件
- Docker Desktop 4.0+
- Node.js 20.10+
- メモリ: 16GB以上推奨
- ストレージ: 100GB以上

---

## 成功指標（KPI）

### 技術指標
- ✅ p95レイテンシ < 1.8秒
- ✅ nDCG@10 > 0.7
- ✅ MRR > 0.6
- ✅ インデックスサイズ < 元データの1.5倍
- ✅ 可用性 > 99.5%

### ビジネス指標
- ✅ 3つ以上のデータソース統合
- ✅ 5000件以上のドキュメント処理
- ✅ 日英バイリンガル対応
- ✅ 出典付き回答率 > 90%

---

## タイムライン

### Week 1 (1/27 - 1/31)
- Day 1-2: 環境構築、コネクタ実装開始
- Day 3-4: Parser/OCR実装
- Day 5: Chunker実装、Week 1レビュー

### Week 2 (2/3 - 2/7)
- Day 1-2: OpenSearchインデクサ
- Day 3-4: Qdrantインデクサ
- Day 5: Neo4j KG構築、Week 2レビュー

### Week 3 (2/10 - 2/14)
- Day 1-2: Hybrid Retriever実装
- Day 3: ACLフィルタ実装
- Day 4-5: API/UI実装、Week 3レビュー

### Week 4 (2/17 - 2/21)
- Day 1-2: Golden Test実装・実行
- Day 3-4: パフォーマンス最適化
- Day 5: 最終デモ、納品

---

## 契約条件

### 納品条件
- ソースコード一式（GitHubリポジトリ）
- ドキュメント一式
- テストデータ・結果
- 30日間の技術サポート

### 支払条件
- 着手時: 30%
- Week 2完了時: 30%
- 最終納品時: 40%

### 保証事項
- 納品後30日間のバグ修正
- パフォーマンス基準達成保証
- セキュリティ脆弱性対応

---

## 次のステップ

1. **承認後即時**
   - プロジェクトキックオフ
   - 開発環境セットアップ
   - データソースアクセス権限取得

2. **Day 1-3**
   - Docker環境構築
   - 基本コネクタ実装
   - CI/CDパイプライン設定

3. **継続的**
   - 日次進捗報告
   - 週次デモ実施
   - リスク早期発見・対処

---

## 連絡先

**プロジェクトマネージャー**: [担当者名]  
**技術リード**: [担当者名]  
**緊急連絡先**: [電話番号]  
**Slack**: #poc-graph-rag  
**Email**: poc-graph-rag@example.com

---

*このSOWは2025年1月時点のものです。プロジェクト進行に応じて更新される場合があります。*