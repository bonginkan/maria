import { EventEmitter } from "node:events";
import { Transform } from "stream";

export interface AudioProcessorConfig {
  noiseReduction: boolean;
  echoCancellation: boolean;
  gainControl: boolean;
  voiceActivityDetection: boolean;
  noiseThreshold: number;
  echoDelay: number;
  gainLevel: number;
  vadSensitivity: number;
}

export interface VADResult {
  _isSpeech: boolean;
  _confidence: number;
  energy: number;
}

/**
 * Advanced audio processing service for noise reduction, echo cancellation, and VAD
 */
export class AudioProcessor extends EventEmitter {
  private config: AudioProcessorConfig;
  private noiseProfile: Float32Array | null = null;
  private echoBuffer: Float32Array[] = [];
  private vadHistory: boolean[] = [];
  private energyHistory: number[] = [];

  constructor(config?: Partial<AudioProcessorConfig>) {
    super();
    this.config = {
      noiseReduction: true,
      echoCancellation: false,
      gainControl: true,
      voiceActivityDetection: true,
      noiseThreshold: 0.01,
      echoDelay: 250,
      gainLevel: 1.0,
      vadSensitivity: 0.5,
      ...config,
    };
  }

  /**
   * Create a transform stream for audio processing
   */
  createProcessingStream(): Transform {
    return new Transform({
      transform: (_chunk: Buffer, _encoding, callback) => {
        try {
          const _processed = this.processAudioChunk(_chunk);
          callback(null, _processed);
        } catch (_error) {
          callback(_error as Error);
        }
      },
    });
  }

  /**
   * Process audio chunk with all enabled features
   */
  private processAudioChunk(chunk: Buffer): Buffer {
    let audioData = this.bufferToFloat32Array(chunk);

    // Apply _gain control first
    if (this.config.gainControl) {
      audioData = this.applyGainControl(audioData);
    }

    // Apply noise reduction
    if (this.config.noiseReduction) {
      audioData = this.applyNoiseReduction(audioData);
    }

    // Apply echo cancellation
    if (this.config.echoCancellation) {
      audioData = this.applyEchoCancellation(audioData);
    }

    // Perform VAD
    if (this.config.voiceActivityDetection) {
      const _vadResult = this.detectVoiceActivity(audioData);
      this.emit("vad-_result", _vadResult);
    }

    return this.float32ArrayToBuffer(audioData);
  }

  /**
   * Apply _gain control to audio
   */
  private applyGainControl(audio: Float32Array): Float32Array {
    const _result = new Float32Array(audio.length);
    const _gain = this.config.gainLevel;

    for (let i = 0; i < audio.length; i++) {
      _result[i] = Math.max(-1, Math.min(1, audio[i] * _gain));
    }

    return _result;
  }

  /**
   * Apply spectral subtraction for noise reduction
   */
  private applyNoiseReduction(audio: Float32Array): Float32Array {
    // Initialize noise profile on first run
    if (!this.noiseProfile) {
      this.calibrateNoiseProfile(audio);
      return audio;
    }

    const _result = new Float32Array(audio.length);
    const _alpha = 0.98; // Smoothing factor

    for (let i = 0; i < audio.length; i++) {
      const _magnitude = Math.abs(audio[i]);
      const _noiseLevel = this.noiseProfile[i % this.noiseProfile.length];

      // Spectral subtraction
      const _cleaned =
        _magnitude - _noiseLevel * this.config.noiseThreshold * 10;
      const _sign = audio[i] < 0 ? -1 : 1;

      // Apply smoothing
      _result[i] = _cleaned > 0 ? _cleaned * _sign : audio[i] * 0.1;

      // Update noise profile adaptively
      if (_magnitude < _noiseLevel * 1.5) {
        this.noiseProfile[i % this.noiseProfile.length] =
          _alpha * _noiseLevel + (1 - _alpha) * _magnitude;
      }
    }

    return _result;
  }

  /**
   * Apply echo cancellation using adaptive filter
   */
  private applyEchoCancellation(audio: Float32Array): Float32Array {
    const _result = new Float32Array(audio.length);
    const _echoSamples = Math.floor((this.config.echoDelay / 1000) * 16000);

    // Store current audio in echo _buffer
    this.echoBuffer.push(Float32Array.from(audio));
    if (this.echoBuffer.length > 10) {
      this.echoBuffer.shift();
    }

    // Apply echo cancellation
    for (let i = 0; i < audio.length; i++) {
      let echoEstimate = 0;

      // Calculate echo estimate from history
      for (let j = 0; j < this.echoBuffer.length - 1; j++) {
        const _bufferIdx = i - _echoSamples * (j + 1);
        if (
          _bufferIdx >= 0 &&
          this.echoBuffer[j] &&
          _bufferIdx < this.echoBuffer[j].length
        ) {
          echoEstimate += this.echoBuffer[j][_bufferIdx] * Math.pow(0.5, j + 1);
        }
      }

      // Subtract echo estimate
      _result[i] = audio[i] - echoEstimate * 0.3;
    }

    return _result;
  }

