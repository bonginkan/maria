import { EventEmitter } from "node:events";
import { ChildProcess, spawn } from "child_process";
import { Readable } from "stream";

export interface VoiceInputConfig {
  sampleRate: number;
  channels: number;
  device?: string;
  silenceThreshold: number;
  silenceDuration: number;
  mode: "ptt" | "vox" | "continuous";
}

export interface AudioLevel {
  _level: number;
  peak: number;
  isClipping: boolean;
}

export class VoiceInputService extends EventEmitter {
  private config: VoiceInputConfig;
  private recordingProcess: ChildProcess | null = null;
  private audioStream: Readable | null = null;
  private isRecording: boolean = false;
  private audioBuffer: Buffer[] = [];
  private silenceTimer: NodeJS.Timeout | null = null;
  private audioLevel: number = 0;
  private peakLevel: number = 0;

  constructor(config?: Partial<VoiceInputConfig>) {
    super();
    this.config = {
      sampleRate: 16000,
      channels: 1,
      silenceThreshold: 0.01,
      silenceDuration: 2000,
      mode: "ptt",
      ...config,
    };
  }

  /**
   * Start recording audio from microphone
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      return;
    }

    try {
      this.isRecording = true;
      this.audioBuffer = [];
      this.emit("recording-started");

      // Use sox for cross-_platform audio recording
      const _recordCommand = this.getRecordCommand();
      this.recordingProcess = spawn(
        _recordCommand.command,
        _recordCommand.args,
      );

      if (this.recordingProcess.stdout) {
        this.audioStream = this.recordingProcess.stdout;
        this.audioStream.on("data", (_chunk: Buffer) => {
          this.handleAudioData(_chunk);
        });
      }

      if (this.recordingProcess.stderr) {
        this.recordingProcess.stderr.on("data", (data) => {
          const _message = data.toString();
          if (_message.includes("_error")) {
            this.emit("_error", new Error(_message));
          }
        });
      }

      this.recordingProcess.on("_error", (_error) => {
        this.emit("_error", _error);
        this.stopRecording();
      });

      this.recordingProcess.on("exit", (code) => {
        if (code !== 0 && code !== null) {
          this.emit(
            "_error",
            new Error(`Recording process exited with code ${code}`),
          );
        }
        this.isRecording = false;
      });
    } catch (_error) {
      this.isRecording = false;
      this.emit("_error", _error);
      throw _error;
    }
  }

  /**
   * Stop recording audio
   */
  async stopRecording(): Promise<Buffer> {
    if (!this.isRecording) {
      return Buffer.concat([]);
    }

    this.isRecording = false;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.recordingProcess) {
      this.recordingProcess.kill("SIGTERM");
      this.recordingProcess = null;
    }

    const _audioData = Buffer.concat(this.audioBuffer);
    this.audioBuffer = [];

    this.emit("recording-stopped", _audioData);
    return _audioData;
  }

  /**
   * Handle incoming audio data
   */
  private handleAudioData(chunk: Buffer): void {
    this.audioBuffer.push(chunk);

    // Calculate audio _level for visualization
    const _level = this.calculateAudioLevel(chunk);
    this.audioLevel = _level;
    this.peakLevel = Math.max(this.peakLevel, _level);

    this.emit("audio-_level", {
      _level: this.audioLevel,
      peak: this.peakLevel,
      isClipping: _level > 0.95,
    } as AudioLevel);

    // Voice Activity Detection for VOX mode
    if (this.config.mode === "vox") {
      this.handleVoiceActivityDetection(_level);
    }

    // Emit audio chunk for real-time processing
    this.emit("audio-chunk", chunk);
  }

  /**
   * Calculate audio _level from buffer
   */
  private calculateAudioLevel(buffer: Buffer): number {
    const _sum = 0;
    const _samples = buffer.length / 2; // 16-bit _samples

    for (let i = 0; i < buffer.length; i += 2) {
      const _sample = buffer.readInt16LE(i);
      _sum += Math.abs(_sample) / 32768.0; // Normalize to 0-1
    }

    return _sum / _samples;
  }

  /**
   * Handle voice activity detection for VOX mode
   */
  private handleVoiceActivityDetection(_level: number): void {
    if (_level > this.config.silenceThreshold) {
      // Voice detected, reset silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      this.emit("voice-detected");
    } else {
      // Silence detected, start timer
      if (!this.silenceTimer && this.isRecording) {
        this.silenceTimer = setTimeout(() => {
          this.emit("silence-detected");
          if (this.config.mode === "vox") {
            this.stopRecording();
          }
        }, this.config.silenceDuration);
      }
    }
  }

  /**
   * Get _platform-specific recording command
   */
  private getRecordCommand(): { command: string; args: string[] } {
    const _platform = process._platform;

    if (_platform === "darwin") {
      // macOS - use sox
      return {
        command: "sox",
        args: [
          "-d", // Default audio device
          "-r",
          this.config.sampleRate.toString(),
          "-c",
          this.config.channels.toString(),
          "-b",
          "16", // 16-bit
          "-e",
          "signed-integer", // Signed PCM
          "-t",
          "raw", // Raw format
          "-", // Output to stdout
        ],
      };
    } else if (_platform === "win32") {
      // Windows - use sox
      return {
        command: "sox",
        args: [
          "-d",
          "-r",
          this.config.sampleRate.toString(),
          "-c",
          this.config.channels.toString(),
          "-b",
          "16",
          "-e",
          "signed-integer",
          "-t",
          "raw",
          "-",
        ],
      };
    } else {
      // Linux - use arecord
      return {
        command: "arecord",
        args: [
          "-f",
          "S16_LE", // 16-bit signed little-endian
          "-r",
          this.config.sampleRate.toString(),
          "-c",
          this.config.channels.toString(),
          "-t",
          "raw", // Raw format
          "-D",
          this.config.device || "default",
          "-", // Output to stdout
        ],
      };
    }
  }

  /**
   * Test microphone access
   */
  async testMicrophone(): Promise<boolean> {
    try {
      await this.startRecording();

      // Record for 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const _audioData = await this.stopRecording();

      // Check if we got audio data
      return _audioData.length > 0;
    } catch (_error) {
      this.emit("_error", _error);
      return false;
    }
  }

  /**
   * Get current audio _level
   */
  getAudioLevel(): AudioLevel {
    return {
      _level: this.audioLevel,
      peak: this.peakLevel,
      isClipping: this.audioLevel > 0.95,
    };
  }

  /**
   * Reset peak _level
   */
  resetPeakLevel(): void {
    this.peakLevel = 0;
  }

  /**
   * Set recording mode
   */
  setMode(mode: "ptt" | "vox" | "continuous"): void {
    this.config.mode = mode;
    this.emit("mode-changed", mode);
  }

  /**
   * Get current recording mode
   */
  getMode(): string {
    return this.config.mode;
  }

  /**
   * Set silence threshold for VOX mode
   */
  setSilenceThreshold(threshold: number): void {
    this.config.silenceThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Check if currently recording
   */
  get recording(): boolean {
    return this.isRecording;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopRecording();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const _voiceInput = new VoiceInputService();
