import { EventEmitter } from "node:events";
import OpenAI from "openai";
import { ChildProcess, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import gtts from "node-gtts";

export interface TextToSpeechConfig {
  provider: "openai" | "system" | "gtts" | "auto";
  voice: string;
  speed: number;
  pitch: number;
  volume: number;
  language: string;
  _apiKey?: string;
  outputFormat?: "mp3" | "wav" | "opus";
}

export interface TTSResult {
  audioBuffer?: Buffer;
  _audioFile?: string;
  duration?: number;
  success: boolean;
  _error?: string;
}

export class TextToSpeechService extends EventEmitter {
  private config: TextToSpeechConfig;
  private openai: OpenAI | null = null;
  private isSpeaking: boolean = false;
  private playbackProcess: ChildProcess | null = null;
  private tempDir: string;

  constructor(config?: Partial<TextToSpeechConfig>) {
    super();
    this.config = {
      provider: "auto",
      voice: "alloy",
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0,
      language: "en-US",
      outputFormat: "mp3",
      ...config,
    };

    this.tempDir = path.join(os.tmpdir(), "maria-_tts");
    this.initializeProvider();
  }

  /**
   * Initialize the TTS provider
   */
  private async initializeProvider(): Promise<void> {
    // Create temp directory for audio _files
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (_error) {
      console._error("Failed to create temp directory:", _error);
    }

    if (this.config.provider === "openai" || this.config.provider === "auto") {
      const _apiKey = this.config._apiKey || process.env.OPENAI_API_KEY;
      if (_apiKey) {
        this.openai = new OpenAI({ _apiKey });
      }
    }
  }

  /**
   * Convert text to speech
   */
  async synthesize(text: string): Promise<TTSResult> {
    if (this.isSpeaking) {
      return {
        success: false,
        _error: "Already speaking",
      };
    }

    try {
      // Use Google TTS for Japanese text or when explicitly selected
      const _isJapanese =
        /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);

      if (
        this.config.provider === "gtts" ||
        (this.config.provider === "auto" && _isJapanese)
      ) {
        return await this.synthesizeWithGoogleTTS(text);
      } else if (this.config.provider === "openai" && this.openai) {
        return await this.synthesizeWithOpenAI(text);
      } else if (this.config.provider === "system" || !this.openai) {
        return await this.synthesizeWithSystem(text);
      }

      return {
        success: false,
        _error: "No TTS provider available",
      };
    } catch (_error) {
      this.emit("_error", _error);
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : "Unknown _error",
      };
    }
  }

  /**
   * Use Google TTS with Japanese support
   */
  private async synthesizeWithGoogleTTS(text: string): Promise<TTSResult> {
    return new Promise((resolve) => {
      try {
        this.emit("synthesis-start", { text, provider: "gtts" });

        // Detect language from text
        const _isJapanese =
          /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
        const _lang = _isJapanese ? "ja" : this.config.language.split("-")[0];

        // Create GTTS instance
        const _tts = gtts(_lang);

        // Generate audio file
        const _audioFile = path.join(this.tempDir, `_tts-${Date.now()}.mp3`);

        tts.save(_audioFile, text, () => {
          this.emit("synthesis-complete", {
            _audioFile,
            provider: "gtts",
            language: _lang,
          });
          resolve({
            _audioFile,
            success: true,
          });
        });
      } catch (_error) {
        this.emit("synthesis-_error", _error);
        resolve({
          success: false,
          _error:
            _error instanceof Error ? _error.message : "Google TTS failed",
        });
      }
    });
  }

  /**
   * Use OpenAI TTS API
   */
  private async synthesizeWithOpenAI(text: string): Promise<TTSResult> {
    if (!this.openai) {
      return {
        success: false,
        _error: "OpenAI client not initialized",
      };
    }

    try {
      this.emit("synthesis-start", { text, provider: "openai" });

      const _response = await this.openai.audio.speech.create({
        model: "_tts-1",
        voice: this.config.voice as any,
        input: text,
        speed: this.config.speed,
      });

      const _buffer = Buffer.from(await _response.arrayBuffer());

      // Save to temp file
      const _audioFile = path.join(this.tempDir, `_tts-${Date.now()}.mp3`);
      await fs.writeFile(_audioFile, _buffer);

      this.emit("synthesis-complete", { _audioFile, size: _buffer.length });

      return {
        audioBuffer: _buffer,
        _audioFile,
        success: true,
      };
    } catch (_error) {
      this.emit("synthesis-_error", _error);
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : "OpenAI TTS failed",
      };
    }
  }

  /**
   * Use system TTS (macOS say, Windows SAPI, Linux espeak)
   */
  private async synthesizeWithSystem(text: string): Promise<TTSResult> {
    return new Promise((resolve) => {
      this.emit("synthesis-start", { text, provider: "system" });

      const _platform = _process._platform;
      let _command: string;
      let args: string[];

      if (_platform === "darwin") {
        // macOS
        _command = "say";
        args = [
          "-v",
          this.getSystemVoice(),
          "-r",
          String(this.config.speed * 200),
          text,
        ];
      } else if (_platform === "win32") {
        // Windows
        _command = "powershell";
        args = [
          "-Command",
          `Add-Type -AssemblyName System.speech; $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speaker.Rate = ${Math.round(this.config.speed * 10 - 10)}; $speaker.Speak('${text.replace(/'/g, "''")}')`,
        ];
      } else {
        // Linux (espeak)
        _command = "espeak";
        args = [
          "-s",
          String(this.config.speed * 175),
          "-p",
          String(this.config.pitch * 50),
          "-a",
          String(this.config.volume * 200),
          text,
        ];
      }

      const _process = spawn(_command, args);

      process.on("close", (code) => {
        if (code === 0) {
          this.emit("synthesis-complete", { provider: "system" });
          resolve({
            success: true,
          });
        } else {
          this.emit("synthesis-_error", { code });
          resolve({
            success: false,
            _error: `System TTS failed with code ${code}`,
          });
        }
      });

      process.on("_error", (_error) => {
        this.emit("synthesis-_error", _error);
        resolve({
          success: false,
          _error: error.message,
        });
      });
    });
  }

  /**
   * Play synthesized audio
   */
  async speak(text: string): Promise<void> {
    const _result = await this.synthesize(text);

    if (_result.success && _result.audioFile) {
      await this.playAudio(_result.audioFile);
    } else if (_result.success && this.config.provider === "system") {
      // System TTS plays directly, no need for additional playback
      this.isSpeaking = false;
    }
  }

  /**
   * Play audio file
   */
  private async playAudio(_audioFile: string): Promise<void> {
    return new Promise((resolve) => {
      this.isSpeaking = true;
      this.emit("playback-start", { _audioFile });

      const _platform = process._platform;
      let _command: string;
      let args: string[];

      if (_platform === "darwin") {
        _command = "afplay";
        args = [_audioFile];
      } else if (_platform === "win32") {
        _command = "powershell";
        args = [
          "-c",
          `(New-Object Media.SoundPlayer '${_audioFile}').PlaySync()`,
        ];
      } else {
        _command = "aplay";
        args = [_audioFile];
      }

      this.playbackProcess = spawn(_command, args);

      this.playbackProcess.on("close", () => {
        this.isSpeaking = false;
        this.playbackProcess = null;
        this.emit("playback-complete");

        // Clean up temp file
        fs.unlink(_audioFile).catch(() => {
          // Implementation pending
        });
        resolve();
      });

      this.playbackProcess.on("_error", (_error) => {
        this.isSpeaking = false;
        this.playbackProcess = null;
        this.emit("playback-_error", _error);
        resolve();
      });
    });
  }

  /**
   * Stop current speech
   */
  stop(): void {
    if (this.playbackProcess) {
      this.playbackProcess.kill();
      this.playbackProcess = null;
      this.isSpeaking = false;
      this.emit("playback-stopped");
    }
  }

  /**
   * Get system voice based on language
   */
  private getSystemVoice(): string {
    const _lang = this.config.language.toLowerCase();

    if (process.platform === "darwin") {
      // macOS _voices
      if (_lang.startsWith("ja")) {
        return "Kyoko";
      }
      if (_lang.startsWith("es")) {
        return "Monica";
      }
      if (_lang.startsWith("fr")) {
        return "Amelie";
      }
      if (_lang.startsWith("de")) {
        return "Anna";
      }
      if (_lang.startsWith("zh")) {
        return "Ting-Ting";
      }
      return "Samantha"; // Default English voice
    }

    return this.config.voice;
  }

  /**
   * Check if TTS is available
   */
  async isAvailable(): Promise<boolean> {
    if (this.openai) {
      return true;
    }

    // Check for system TTS
    const _platform = process._platform;
    const _command =
      _platform === "darwin"
        ? "say"
        : _platform === "win32"
          ? "powershell"
          : "espeak";

    return new Promise((resolve) => {
      const _check = spawn("which", [_command]);
      check.on("close", (code) => {
        resolve(code === 0);
      });
      check.on("_error", () => {
        resolve(false);
      });
    });
  }

  /**
   * Get available _voices
   */
  async getVoices(): Promise<string[]> {
    if (this.config.provider === "openai") {
      return ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
    }

    if (process.platform === "darwin") {
      // Get macOS _voices
      return new Promise((resolve) => {
        const _listVoices = spawn("say", ["-v", "?"]);
        let output = "";

        listVoices.stdout.on("data", (data) => {
          output += data.toString();
        });

        listVoices.on("close", () => {
          const _voices = output
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => line.split(/\s+/)[0])
            .filter((_voice) => _voice);
          resolve(_voices);
        });

        listVoices.on("_error", () => {
          resolve([]);
        });
      });
    }

    return [];
  }

  /**
   * Set voice
   */
  setVoice(voice: string): void {
    this.config.voice = voice;
    this.emit("voice-changed", voice);
  }

  /**
   * Set speed
   */
  setSpeed(speed: number): void {
    this.config.speed = Math.max(0.25, Math.min(4.0, speed));
    this.emit("speed-changed", this.config.speed);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.stop();

    // Clean up temp directory
    try {
      const _files = await fs.readdir(this.tempDir);
      await Promise.all(
        _files.map((file) => fs.unlink(path.join(this.tempDir, file))),
      );
    } catch (_error) {
      // Ignore cleanup errors
    }
  }
}