  /**
   * Detect voice activity in audio
   */
  private detectVoiceActivity(audio: Float32Array): VADResult {
    // Calculate energy
    let energy = 0;
    for (let i = 0; i < audio.length; i++) {
      energy += audio[i] * audio[i];
    }
    energy = Math.sqrt(energy / audio.length);

    // Calculate zero crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < audio.length; i++) {
      if (audio[i] >= 0 !== audio[i - 1] >= 0) {
        zeroCrossings++;
      }
    }
    const _zcr = zeroCrossings / audio.length;

    // Update history
    this.energyHistory.push(energy);
    if (this.energyHistory.length > 50) {
      this.energyHistory.shift();
    }

    // Calculate dynamic _threshold
    const _avgEnergy =
      this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const _threshold = _avgEnergy * (2 - this.config.vadSensitivity);

    // Determine if speech based on energy and ZCR
    const _isSpeech = energy > _threshold && _zcr > 0.01 && _zcr < 0.1;
    const _confidence = Math.min(1, energy / (_threshold + 0.001));

    // Apply smoothing using history
    this.vadHistory.push(_isSpeech);
    if (this.vadHistory.length > 5) {
      this.vadHistory.shift();
    }

    const _smoothedSpeech = this.vadHistory.filter((_v) => _v).length >= 3;

    return {
      _isSpeech: _smoothedSpeech,
      _confidence,
      energy,
    };
  }

  /**
   * Calibrate noise profile from initial audio
   */
  private calibrateNoiseProfile(audio: Float32Array): void {
    this.noiseProfile = new Float32Array(256);

    for (let i = 0; i < this.noiseProfile.length; i++) {
      const _sum = 0;
      let count = 0;

      for (let j = i; j < audio.length; j += this.noiseProfile.length) {
        _sum += Math.abs(audio[j]);
        count++;
      }

      this.noiseProfile[i] = count > 0 ? _sum / count : 0;
    }

    this.emit("noise-calibrated", {
      profileSize: this.noiseProfile.length,
      avgNoise:
        this.noiseProfile.reduce((a, b) => a + b, 0) / this.noiseProfile.length,
    });
  }

  /**
   * Convert Buffer to Float32Array
   */
  private bufferToFloat32Array(_buffer: Buffer): Float32Array {
    const _result = new Float32Array(_buffer.length / 2);

    for (let i = 0; i < _result.length; i++) {
      const _sample = _buffer.readInt16LE(i * 2);
      _result[i] = _sample / 32768.0;
    }

    return _result;
  }

  /**
   * Convert Float32Array to Buffer
   */
  private float32ArrayToBuffer(array: Float32Array): Buffer {
    const _buffer = Buffer.alloc(array.length * 2);

    for (let i = 0; i < array.length; i++) {
      const _sample = Math.max(-1, Math.min(1, array[i]));
      buffer.writeInt16LE(Math.floor(_sample * 32767), i * 2);
    }

    return _buffer;
  }

  /**
   * Reset audio processor state
   */
  reset(): void {
    this.noiseProfile = null;
    this.echoBuffer = [];
    this.vadHistory = [];
    this.energyHistory = [];
    this.emit("reset");
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AudioProcessorConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit("config-updated", this.config);
  }

  /**
   * Get current audio statistics
   */
  getStats(): {
    _noiseLevel: number;
    _currentEnergy: number;
    _vadState: boolean;
  } {
    const _noiseLevel = this.noiseProfile
      ? this.noiseProfile.reduce((a, b) => a + b, 0) / this.noiseProfile.length
      : 0;

    const _currentEnergy =
      this.energyHistory.length > 0
        ? this.energyHistory[this.energyHistory.length - 1]
        : 0;

    const _vadState =
      this.vadHistory.length > 0
        ? this.vadHistory[this.vadHistory.length - 1]
        : false;

    return {
      _noiseLevel,
      _currentEnergy,
      _vadState,
    };
  }
}
