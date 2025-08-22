import fs from 'fs/promises';
import readline from 'readline';
import chalk from 'chalk';
import { AvatarAnimator } from '../services/avatar-animator.js';
import { VoiceInputService } from '../services/voice-input.js';
import { SpeechRecognitionService } from '../services/speech-recognition.js';
import { TextToSpeechService } from '../services/text-to-speech.js';
import { HotwordDetector } from '../services/hotword-detector.js';
import { AudioProcessor } from '../services/audio-processor.js';

// Avatar data file path
const AVATAR_FILE_PATH = '/Users/bongin_max/maria_code/face_only_96x96_ramp.txt';

interface VoiceMode {
  enabled: boolean;
  mode: 'ptt' | 'vox' | 'continuous';
  isRecording: boolean;
  isProcessing: boolean;
}

interface AvatarSession {
  lines: string[];
  animator: AvatarAnimator | null;
  conversationHistory: Array<{ role: string; content: string }>;
  isActive: boolean;
  rl: readline.Interface | null;
  voiceMode: VoiceMode;
}

class VoiceAvatarInterface {
  private session: AvatarSession = {
    lines: [],
    animator: null,
    conversationHistory: [],
    isActive: false,
    rl: null,
    voiceMode: {
      enabled: false,
      mode: 'ptt',
      isRecording: false,
      isProcessing: false,
    },
  };

  private currentAnimation: NodeJS.Timeout | null = null;
  private blinkTimer: NodeJS.Timeout | null = null;
  private breathingTimer: NodeJS.Timeout | null = null;

  // Voice services
  private voiceInput: VoiceInputService | null = null;
  private speechRecognition: SpeechRecognitionService | null = null;
  private tts: TextToSpeechService | null = null;
  private hotwordDetector: HotwordDetector | null = null;
  private audioProcessor: AudioProcessor | null = null;

  constructor() {
    this.setupInput();
    this.initializeVoiceServices();
  }

  private async initializeVoiceServices(): Promise<void> {
    try {
      // Initialize audio processor
      this.audioProcessor = new AudioProcessor({
        noiseReduction: true,
        echoCancellation: true,
        gainControl: true,
        voiceActivityDetection: true,
      });

      // Initialize voice input
      this.voiceInput = new VoiceInputService({
        sampleRate: 16000,
        channels: 1,
        mode: 'ptt',
      });

      // Initialize speech recognition
      this.speechRecognition = new SpeechRecognitionService({
        provider: 'auto',
        language: 'en-US',
        continuous: false,
      });

      // Initialize TTS with Japanese support
      this.tts = new TextToSpeechService({
        provider: 'auto',
        voice: 'alloy',
        speed: 1.0,
        language: 'en-US',
      });

      // Initialize hotword detector
      this.hotwordDetector = new HotwordDetector({
        hotwords: ['hey maria', 'maria', 'okay maria', 'マリア'],
        sensitivity: 0.6,
      });

      // Setup voice event handlers
      this.setupVoiceEventHandlers();
    } catch (error) {
      console.error(chalk.yellow('Voice services initialization warning:'), error);
      // Continue without voice support
    }
  }

  private setupVoiceEventHandlers(): void {
    if (this.speechRecognition) {
      this.speechRecognition.on('transcription', async (result) => {
        if (result.isFinal) {
          await this.handleVoiceInput(result.text);
        }
      });

      this.speechRecognition.on('error', (error) => {
        console.error(chalk.red('Speech recognition error:'), error);
        this.session.voiceMode.isProcessing = false;
        this.updateVoiceStatus();
      });
    }

    if (this.hotwordDetector) {
      this.hotwordDetector.on('hotword-detected', (detection) => {
        if (!this.session.voiceMode.isRecording) {
          console.log(chalk.cyan(`\n🎤 Hotword detected: ${detection.hotword}`));
          this.startVoiceRecording();
        }
      });
    }

    if (this.voiceInput) {
      this.voiceInput.on('audio-level', (level) => {
        if (this.session.voiceMode.isRecording) {
          this.updateAudioLevelIndicator(level.level);
        }
      });
    }
  }

