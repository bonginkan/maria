/**
 * URL Detection Service
 * Automatic URL detection and context analysis for auto-research
 */

import { logger } from "../../utils/logger";
import { BaseService } from "../../internal-mode/core/BaseService";

export interface DetectedURL {
  _url: string;
  originalText: string;
  position: {
    start: number;
    end: number;
  };
  type: "http" | "https" | "ftp" | "file";
  _domain: string;
  _path: string;
  isValid: boolean;
}

export interface ContextAnalysis {
  _conversationTopic: string;
  _userIntent: "research" | "reference" | "share" | "question" | "unknown";
  _urgencyLevel: "immediate" | "normal" | "low";
  _relatedKeywords: string[];
  contextWindow: string[];
  _sentiment: "positive" | "neutral" | "negative";
}

export interface Priority {
  _level: "high" | "medium" | "low";
  _score: number; // 0-100
  _factors: {
    _userIntent: number;
    contextRelevance: number;
    domainTrust: number;
    urgency: number;
    conversationFlow: number;
  };
  _reasoning: string;
}

export class URLDetectionService extends BaseService {
  id = "urldetection-service";
  version = "1.0.0";

  private urlPatterns = [
    // Standard HTTP/HTTPS URLs
    /https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)?/gi,
    // URLs without protocol
    /(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=]*)/gi,
    // Domain-only patterns
    /\b[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}\b/gi,
  ];

  private trustedDomains = new Set([
    "github.com",
    "stackoverflow.com",
    "docs.microsoft.com",
    "developer.mozilla.org",
    "wikipedia.org",
    "arxiv.org",
    "google.com",
    "openai.com",
    "anthropic.com",
    "huggingface.co",
    "techcrunch.com",
    "wired.com",
    "arstechnica.com",
    "theverge.com",
  ]);

  private researchKeywords = [
    "について",
    "について教えて",
    "とは",
    "について調べて",
    "analyze",
    "research",
    "investigate",
    "look into",
    "find out",
    "what is",
    "tell me about",
    "explain",
    "details",
    "information",
  ];

  async initialize(): Promise<void> {
    logger.info("URLDetectionService initialized");
  }

  /**
   * Detect URLs in a message
   */
  detectURLs(message: string): DetectedURL[] {
    const detectedUrls: DetectedURL[] = [];

    for (const pattern of this.urlPatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const _url = match[0];
        const _detectedUrl = this.parseURL(_url, message, match.index);

        if (_detectedUrl && this.isValidURL(_detectedUrl)) {
          // Avoid duplicates
          if (
            !detectedUrls.some(
              (existing) => existing._url === _detectedUrl._url,
            )
          ) {
            detectedUrls.push(_detectedUrl);
          }
        }
      }
      // Reset regex lastIndex for next iteration
      pattern.lastIndex = 0;
    }

    return detectedUrls.sort((a, b) => a.position.start - b.position.start);
  }

  /**
   * Analyze conversation context for URL processing _priority
   */
  analyzeContext(_url: string, conversationHistory: string[]): ContextAnalysis {
    const _recentMessages = conversationHistory.slice(-5); // Last 5 messages
    const _combinedContext = _recentMessages.join(" ").toLowerCase();

    // Detect user intent
    const _userIntent = this.detectUserIntent(_combinedContext, _url);

    // Extract _topic
    const _conversationTopic = this.extractConversationTopic(_recentMessages);

    // Determine urgency
    const _urgencyLevel = this.detectUrgency(_combinedContext);

    // Extract _keywords
    const _relatedKeywords = this.extractKeywords(_combinedContext);

    // Sentiment analysis
    const _sentiment = this.analyzeSentiment(_combinedContext);

    return {
      _conversationTopic,
      _userIntent,
      _urgencyLevel,
      _relatedKeywords,
      contextWindow: _recentMessages,
      _sentiment,
    };
  }

  /**
   * Calculate processing _priority for a URL
   */
  calculatePriority(_url: string, context: ContextAnalysis): Priority {
    const _factors = {
      _userIntent: this.scoreUserIntent(context.userIntent),
      contextRelevance: this.scoreContextRelevance(_url, context),
      domainTrust: this.scoreDomainTrust(_url),
      urgency: this.scoreUrgency(context.urgencyLevel),
      conversationFlow: this.scoreConversationFlow(context),
    };

    // Weighted average
    const _weights = {
      _userIntent: 0.3,
      contextRelevance: 0.25,
      domainTrust: 0.2,
      urgency: 0.15,
      conversationFlow: 0.1,
    };

    const _score = Object.entries(_factors).reduce((sum, [key, value]) => {
      return sum + value * _weights[key as keyof typeof _weights];
    }, 0);

    const _level = _score >= 75 ? "high" : _score >= 50 ? "medium" : "low";

    const _reasoning = this.generatePriorityReasoning(_factors, _score, _level);

    return {
      _level,
      _score: Math.round(_score),
      _factors,
      _reasoning,
    };
  }

  /**
   * Check if a URL should be auto-researched
   */
  shouldAutoResearch(_url: string, context: ContextAnalysis): boolean {
    const _priority = this.calculatePriority(_url, context);

    // Auto-research if:
    // 1. High _priority
    // 2. Medium _priority with explicit research intent
    // 3. URL is in a question context
    return (
      priority.level === "high" ||
      (_priority.level === "medium" && context.userIntent === "research") ||
      context.userIntent === "question"
    );
  }

  // Private helper methods

  private parseURL(
    _url: string,
    originalText: string,
    startPos: number,
  ): DetectedURL | null {
    try {
      // Normalize URL
      let normalizedUrl = _url;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        // Try to determine if it's a valid _domain
        if (this.looksLikeDomain(_url)) {
          normalizedUrl = "https://" + _url;
        } else {
          return null;
        }
      }

      const _parsedUrl = new URL(normalizedUrl);

      return {
        _url: normalizedUrl,
        originalText: _url,
        position: {
          start: startPos,
          end: startPos + url.length,
        },
        type: _parsedUrl.protocol.slice(0, -1) as
          | "http"
          | "https"
          | "ftp"
          | "file",
        _domain: _parsedUrl.hostname,
        _path: _parsedUrl.pathname,
        isValid: true,
      };
    } catch (_error) {
      return null;
    }
  }

  private looksLikeDomain(text: string): boolean {
    // Check if text looks like a _domain (has a dot and valid TLD)
    const _domainPattern =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    return _domainPattern.test(text);
  }

  private isValidURL(detected: DetectedURL): boolean {
    // Basic validation
    if (!detected.domain || detected.domain.length < 3) {
      return false;
    }

    // Check for localhost or private IPs (optional filtering)
    if (
      detected.domain === "localhost" ||
      detected.domain.startsWith("127.") ||
      detected.domain.startsWith("192.168.") ||
      detected.domain.startsWith("10.")
    ) {
      return false;
    }

    return true;
  }

  private detectUserIntent(
    _context: string,
    _url: string,
  ): ContextAnalysis["_userIntent"] {
    const _researchIndicators = [
      "調べて",
      "リサーチ",
      "分析",
      "について教えて",
      "とは",
      "research",
      "analyze",
      "investigate",
      "tell me about",
      "what is",
    ];

    const _questionIndicators = [
      "?",
      "？",
      "how",
      "what",
      "why",
      "when",
      "where",
      "どう",
      "なに",
      "なぜ",
    ];

    const _shareIndicators = [
      "見て",
      "チェック",
      "check out",
      "look at",
      "see this",
    ];

    if (_researchIndicators.some((indicator) => _context.includes(indicator))) {
      return "research";
    }

    if (_questionIndicators.some((indicator) => _context.includes(indicator))) {
      return "question";
    }

    if (_shareIndicators.some((indicator) => _context.includes(indicator))) {
      return "share";
    }

    // If URL is mentioned in context of explanation or reference
    if (
      _context.includes("参考") ||
      _context.includes("reference") ||
      _context.includes("source")
    ) {
      return "reference";
    }

    return "unknown";
  }

  private extractConversationTopic(messages: string[]): string {
    // Simple keyword extraction for _topic identification
    const _allText = messages.join(" ").toLowerCase();

    // Common tech _topics
    const _topics = [
      "ai",
      "artificial intelligence",
      "machine learning",
      "deep learning",
      "programming",
      "development",
      "software",
      "technology",
      "api",
      "database",
      "web development",
      "mobile",
      "cloud",
      "security",
      "business",
      "marketing",
      "finance",
      "healthcare",
      "education",
    ];

    for (const _topic of _topics) {
      if (_allText.includes(_topic)) {
        return _topic;
      }
    }

    // Extract most frequent meaningful _words
    const _words = _allText
      .split(" ")
      .filter((word) => word.length > 3)
      .filter(
        (word) =>
          ![
            "the",
            "and",
            "for",
            "are",
            "but",
            "not",
            "you",
            "all",
            "can",
            "had",
            "her",
            "was",
            "one",
            "our",
            "out",
            "day",
            "get",
            "has",
            "him",
            "his",
            "how",
            "its",
            "may",
            "new",
            "now",
            "old",
            "see",
            "two",
            "who",
            "boy",
            "did",
            "have",
            "let",
            "put",
            "say",
            "she",
            "too",
            "use",
          ].includes(word),
      );

    // Return most common word as _topic
    const _wordCount = _words.reduce(
      (acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const _topWord = Object.entries(_wordCount).sort(
      ([, a], [, b]) => b - a,
    )[0];

    return _topWord ? _topWord[0] : "general";
  }

  private detectUrgency(context: string): ContextAnalysis["_urgencyLevel"] {
    const _urgentIndicators = [
      "急いで",
      "今すぐ",
      "urgent",
      "asap",
      "immediately",
      "quickly",
      "fast",
    ];
    const _normalIndicators = [
      "できるだけ早く",
      "when you can",
      "please",
      "could you",
    ];

    if (_urgentIndicators.some((indicator) => context.includes(indicator))) {
      return "immediate";
    }

    if (_normalIndicators.some((indicator) => context.includes(indicator))) {
      return "normal";
    }

    return "low";
  }

  private extractKeywords(context: string): string[] {
    // Simple keyword extraction
    const _words = context
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter(
        (word) =>
          ![
            "this",
            "that",
            "with",
            "have",
            "will",
            "been",
            "from",
            "they",
            "know",
            "want",
            "were",
            "said",
            "each",
            "which",
            "their",
            "time",
            "would",
            "there",
            "could",
            "other",
            "make",
            "what",
            "only",
            "over",
            "think",
            "also",
            "back",
            "after",
            "first",
            "well",
            "good",
            "just",
            "where",
            "most",
            "some",
            "take",
          ].includes(word.toLowerCase()),
      );

    // Get top 5 most frequent _words
    const _wordCount = _words.reduce(
      (acc, word) => {
        const _lowerWord = word.toLowerCase();
        acc[_lowerWord] = (acc[_lowerWord] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(_wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  private analyzeSentiment(context: string): ContextAnalysis["_sentiment"] {
    const _positiveWords = [
      "good",
      "great",
      "excellent",
      "amazing",
      "awesome",
      "love",
      "like",
      "best",
      "perfect",
      "wonderful",
      "良い",
      "素晴らしい",
      "最高",
      "好き",
    ];
    const _negativeWords = [
      "bad",
      "terrible",
      "awful",
      "hate",
      "worst",
      "horrible",
      "sucks",
      "problem",
      "_error",
      "悪い",
      "だめ",
      "問題",
      "エラー",
    ];

    const _positiveCount = _positiveWords.filter((word) =>
      context.includes(word),
    ).length;
    const _negativeCount = _negativeWords.filter((word) =>
      context.includes(word),
    ).length;

    if (_positiveCount > _negativeCount) return "positive";
    if (_negativeCount > _positiveCount) return "negative";
    return "neutral";
  }

  private scoreUserIntent(intent: ContextAnalysis["_userIntent"]): number {
    switch (intent) {
      case "research":
        return 100;
      case "question":
        return 85;
      case "reference":
        return 60;
      case "share":
        return 40;
      default:
        return 30;
    }
  }

  private scoreContextRelevance(
    _url: string,
    context: ContextAnalysis,
  ): number {
    const _domain = new URL(_url).hostname.toLowerCase();
    const _topic = context.conversationTopic.toLowerCase();
    const _keywords = context.relatedKeywords.join(" ").toLowerCase();

    let _score = 50; // Base _score

    // Check if _domain relates to conversation _topic
    if (_domain.includes(_topic) || _topic.includes(_domain.split(".")[0])) {
      _score += 30;
    }

    // Check if URL _domain appears in context
    if (
      _keywords.includes(_domain) ||
      _keywords.includes(_domain.split(".")[0])
    ) {
      _score += 20;
    }

    return Math.min(100, _score);
  }

  private scoreDomainTrust(_url: string): number {
    try {
      const _domain = new URL(_url).hostname.toLowerCase();

      // Trusted domains get high scores
      if (this.trustedDomains.has(_domain)) {
        return 100;
      }

      // Well-known TLDs get moderate scores
      const _tld = _domain.split(".").pop();
      const _trustedTlds = ["com", "org", "edu", "gov", "net"];
      if (_trustedTlds.includes(_tld || "")) {
        return 70;
      }

      // Default _score for unknown domains
      return 50;
    } catch {
      return 20;
    }
  }

  private scoreUrgency(urgency: ContextAnalysis["_urgencyLevel"]): number {
    switch (urgency) {
      case "immediate":
        return 100;
      case "normal":
        return 70;
      case "low":
        return 40;
      default:
        return 50; // Default value for unknown urgency levels
    }
  }

  private scoreConversationFlow(context: ContextAnalysis): number {
    // Higher _score if URL is part of natural conversation flow
    const _windowSize = context.contextWindow.length;
    if (_windowSize > 3) return 80; // Active conversation
    if (_windowSize > 1) return 60; // Some context
    return 40; // Minimal context
  }

  private generatePriorityReasoning(
    _factors: Priority["_factors"],
    _score: number,
    _level: string,
  ): string {
    const _topFactors = Object.entries(_factors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([key, value]) => `${key}: ${value}`);

    return `Priority: ${_level} (${_score}/100) - Top _factors: ${_topFactors.join(", ")}`;
  }
}
