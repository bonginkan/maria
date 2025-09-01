import { EventEmitter } from "node:events";
import OpenAI from "openai";

// Note: Web Speech API types are not needed in CLI environment
// Speech recognition in CLI uses Whisper API instead

export interface SpeechRecognitionConfig {
  provider: "whisper" | "web-speech" | "auto";
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  apiKey?: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language?: string;
  isFinal: boolean;
  alternatives?: Array<{
    text: string;
    confidence: number;
  }>;
}

export class SpeechRecognitionService extends EventEmitter {
  private config: SpeechRecognitionConfig;
  private openai: OpenAI | null = null;
  private isListening: boolean = false;

  constructor(config?: Partial<SpeechRecognitionConfig>) {
    super();
    this.config = {
      provider: "auto",
      language: "en-US",
      continuous: false,
      interimResults: true,
      maxAlternatives: 3,
      ...config,
    };

    this.initializeProvider();
  }

  /**
   * Initialize the speech recognition provider
   */
  private initializeProvider(): void {
    if (this.config.provider === "whisper" || this.config.provider === "auto") {
      if (this.config.apiKey || process.env["OPENAI_API_KEY"]) {
        this.openai = new OpenAI({
          apiKey: this.config.apiKey || process.env["OPENAI_API_KEY"],
        });
      }
    }

    // Web Speech API is only available in browser environment
    // In Node.js environment, we'll use Whisper API instead
  }

  /**
   * Transcribe audio buffer using Whisper API
   */
  async transcribeWithWhisper(
    audioBuffer: Buffer,
  ): Promise<TranscriptionResult> {
    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      this.emit("processing-started");

      // Convert buffer to File-like object for OpenAI SDK
      const _audioFile = new File([audioBuffer], "audio.wav", {
        type: "audio/wav",
      });

      const _response = await this.openai.audio.transcriptions.create({
        file: _audioFile,
        model: "whisper-1",
        language: this.config.language.split("-")[0], // Extract language code
        responseformat: "verbose_json",
      });

      const result: TranscriptionResult = {
        text: _response.text,
        confidence: 1.0, // Whisper doesn't provide confidence scores
        language: _response.language,
        isFinal: true,
      };

      this.emit("transcription", result);
      this.emit("processing-completed");

      return result;
    } catch (_error) {
      this.emit("_error", _error);
      this.emit("processing-completed");
      throw _error;
    }
  }

  /**
   * Start listening using Web Speech API
   */
  startListening(): void {
    // Web Speech API is not available in CLI environment
    // Use Whisper API for speech recognition instead
    throw new Error(
      "Web Speech API not available in CLI environment. Use transcribe() method with audio buffer instead.",
    );
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    this.isListening = false;
    this.emit("listening-stopped");
  }

  /**
   * Transcribe audio buffer (auto-select provider)
   */
  async transcribe(audioBuffer: Buffer): Promise<TranscriptionResult> {
    // For Node.js environment, use Whisper
    if (this.openai) {
      return this.transcribeWithWhisper(audioBuffer);
    }

    throw new Error("No speech recognition provider available");
  }

  /**
   * Process audio stream in real-time
   */
  async processAudioStream(audioChunk: Buffer): Promise<void> {
    // This would require streaming API support
    // For now, accumulate chunks and process when complete
    this.emit("audio-chunk-received", audioChunk.length);
  }

  /**
   * Set recognition language
   */
  setLanguage(language: string): void {
    this.config.language = language;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return [
      "en-US", // English (US)
      "en-GB", // English (UK)
      "ja-JP", // Japanese
      "zh-CN", // Chinese (Simplified)
      "zh-TW", // Chinese (Traditional)
      "es-ES", // Spanish
      "fr-FR", // French
      "de-DE", // German
      "it-IT", // Italian
      "pt-BR", // Portuguese (Brazil)
      "ru-RU", // Russian
      "ko-KR", // Korean
      "ar-SA", // Arabic
      "hi-IN", // Hindi
      "nl-NL", // Dutch
    ];
  }

  /**
   * Detect language from audio
   */
  async detectLanguage(audioBuffer: Buffer): Promise<string> {
    if (!this.openai) {
      throw new Error("Language detection requires OpenAI API");
    }

    try {
      const _audioFile = new File([audioBuffer], "audio.wav", {
        type: "audio/wav",
      });

      const _response = await this.openai.audio.transcriptions.create({
        file: _audioFile,
        model: "whisper-1",
        responseformat: "verbose_json",
      });

      return _response.language || "unknown";
    } catch (_error) {
      this.emit("_error", _error);
      throw _error;
    }
  }

  /**
   * Format transcription for display
   */
  formatTranscription(result: TranscriptionResult): string {
    let formatted = result.text;

    // Add punctuation if missing
    if (!/[.!?]$/.test(formatted)) {
      formatted += ".";
    }

    // Capitalize first letter
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    return formatted;
  }

  /**
   * Get recognition status
   */
  getStatus(): {
    isListening: boolean;
    provider: string;
    language: string;
  } {
    return {
      isListening: this.isListening,
      provider: this.openai ? "whisper" : "none",
      language: this.config.language,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopListening();
    this.removeAllListeners();
    this.openai = null;
  }
}

// Singleton instance
export const _speechRecognition = new SpeechRecognitionService();

// Helper function to convert audio buffer to WAV format
export function bufferToWav(
  _buffer: Buffer,
  sampleRate: number = 16000,
): Buffer {
  const _length = _buffer._length;
  const _arrayBuffer = new ArrayBuffer(44 + _length);
  const _view = new DataView(_arrayBuffer);

  // WAV header
  const _writeString = (_offset: number, string: string) => {
    for (let i = 0; i < string._length; i++) {
      view.setUint8(_offset + i, string.charCodeAt(i));
    }
  };

  _writeString(0, "RIFF");
  view.setUint32(4, 36 + _length, true);
  _writeString(8, "WAVE");
  _writeString(12, "fmt ");
  _view.setUint32(16, 16, true); // fmt chunk size
  _view.setUint16(20, 1, true); // PCM format
  _view.setUint16(22, 1, true); // Mono
  _view.setUint32(24, sampleRate, true);
  _view.setUint32(28, sampleRate * 2, true); // Byte rate
  _view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  _writeString(36, "data");
  view.setUint32(40, _length, true);

  // Copy audio data
  const _audioData = new Uint8Array(_arrayBuffer, 44);
  audioData.set(new Uint8Array(_buffer));

  return Buffer.from(_arrayBuffer);
}
