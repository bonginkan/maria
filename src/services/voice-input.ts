import { EventEmitter } from 'events';
import { ChildProcess, spawn } from 'child_process';
import { Readable } from 'stream';

export interface VoiceInputConfig {
  sampleRate: number;
  channels: number;
  device?: string;
  silenceThreshold: number;
  silenceDuration: number;
  mode: 'ptt' | 'vox' | 'continuous';
}

export interface AudioLevel {
  level: number;
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
      mode: 'ptt',
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
      this.emit('recording-started');

      // Use sox for cross-platform audio recording
      const recordCommand = this.getRecordCommand();
      this.recordingProcess = spawn(recordCommand.command, recordCommand.args);

      if (this.recordingProcess.stdout) {
        this.audioStream = this.recordingProcess.stdout;
        this.audioStream.on('data', (chunk: Buffer) => {
          this.handleAudioData(chunk);
        });
      }

      if (this.recordingProcess.stderr) {
        this.recordingProcess.stderr.on('data', (data) => {
          const message = data.toString();
          if (message.includes('error')) {
            this.emit('error', new Error(message));
          }
        });
      }

      this.recordingProcess.on('error', (error) => {
        this.emit('error', error);
        this.stopRecording();
      });

      this.recordingProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          this.emit('error', new Error(`Recording process exited with code ${code}`));
        }
        this.isRecording = false;
      });
    } catch (error) {
      this.isRecording = false;
      this.emit('error', error);
      throw error;
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
      this.recordingProcess.kill('SIGTERM');
      this.recordingProcess = null;
    }

    const audioData = Buffer.concat(this.audioBuffer);
    this.audioBuffer = [];

    this.emit('recording-stopped', audioData);
    return audioData;
  }

  /**
   * Handle incoming audio data
   */
  private handleAudioData(chunk: Buffer): void {
    this.audioBuffer.push(chunk);

    // Calculate audio level for visualization
    const level = this.calculateAudioLevel(chunk);
    this.audioLevel = level;
    this.peakLevel = Math.max(this.peakLevel, level);

    this.emit('audio-level', {
      level: this.audioLevel,
      peak: this.peakLevel,
      isClipping: level > 0.95,
    } as AudioLevel);

    // Voice Activity Detection for VOX mode
    if (this.config.mode === 'vox') {
      this.handleVoiceActivityDetection(level);
    }

    // Emit audio chunk for real-time processing
    this.emit('audio-chunk', chunk);
  }

  /**
   * Calculate audio level from buffer
   */
  private calculateAudioLevel(buffer: Buffer): number {
    let sum = 0;
    const samples = buffer.length / 2; // 16-bit samples

    for (let i = 0; i < buffer.length; i += 2) {
      const sample = buffer.readInt16LE(i);
      sum += Math.abs(sample) / 32768.0; // Normalize to 0-1
    }

    return sum / samples;
  }

  /**
   * Handle voice activity detection for VOX mode
   */
  private handleVoiceActivityDetection(level: number): void {
    if (level > this.config.silenceThreshold) {
      // Voice detected, reset silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      this.emit('voice-detected');
    } else {
      // Silence detected, start timer
      if (!this.silenceTimer && this.isRecording) {
        this.silenceTimer = setTimeout(() => {
          this.emit('silence-detected');
          if (this.config.mode === 'vox') {
            this.stopRecording();
          }
        }, this.config.silenceDuration);
      }
    }
  }

  /**
   * Get platform-specific recording command
   */
  private getRecordCommand(): { command: string; args: string[] } {
    const platform = process.platform;

    if (platform === 'darwin') {
      // macOS - use sox
      return {
        command: 'sox',
        args: [
          '-d', // Default audio device
          '-r',
          this.config.sampleRate.toString(),
          '-c',
          this.config.channels.toString(),
          '-b',
          '16', // 16-bit
          '-e',
          'signed-integer', // Signed PCM
          '-t',
          'raw', // Raw format
          '-', // Output to stdout
        ],
      };
    } else if (platform === 'win32') {
      // Windows - use sox
      return {
        command: 'sox',
        args: [
          '-d',
          '-r',
          this.config.sampleRate.toString(),
          '-c',
          this.config.channels.toString(),
          '-b',
          '16',
          '-e',
          'signed-integer',
          '-t',
          'raw',
          '-',
        ],
      };
    } else {
      // Linux - use arecord
      return {
        command: 'arecord',
        args: [
          '-f',
          'S16_LE', // 16-bit signed little-endian
          '-r',
          this.config.sampleRate.toString(),
          '-c',
          this.config.channels.toString(),
          '-t',
          'raw', // Raw format
          '-D',
          this.config.device || 'default',
          '-', // Output to stdout
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

      const audioData = await this.stopRecording();

      // Check if we got audio data
      return audioData.length > 0;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Get current audio level
   */
  getAudioLevel(): AudioLevel {
    return {
      level: this.audioLevel,
      peak: this.peakLevel,
      isClipping: this.audioLevel > 0.95,
    };
  }

  /**
   * Reset peak level
   */
  resetPeakLevel(): void {
    this.peakLevel = 0;
  }

  /**
   * Set recording mode
   */
  setMode(mode: 'ptt' | 'vox' | 'continuous'): void {
    this.config.mode = mode;
    this.emit('mode-changed', mode);
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
export const voiceInput = new VoiceInputService();
