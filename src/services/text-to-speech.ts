import { EventEmitter } from 'events';
import OpenAI from 'openai';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import gtts from 'node-gtts';

export interface TextToSpeechConfig {
  provider: 'openai' | 'system' | 'gtts' | 'auto';
  voice: string;
  speed: number;
  pitch: number;
  volume: number;
  language: string;
  apiKey?: string;
  outputFormat?: 'mp3' | 'wav' | 'opus';
}

export interface TTSResult {
  audioBuffer?: Buffer;
  audioFile?: string;
  duration?: number;
  success: boolean;
  error?: string;
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
      provider: 'auto',
      voice: 'alloy',
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0,
      language: 'en-US',
      outputFormat: 'mp3',
      ...config,
    };

    this.tempDir = path.join(os.tmpdir(), 'maria-tts');
    this.initializeProvider();
  }

  /**
   * Initialize the TTS provider
   */
  private async initializeProvider(): Promise<void> {
    // Create temp directory for audio files
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }

    if (this.config.provider === 'openai' || this.config.provider === 'auto') {
      const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
      if (apiKey) {
        this.openai = new OpenAI({ apiKey });
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
        error: 'Already speaking',
      };
    }

    try {
      // Use Google TTS for Japanese text or when explicitly selected
      const isJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);

      if (this.config.provider === 'gtts' || (this.config.provider === 'auto' && isJapanese)) {
        return await this.synthesizeWithGoogleTTS(text);
      } else if (this.config.provider === 'openai' && this.openai) {
        return await this.synthesizeWithOpenAI(text);
      } else if (this.config.provider === 'system' || !this.openai) {
        return await this.synthesizeWithSystem(text);
      }

      return {
        success: false,
        error: 'No TTS provider available',
      };
    } catch (error) {
      this.emit('error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Use Google TTS with Japanese support
   */
  private async synthesizeWithGoogleTTS(text: string): Promise<TTSResult> {
    return new Promise((resolve) => {
      try {
        this.emit('synthesis-start', { text, provider: 'gtts' });

        // Detect language from text
        const isJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
        const lang = isJapanese ? 'ja' : this.config.language.split('-')[0];

        // Create GTTS instance
        const tts = gtts(lang);

        // Generate audio file
        const audioFile = path.join(this.tempDir, `tts-${Date.now()}.mp3`);

        tts.save(audioFile, text, () => {
          this.emit('synthesis-complete', { audioFile, provider: 'gtts', language: lang });
          resolve({
            audioFile,
            success: true,
          });
        });
      } catch (error) {
        this.emit('synthesis-error', error);
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Google TTS failed',
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
        error: 'OpenAI client not initialized',
      };
    }

    try {
      this.emit('synthesis-start', { text, provider: 'openai' });

      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: this.config.voice as any,
        input: text,
        speed: this.config.speed,
      });

      const buffer = Buffer.from(await response.arrayBuffer());

      // Save to temp file
      const audioFile = path.join(this.tempDir, `tts-${Date.now()}.mp3`);
      await fs.writeFile(audioFile, buffer);

      this.emit('synthesis-complete', { audioFile, size: buffer.length });

      return {
        audioBuffer: buffer,
        audioFile,
        success: true,
      };
    } catch (error) {
      this.emit('synthesis-error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OpenAI TTS failed',
      };
    }
  }

  /**
   * Use system TTS (macOS say, Windows SAPI, Linux espeak)
   */
  private async synthesizeWithSystem(text: string): Promise<TTSResult> {
    return new Promise((resolve) => {
      this.emit('synthesis-start', { text, provider: 'system' });

      const platform = process.platform;
      let command: string;
      let args: string[];

      if (platform === 'darwin') {
        // macOS
        command = 'say';
        args = ['-v', this.getSystemVoice(), '-r', String(this.config.speed * 200), text];
      } else if (platform === 'win32') {
        // Windows
        command = 'powershell';
        args = [
          '-Command',
          `Add-Type -AssemblyName System.speech; $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speaker.Rate = ${Math.round(this.config.speed * 10 - 10)}; $speaker.Speak('${text.replace(/'/g, "''")}')`,
        ];
      } else {
        // Linux (espeak)
        command = 'espeak';
        args = [
          '-s',
          String(this.config.speed * 175),
          '-p',
          String(this.config.pitch * 50),
          '-a',
          String(this.config.volume * 200),
          text,
        ];
      }

      const process = spawn(command, args);

      process.on('close', (code) => {
        if (code === 0) {
          this.emit('synthesis-complete', { provider: 'system' });
          resolve({
            success: true,
          });
        } else {
          this.emit('synthesis-error', { code });
          resolve({
            success: false,
            error: `System TTS failed with code ${code}`,
          });
        }
      });

      process.on('error', (error) => {
        this.emit('synthesis-error', error);
        resolve({
          success: false,
          error: error.message,
        });
      });
    });
  }

  /**
   * Play synthesized audio
   */
  async speak(text: string): Promise<void> {
    const result = await this.synthesize(text);

    if (result.success && result.audioFile) {
      await this.playAudio(result.audioFile);
    } else if (result.success && this.config.provider === 'system') {
      // System TTS plays directly, no need for additional playback
      this.isSpeaking = false;
    }
  }

  /**
   * Play audio file
   */
  private async playAudio(audioFile: string): Promise<void> {
    return new Promise((resolve) => {
      this.isSpeaking = true;
      this.emit('playback-start', { audioFile });

      const platform = process.platform;
      let command: string;
      let args: string[];

      if (platform === 'darwin') {
        command = 'afplay';
        args = [audioFile];
      } else if (platform === 'win32') {
        command = 'powershell';
        args = ['-c', `(New-Object Media.SoundPlayer '${audioFile}').PlaySync()`];
      } else {
        command = 'aplay';
        args = [audioFile];
      }

      this.playbackProcess = spawn(command, args);

      this.playbackProcess.on('close', () => {
        this.isSpeaking = false;
        this.playbackProcess = null;
        this.emit('playback-complete');

        // Clean up temp file
        fs.unlink(audioFile).catch(() => {});
        resolve();
      });

      this.playbackProcess.on('error', (error) => {
        this.isSpeaking = false;
        this.playbackProcess = null;
        this.emit('playback-error', error);
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
      this.emit('playback-stopped');
    }
  }

  /**
   * Get system voice based on language
   */
  private getSystemVoice(): string {
    const lang = this.config.language.toLowerCase();

    if (process.platform === 'darwin') {
      // macOS voices
      if (lang.startsWith('ja')) return 'Kyoko';
      if (lang.startsWith('es')) return 'Monica';
      if (lang.startsWith('fr')) return 'Amelie';
      if (lang.startsWith('de')) return 'Anna';
      if (lang.startsWith('zh')) return 'Ting-Ting';
      return 'Samantha'; // Default English voice
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
    const platform = process.platform;
    const command = platform === 'darwin' ? 'say' : platform === 'win32' ? 'powershell' : 'espeak';

    return new Promise((resolve) => {
      const check = spawn('which', [command]);
      check.on('close', (code) => {
        resolve(code === 0);
      });
      check.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<string[]> {
    if (this.config.provider === 'openai') {
      return ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    }

    if (process.platform === 'darwin') {
      // Get macOS voices
      return new Promise((resolve) => {
        const listVoices = spawn('say', ['-v', '?']);
        let output = '';

        listVoices.stdout.on('data', (data) => {
          output += data.toString();
        });

        listVoices.on('close', () => {
          const voices = output
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => line.split(/\s+/)[0])
            .filter((voice) => voice);
          resolve(voices);
        });

        listVoices.on('error', () => {
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
    this.emit('voice-changed', voice);
  }

  /**
   * Set speed
   */
  setSpeed(speed: number): void {
    this.config.speed = Math.max(0.25, Math.min(4.0, speed));
    this.emit('speed-changed', this.config.speed);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.stop();

    // Clean up temp directory
    try {
      const files = await fs.readdir(this.tempDir);
      await Promise.all(files.map((file) => fs.unlink(path.join(this.tempDir, file))));
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}
