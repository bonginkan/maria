import { EventEmitter } from 'events';
import { AudioProcessor } from './audio-processor.js';

export interface HotwordConfig {
  hotwords: string[];
  sensitivity: number;
  audioWindowMs: number;
  cooldownMs: number;
  energyThreshold: number;
}

export interface HotwordDetection {
  hotword: string;
  confidence: number;
  timestamp: number;
}

/**
 * Hotword detection service for wake word activation
 */
export class HotwordDetector extends EventEmitter {
  private config: HotwordConfig;
  private audioProcessor: AudioProcessor;
  private isListening: boolean = false;
  private lastDetection: number = 0;
  private audioBuffer: Float32Array[] = [];
  private detectionPatterns: Map<string, RegExp>;

  constructor(config?: Partial<HotwordConfig>) {
    super();
    this.config = {
      hotwords: ['hey maria', 'maria', 'okay maria'],
      sensitivity: 0.5,
      audioWindowMs: 2000,
      cooldownMs: 1000,
      energyThreshold: 0.02,
      ...config,
    };

    this.audioProcessor = new AudioProcessor({
      voiceActivityDetection: true,
      noiseReduction: true,
      vadSensitivity: this.config.sensitivity,
    });

    this.detectionPatterns = new Map();
    this.initializePatterns();
    this.setupAudioProcessing();
  }

  /**
   * Initialize regex patterns for hotword matching
   */
  private initializePatterns(): void {
    for (const hotword of this.config.hotwords) {
      // Create flexible pattern for each hotword
      const pattern = hotword
        .toLowerCase()
        .split(' ')
        .map((word) => {
          // Allow for slight variations in recognition
          const chars = word.split('');
          return chars.map((c) => `[${c}${this.getSimilarChars(c)}]`).join('');
        })
        .join('\\s*');

      this.detectionPatterns.set(hotword, new RegExp(pattern, 'i'));
    }
  }

  /**
   * Get similar sounding characters for fuzzy matching
   */
  private getSimilarChars(char: string): string {
    const similarMap: { [key: string]: string } = {
      a: 'ae@',
      e: 'ea3',
      i: 'ey1',
      o: 'ou0',
      u: 'oo',
      m: 'mn',
      n: 'nm',
      r: 'rl',
      l: 'lr',
    };

    return similarMap[char] || '';
  }

  /**
   * Setup audio processing pipeline
   */
  private setupAudioProcessing(): void {
    this.audioProcessor.on('vad-result', (result) => {
      if (result.isSpeech && result.energy > this.config.energyThreshold) {
        this.processAudioWindow();
      }
    });
  }

  /**
   * Start listening for hotwords
   */
  start(): void {
    if (this.isListening) {
      return;
    }

    this.isListening = true;
    this.audioBuffer = [];
    this.emit('listening-started');
  }

  /**
   * Stop listening for hotwords
   */
  stop(): void {
    if (!this.isListening) {
      return;
    }

    this.isListening = false;
    this.audioBuffer = [];
    this.emit('listening-stopped');
  }

  /**
   * Process audio buffer with transcribed text
   */
  processTranscription(text: string): HotwordDetection | null {
    if (!this.isListening) {
      return null;
    }

    // Check cooldown
    const now = Date.now();
    if (now - this.lastDetection < this.config.cooldownMs) {
      return null;
    }

    const lowerText = text.toLowerCase().trim();

    // Check each hotword pattern
    for (const [hotword, pattern] of this.detectionPatterns) {
      if (pattern.test(lowerText)) {
        // Calculate confidence based on exact match vs fuzzy match
        const exactMatch = lowerText.includes(hotword.toLowerCase());
        const confidence = exactMatch ? 1.0 : 0.7;

        if (confidence >= this.config.sensitivity) {
          this.lastDetection = now;

          const detection: HotwordDetection = {
            hotword,
            confidence,
            timestamp: now,
          };

          this.emit('hotword-detected', detection);
          return detection;
        }
      }
    }

    // Also check for simple substring matching as fallback
    for (const hotword of this.config.hotwords) {
      const hotwordLower = hotword.toLowerCase();
      if (lowerText.includes(hotwordLower)) {
        this.lastDetection = now;

        const detection: HotwordDetection = {
          hotword,
          confidence: 0.9,
          timestamp: now,
        };

        this.emit('hotword-detected', detection);
        return detection;
      }
    }

    return null;
  }

  /**
   * Process audio window for hotword detection
   */
  private processAudioWindow(): void {
    // This would typically involve:
    // 1. Extracting features from audio
    // 2. Running through a trained model
    // 3. Checking for hotword presence

    // For now, we rely on transcription-based detection
    // Real hotword detection would use trained models like:
    // - Snowboy (deprecated)
    // - Porcupine
    // - TensorFlow Lite models

    this.emit('audio-processing', {
      bufferSize: this.audioBuffer.length,
      isListening: this.isListening,
    });
  }

  /**
   * Feed audio data for processing
   */
  feedAudio(audioData: Float32Array): void {
    if (!this.isListening) {
      return;
    }

    this.audioBuffer.push(audioData);

    // Keep only recent audio (based on window size)
    const maxBuffers = Math.floor(((this.config.audioWindowMs / 1000) * 16000) / 512);
    if (this.audioBuffer.length > maxBuffers) {
      this.audioBuffer.shift();
    }
  }

  /**
   * Update hotwords
   */
  setHotwords(hotwords: string[]): void {
    this.config.hotwords = hotwords;
    this.detectionPatterns.clear();
    this.initializePatterns();
    this.emit('hotwords-updated', hotwords);
  }

  /**
   * Set sensitivity
   */
  setSensitivity(sensitivity: number): void {
    this.config.sensitivity = Math.max(0, Math.min(1, sensitivity));
    this.audioProcessor.updateConfig({ vadSensitivity: this.config.sensitivity });
    this.emit('sensitivity-updated', this.config.sensitivity);
  }

  /**
   * Get current configuration
   */
  getConfig(): HotwordConfig {
    return { ...this.config };
  }

  /**
   * Get detection statistics
   */
  getStats(): {
    isListening: boolean;
    lastDetection: number;
    bufferSize: number;
    hotwordCount: number;
  } {
    return {
      isListening: this.isListening,
      lastDetection: this.lastDetection,
      bufferSize: this.audioBuffer.length,
      hotwordCount: this.config.hotwords.length,
    };
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.audioBuffer = [];
    this.lastDetection = 0;
    this.audioProcessor.reset();
    this.emit('reset');
  }
}