  private setupInput(): void {
    this.session.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Handle keyboard input for voice controls
    process.stdin.on('keypress', (_str, key) => {
      if (!key) {return;}

      // Space key for push-to-talk
      if (key.name === 'space' && this.session.voiceMode.enabled) {
        if (this.session.voiceMode.mode === 'ptt') {
          if (!this.session.voiceMode.isRecording) {
            this.startVoiceRecording();
          } else {
            this.stopVoiceRecording();
          }
        }
      }

      // V key to toggle voice mode
      if (key.name === 'v') {
        this.toggleVoiceMode();
      }

      // ESC or Ctrl+C to exit
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        this.exit();
      }
    });

    // Enable raw mode for keypress events
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    // Handle Ctrl+C gracefully
    this.session.rl.on('SIGINT', () => {
      this.exit();
    });
  }

  async start(): Promise<void> {
    try {
      this.session.isActive = true;

      // Clear screen and show header
      console.clear();
      this.showHeader();

      // Load avatar
      await this.loadAvatar();

      // Show initial avatar
      this.displayAvatar();

      // Show voice controls
      this.showVoiceControls();

      // Show initial message
      const greeting = 'こんにちは！I am MARIA Assistant. How can I help you today?';
      this.showMessage(greeting);

      // Speak greeting if TTS is available
      if (this.tts) {
        await this.tts.speak(greeting);
      }

      // Start animations
      this.startAnimations();

      // Start interactive loop
      this.startInteractive();
    } catch (error) {
      console.error(chalk.red('Error starting avatar interface:'), error);
      this.exit();
    }
  }

  private showHeader(): void {
    console.log(chalk.white.bold('═'.repeat(80)));
    console.log(chalk.white.bold('         MARIA AVATAR INTERFACE - Voice Enhanced Edition'));
    console.log(chalk.white.bold('═'.repeat(80)));
    console.log();
  }

  private showVoiceControls(): void {
    const voiceStatus = this.session.voiceMode.enabled
      ? `${chalk.green('●')  } Voice ON`
      : `${chalk.gray('○')  } Voice OFF`;

    const controls = ['[V] Toggle Voice', '[SPACE] Push-to-Talk', '[ESC] Exit'];

    console.log(chalk.white('┌─────────────────────────────────────────────────────────┐'));
    console.log(`${chalk.white('│ ') + voiceStatus  }  ${  controls.join('  ')  }${chalk.white('  │')}`);
    console.log(chalk.white('└─────────────────────────────────────────────────────────┘'));
  }

  private updateVoiceStatus(): void {
    process.stdout.moveCursor(0, -3);
    process.stdout.clearLine(0);
    this.showVoiceControls();
  }

  private updateAudioLevelIndicator(level: number): void {
    const maxBars = 20;
    const bars = Math.floor(level * maxBars);
    const indicator = '█'.repeat(bars) + '░'.repeat(maxBars - bars);

    let color = chalk.green;
    if (level > 0.8) {color = chalk.red;}
    else if (level > 0.6) {color = chalk.yellow;}

    process.stdout.write(`\r🎤 ${color(indicator)} ${Math.floor(level * 100)}%`);
  }

  private toggleVoiceMode(): void {
    this.session.voiceMode.enabled = !this.session.voiceMode.enabled;

    if (this.session.voiceMode.enabled) {
      console.log(chalk.green('\n🎤 Voice mode activated'));
      if (this.hotwordDetector) {
        this.hotwordDetector.start();
      }
    } else {
      console.log(chalk.yellow('\n🔇 Voice mode deactivated'));
      if (this.hotwordDetector) {
        this.hotwordDetector.stop();
      }
      if (this.session.voiceMode.isRecording) {
        this.stopVoiceRecording();
      }
    }

    this.updateVoiceStatus();
  }

  private async startVoiceRecording(): Promise<void> {
    if (!this.voiceInput || !this.speechRecognition) {
      console.log(chalk.red('\nVoice services not available'));
      return;
    }

    this.session.voiceMode.isRecording = true;
    console.log(chalk.cyan('\n🎤 Recording... (Press SPACE to stop)'));

    // Apply listening expression
    if (this.session.animator) {
      const listeningLines = this.session.animator.applyExpression('thinking');
      this.updateAvatarDisplay(listeningLines);
    }

    await this.voiceInput.startRecording();
  }

  private async stopVoiceRecording(): Promise<void> {
    if (!this.voiceInput || !this.speechRecognition) {return;}

    this.session.voiceMode.isRecording = false;
    this.session.voiceMode.isProcessing = true;
    console.log(chalk.yellow('\n⏳ Processing speech...'));

    const audioBuffer = await this.voiceInput.stopRecording();

    if (audioBuffer && audioBuffer.length > 0) {
      // Process audio through audio processor if available
      if (this.audioProcessor) {
        // const processingStream = this.audioProcessor.createProcessingStream();
        // TODO: Process audio buffer through the stream
      }

      // Transcribe audio
      const result = await this.speechRecognition.transcribe(audioBuffer);

      if (result && result.text) {
        // Check for hotword in transcription
        if (this.hotwordDetector) {
          this.hotwordDetector.processTranscription(result.text);
        }

        await this.handleVoiceInput(result.text);
      }
    }

    this.session.voiceMode.isProcessing = false;
  }

  private async handleVoiceInput(text: string): Promise<void> {
    console.log(chalk.green(`\n> ${text}`));

    // Add to conversation history
    this.session.conversationHistory.push({ role: 'user', content: text });

    // Generate and speak response
    await this.generateResponse(text);
  }

  private async loadAvatar(): Promise<void> {
    try {
      const data = await fs.readFile(AVATAR_FILE_PATH, 'utf-8');
      this.session.lines = data.split('\n');
      this.session.animator = new AvatarAnimator(this.session.lines);
    } catch (error) {
      console.error(chalk.red('Error loading avatar:'), error);
      this.session.lines = ['[Avatar loading error]'];
      this.session.animator = null;
    }
  }

  private displayAvatar(): void {
    if (this.session.lines.length > 0) {
      console.log();
      this.session.lines.forEach((line) => {
        console.log(chalk.white(`  ${  line}`));
      });
      console.log();
    }
  }

  private showMessage(message: string): void {
    const boxWidth = 80;
    const border = '─'.repeat(boxWidth - 4);

    console.log(chalk.white(`┌─${  border  }─┐`));

    // Word wrap for long messages
    const words = message.split(' ');
    let currentLine = '';
    const lines: string[] = [];

    words.forEach((word) => {
      if ((currentLine + word).length <= boxWidth - 6) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {lines.push(currentLine);}
        currentLine = word;
      }
    });
    if (currentLine) {lines.push(currentLine);}

    lines.forEach((line) => {
      const padding = ' '.repeat(Math.max(0, boxWidth - 6 - line.length));
      console.log(chalk.white('│ ') + chalk.white(line) + padding + chalk.white(' │'));
    });

    console.log(chalk.white(`└─${  border  }─┘`));
    console.log();
  }

  private startAnimations(): void {
    if (!this.session.animator) {return;}

    // Blinking animation
    this.blinkTimer = setInterval(
      () => {
        if (this.session.animator && this.session.isActive) {
          const blinkLines = this.session.animator.applyEyeBlink();
          this.updateAvatarDisplay(blinkLines);

          setTimeout(() => {
            if (this.session.animator && this.session.isActive) {
              this.updateAvatarDisplay(this.session.lines);
            }
          }, 150);
        }
      },
      4000 + Math.random() * 2000,
    );

    // Breathing effect
    let breathingPhase = 0;
    this.breathingTimer = setInterval(() => {
      if (this.session.animator && this.session.isActive) {
        breathingPhase += 0.1;
        const breathingLines = this.session.animator.applyBreathingEffect(breathingPhase);
        this.updateAvatarDisplay(breathingLines);
      }
    }, 1000);
  }

  private updateAvatarDisplay(lines: string[]): void {
    process.stdout.moveCursor(0, -(lines.length + 2));
    process.stdout.clearScreenDown();

    console.log();
    lines.forEach((line) => {
      console.log(chalk.white(`  ${  line}`));
    });
    console.log();
  }

  private async simulateTalking(message: string): Promise<void> {
    if (!this.session.animator) {return;}

    const talkingSequence = this.session.animator.getTalkingSequence();
    let frameIndex = 0;

    return new Promise((resolve) => {
      this.currentAnimation = setInterval(() => {
        if (frameIndex >= talkingSequence.length) {
          frameIndex = 0;
        }
        const frame = talkingSequence[frameIndex];
        if (frame) {
          this.updateAvatarDisplay(frame.lines);
        }
        frameIndex++;
      }, 200);

      setTimeout(
        () => {
          if (this.currentAnimation) {
            clearInterval(this.currentAnimation);
            this.currentAnimation = null;
          }
          if (this.session.animator) {
            const normalLines = this.session.animator.applyExpression('neutral');
            this.updateAvatarDisplay(normalLines);
          }
          resolve();
        },
        Math.max(3000, message.length * 50),
      );
    });
  }

  private startInteractive(): void {
    this.promptUser();
  }

  private promptUser(): void {
    if (!this.session.isActive || !this.session.rl) {return;}

    this.session.rl.question(chalk.green('> '), async (input) => {
      if (!this.session.isActive) {return;}

      const userInput = input.trim();
      if (!userInput) {
        this.promptUser();
        return;
      }

      // Handle exit commands
      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
        this.exit();
        return;
      }

      // Handle voice commands
      if (userInput.startsWith(':voice')) {
        this.handleVoiceCommand(userInput);
        this.promptUser();
        return;
      }

      // Add to conversation history
      this.session.conversationHistory.push({ role: 'user', content: userInput });

      // Generate response
      await this.generateResponse(userInput);

      // Continue conversation
      this.promptUser();
    });
  }

  private handleVoiceCommand(command: string): void {
    const parts = command.split(' ');

    if (parts[1] === 'on') {
      this.session.voiceMode.enabled = true;
      console.log(chalk.green('Voice mode enabled'));
    } else if (parts[1] === 'off') {
      this.session.voiceMode.enabled = false;
      console.log(chalk.yellow('Voice mode disabled'));
    } else if (parts[1] === 'test') {
      this.testVoice();
    } else if (parts[1] === 'lang' && parts[2]) {
      this.setLanguage(parts[2]);
    }

    this.updateVoiceStatus();
  }

  private async testVoice(): Promise<void> {
    if (this.tts) {
      const testMessage = 'Testing voice output. こんにちは、マリアです。';
      console.log(chalk.cyan('Testing TTS...'));
      await this.tts.speak(testMessage);
    }
  }

  private setLanguage(lang: string): void {
    const langMap: { [key: string]: string } = {
      ja: 'ja-JP',
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
    };

    const language = langMap[lang] || 'en-US';

    if (this.speechRecognition) {
      this.speechRecognition = new SpeechRecognitionService({
        provider: 'auto',
        language,
        continuous: false,
      });
    }

    if (this.tts) {
      this.tts = new TextToSpeechService({
        provider: 'auto',
        language,
      });
    }

    console.log(chalk.green(`Language set to ${language}`));
  }

  private async generateResponse(userInput: string): Promise<void> {
    // Show thinking message
    this.showMessage('Let me think about that...');

    // Apply thinking expression
    if (this.session.animator) {
      const thinkingLines = this.session.animator.applyExpression('thinking');
      this.updateAvatarDisplay(thinkingLines);
    }

    let response: string;
    let expression: string;

    // Detect if Japanese input
    const isJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(userInput);

    // Enhanced response logic with Japanese support
    if (userInput.includes('こんにちは') || userInput.includes('hello')) {
      response = isJapanese
        ? 'こんにちは！お元気ですか？何かお手伝いできることはありますか？'
        : 'Hello! How are you? Is there anything I can help you with?';
      expression = 'happy';
    } else if (userInput.includes('ありがとう') || userInput.includes('thank')) {
      response = isJapanese
        ? 'どういたしまして！お役に立てて嬉しいです！'
        : "You're welcome! I'm happy to help!";
      expression = 'happy';
    } else if (userInput.toLowerCase().includes('help') || userInput.includes('助けて')) {
      response = isJapanese
        ? 'もちろんお手伝いします！どんなことでお困りですか？'
        : "I'm here to help you! What can I assist you with?";
      expression = 'neutral';
    } else {
      const responses = isJapanese
        ? [
            'なるほど、興味深いですね！',
            'それについてもっと教えていただけますか？',
            'いいアイデアですね！',
            'そうですね、私もそう思います。',
            'ご質問ありがとうございます！',
          ]
        : [
            "That's an interesting question! Let me help you with that.",
            "I understand what you're asking. Here's what I think...",
            'Great point! From my perspective...',
            "I'm here to assist you. Let me process that...",
            "Thanks for sharing that with me. Here's my take...",
          ];
      response = responses[Math.floor(Math.random() * responses.length)] || "I'm here to help!";
      expression = 'talking';
    }

    // Add to conversation history
    this.session.conversationHistory.push({ role: 'assistant', content: response });

    // Apply expression and show talking animation
    if (this.session.animator) {
      const expressionLines = this.session.animator.applyExpression(expression);
      this.updateAvatarDisplay(expressionLines);
    }

    // Show response with talking animation
    this.showMessage(response);

    // Speak response if voice is enabled
    if (this.session.voiceMode.enabled && this.tts) {
      const talkingPromise = this.simulateTalking(response);
      const speakPromise = this.tts.speak(response);
      await Promise.all([talkingPromise, speakPromise]);
    } else {
      await this.simulateTalking(response);
    }
  }

  private async exit(): Promise<void> {
    this.session.isActive = false;

    // Clear timers
    if (this.currentAnimation) {
      clearInterval(this.currentAnimation);
    }
    if (this.blinkTimer) {
      clearInterval(this.blinkTimer);
    }
    if (this.breathingTimer) {
      clearInterval(this.breathingTimer);
    }

    // Clean up voice services
    if (this.voiceInput) {
      await this.voiceInput.stopRecording();
    }
    if (this.hotwordDetector) {
      this.hotwordDetector.stop();
    }
    if (this.tts) {
      this.tts.stop();
      await this.tts.cleanup();
    }

    // Close readline
    if (this.session.rl) {
      this.session.rl.close();
    }

    // Restore terminal
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }

    console.log();
    console.log(
      chalk.yellow('ありがとうございました！Thank you for chatting with MARIA! Goodbye!'),
    );
    console.log(chalk.white.bold('═'.repeat(80)));
    process.exit(0);
  }
}

// Command function for use in CLI
export async function showVoiceAvatar(): Promise<void> {
  const avatarInterface = new VoiceAvatarInterface();
  await avatarInterface.start();
}

// Export for slash command handler
export const voiceAvatarCommand = {
  name: 'avatar-voice',
  description: 'Interactive ASCII avatar with voice chat support (Japanese & English)',
  execute: showVoiceAvatar,
};

export default showVoiceAvatar;
