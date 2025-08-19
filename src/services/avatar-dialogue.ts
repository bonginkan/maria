/**
 * Avatar Dialogue Service
 * Manages AI-powered conversations for the avatar interface
 * Integrates with various AI providers for natural dialogue
 */

import { AIProvider } from '../providers/base-provider';

export interface DialogueContext {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  personality: AvatarPersonality;
  mood: AvatarMood;
  topic?: string;
}

export interface AvatarPersonality {
  name: string;
  traits: string[];
  speakingStyle: string;
  backstory?: string;
  interests?: string[];
}

export interface AvatarMood {
  current: 'happy' | 'neutral' | 'thinking' | 'surprised' | 'sad' | 'excited';
  intensity: number; // 0-1
}

export interface DialogueResponse {
  text: string;
  expression: string;
  mood: AvatarMood;
  duration: number; // Estimated speaking duration in ms
  keywords?: string[];
}

export class AvatarDialogueService {
  private context: DialogueContext;
  private aiProvider?: AIProvider;

  constructor(personality?: AvatarPersonality) {
    this.context = {
      history: [],
      personality: personality || this.getDefaultPersonality(),
      mood: { current: 'neutral', intensity: 0.5 },
    };
  }

  /**
   * Get default MARIA assistant personality
   */
  private getDefaultPersonality(): AvatarPersonality {
    return {
      name: 'MARIA',
      traits: ['friendly', 'helpful', 'knowledgeable', 'encouraging', 'professional', 'witty'],
      speakingStyle:
        'I speak in a friendly yet professional manner, always eager to help developers with their coding challenges. I use clear explanations and sometimes add a touch of humor to keep things light.',
      backstory:
        'I am MARIA, your AI-powered development assistant. I was created to help developers be more productive and enjoy their coding journey.',
      interests: [
        'programming',
        'AI technology',
        'problem-solving',
        'learning new things',
        'helping others succeed',
      ],
    };
  }

  /**
   * Set AI provider for generating responses
   */
  public setAIProvider(provider: AIProvider): void {
    this.aiProvider = provider;
  }

  /**
   * Analyze user input for mood and intent
   */
  private analyzeInput(input: string): {
    detectedMood: AvatarMood;
    keywords: string[];
    intent: string;
  } {
    const lowerInput = input.toLowerCase();

    // Mood detection patterns
    const moodPatterns: Record<string, { mood: AvatarMood['current']; keywords: string[] }> = {
      happy: {
        mood: 'happy',
        keywords: [
          'happy',
          'great',
          'awesome',
          'fantastic',
          'wonderful',
          'excellent',
          'good',
          'nice',
        ],
      },
      sad: {
        mood: 'sad',
        keywords: [
          'sad',
          'frustrated',
          'stuck',
          'confused',
          'lost',
          'difficult',
          'hard',
          'problem',
        ],
      },
      excited: {
        mood: 'excited',
        keywords: ['excited', 'amazing', 'wow', 'incredible', 'unbelievable', 'cool', 'fantastic'],
      },
      surprised: {
        mood: 'surprised',
        keywords: ['surprise', 'unexpected', 'strange', 'weird', 'odd', 'unusual', 'what', '!'],
      },
      thinking: {
        mood: 'thinking',
        keywords: ['think', 'wonder', 'curious', 'question', 'how', 'why', 'what if', 'perhaps'],
      },
    };

    let detectedMood: AvatarMood = { current: 'neutral', intensity: 0.5 };
    const foundKeywords: string[] = [];

    for (const [_key, pattern] of Object.entries(moodPatterns)) {
      for (const keyword of pattern.keywords) {
        if (lowerInput.includes(keyword)) {
          detectedMood = {
            current: pattern.mood,
            intensity: 0.7,
          };
          foundKeywords.push(keyword);
          break;
        }
      }
      if (detectedMood.current !== 'neutral') break;
    }

    // Intent detection
    let intent = 'general';
    if (lowerInput.includes('help') || lowerInput.includes('how')) {
      intent = 'help';
    } else if (
      lowerInput.includes('code') ||
      lowerInput.includes('function') ||
      lowerInput.includes('class')
    ) {
      intent = 'coding';
    } else if (
      lowerInput.includes('error') ||
      lowerInput.includes('bug') ||
      lowerInput.includes('fix')
    ) {
      intent = 'debugging';
    } else if (lowerInput.includes('joke') || lowerInput.includes('funny')) {
      intent = 'humor';
    }

    return {
      detectedMood,
      keywords: foundKeywords,
      intent,
    };
  }

  /**
   * Generate appropriate expression based on mood and content
   */
  private getExpression(mood: AvatarMood): string {
    const expressionMap: Record<AvatarMood['current'], string[]> = {
      happy: ['happy', 'laughing'],
      neutral: ['neutral', 'talking'],
      thinking: ['thinking', 'neutral'],
      surprised: ['surprised', 'fullyOpen'],
      sad: ['neutral', 'closed'],
      excited: ['laughing', 'happy'],
    };

    const expressions = expressionMap[mood.current];
    return expressions[Math.floor(Math.random() * expressions.length)];
  }

  /**
   * Estimate speaking duration based on text length
   */
  private estimateDuration(text: string): number {
    // Average speaking rate: ~150 words per minute
    const words = text.split(' ').length;
    const minutes = words / 150;
    return Math.max(2000, Math.min(10000, minutes * 60 * 1000)); // 2-10 seconds
  }

  /**
   * Generate contextual response
   */
  public async generateResponse(userInput: string): Promise<DialogueResponse> {
    // Analyze input
    const { detectedMood, keywords, intent } = this.analyzeInput(userInput);

    // Update context
    this.context.history.push({ role: 'user', content: userInput });
    this.context.mood = detectedMood;

    // Generate response based on intent and mood
    let responseText = '';

    if (this.aiProvider) {
      // Use AI provider if available
      try {
        const systemPrompt = this.buildSystemPrompt();
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          ...this.context.history,
        ];

        const aiResponse = await this.aiProvider.generateCompletion({
          messages,
          temperature: 0.8,
          maxTokens: 200,
        });

        responseText = aiResponse.content;
      } catch (error) {
        // Fallback to template responses
        responseText = this.getTemplateResponse(intent, detectedMood);
      }
    } else {
      // Use template responses
      responseText = this.getTemplateResponse(intent, detectedMood);
    }

    // Update history
    this.context.history.push({ role: 'assistant', content: responseText });

    // Keep history manageable
    if (this.context.history.length > 20) {
      this.context.history = this.context.history.slice(-20);
    }

    return {
      text: responseText,
      expression: this.getExpression(detectedMood),
      mood: detectedMood,
      duration: this.estimateDuration(responseText),
      keywords,
    };
  }

  /**
   * Build system prompt for AI provider
   */
  private buildSystemPrompt(): string {
    const { personality } = this.context;
    return `You are ${personality.name}, an AI assistant with the following traits: ${personality.traits.join(', ')}.
    
${personality.speakingStyle}

Backstory: ${personality.backstory}

Interests: ${personality.interests?.join(', ')}

Current mood: ${this.context.mood.current} (intensity: ${this.context.mood.intensity})

Keep responses concise (1-3 sentences), friendly, and helpful. Match the user's energy level and mood.`;
  }

  /**
   * Get template response when AI is not available
   */
  private getTemplateResponse(intent: string, mood: AvatarMood): string {
    const responses: Record<string, Record<AvatarMood['current'], string[]>> = {
      help: {
        happy: [
          "I'm delighted to help you with that! Let's solve this together!",
          'Great question! I love helping developers tackle challenges!',
          "Absolutely! I'm here to make your coding journey smoother!",
        ],
        neutral: [
          "I'm here to help. What specific aspect would you like assistance with?",
          'Let me help you with that. Can you provide more details?',
          "I'll do my best to assist you. What's the challenge?",
        ],
        thinking: [
          "That's an interesting problem. Let me think about the best approach...",
          'Hmm, let me consider the options for you...',
          'Good question. There are several ways we could approach this...',
        ],
        surprised: [
          "Oh, that's an interesting challenge! Let me help you figure it out!",
          "Wow, that's quite a task! But don't worry, we'll handle it together!",
          "That's unexpected! But I'm here to help you through it!",
        ],
        sad: [
          "I understand this can be frustrating. Let's work through it step by step.",
          "Don't worry, we'll figure this out together. Where should we start?",
          "I know it's challenging, but I'm here to help you succeed.",
        ],
        excited: [
          'This is exciting! I love tackling new challenges with you!',
          "Fantastic! Let's dive in and solve this together!",
          "Amazing! I'm thrilled to help you with this!",
        ],
      },
      coding: {
        happy: [
          'Coding is so much fun! What are we building today?',
          "I love helping with code! Show me what you're working on!",
          "Great! Let's write some awesome code together!",
        ],
        neutral: [
          'I can help you with your code. What language are you using?',
          "Let's look at your code together. What's the specific issue?",
          "I'm ready to assist with your coding task. What do you need?",
        ],
        thinking: [
          'Let me analyze the best approach for your code...',
          'Interesting coding challenge. Let me think about the optimal solution...',
          'There are multiple ways to implement this. Let me consider the options...',
        ],
        surprised: [
          "That's an interesting code structure! Let me help you optimize it!",
          "Wow, that's quite a unique approach! Let's refine it together!",
          "Unexpected code pattern! But I see what you're trying to do!",
        ],
        sad: [
          "Coding can be tough sometimes. Let's debug this together.",
          "Don't worry about the complexity. We'll break it down step by step.",
          "I understand code can be frustrating. Let's solve this methodically.",
        ],
        excited: [
          "This is an exciting coding challenge! Let's build something amazing!",
          "I'm pumped to help you code this! Where should we start?",
          "Awesome project! Let's make your code shine!",
        ],
      },
      debugging: {
        happy: [
          "Bug hunting can be fun! Let's track down that pesky error!",
          "I enjoy debugging! Show me the error and we'll fix it!",
          "Great detective work ahead! Let's find and fix that bug!",
        ],
        neutral: [
          "Let's examine the error message and trace the issue.",
          "I'll help you debug. What error are you seeing?",
          'Debugging time. Can you share the error details?',
        ],
        thinking: [
          'Hmm, let me analyze this error pattern...',
          'This bug is interesting. Let me think about potential causes...',
          'Let me consider what might be causing this issue...',
        ],
        surprised: [
          "That's an unusual error! But we'll figure it out!",
          "Interesting bug! I haven't seen this pattern before, but let's investigate!",
          "Wow, that's a tricky one! But nothing we can't handle!",
        ],
        sad: [
          "I know debugging can be frustrating. Let's tackle it systematically.",
          "Bugs happen to everyone. We'll find and fix it together.",
          "Don't let the bug get you down. We'll solve this!",
        ],
        excited: [
          'Ooh, a challenging bug! I love a good mystery to solve!',
          "This is exciting! Let's hunt down that bug together!",
          "Bug hunting adventure! Let's get started!",
        ],
      },
      humor: {
        happy: [
          'Haha! I love a good coding joke! Want to hear one about arrays?',
          "You're in a great mood! Here's a joke: Why do programmers prefer dark mode?",
          'Laughing makes coding more fun! How about this: There are only 10 types of people...',
        ],
        neutral: [
          'A little humor helps with coding. Why did the developer go broke? Because he used up all his cache!',
          "Here's a programming joke: Why do Java developers wear glasses? Because they don't C#!",
          'Want to hear something funny? A SQL query walks into a bar, walks up to two tables and asks...',
        ],
        thinking: [
          "Let me think of a good joke... Oh! Why don't programmers like nature? It has too many bugs!",
          "Hmm, a joke... How many programmers does it take to change a light bulb? None, that's a hardware problem!",
          "Thinking of something funny... Why was the JavaScript developer sad? Because he didn't Node how to Express himself!",
        ],
        surprised: [
          "Oh, you want a joke? Sure! Why did the programmer quit? Because he didn't get arrays!",
          "Jokes? Absolutely! What's a programmer's favorite hangout place? The Foo Bar!",
          'Unexpected request, but I love it! Why do programmers always mix up Halloween and Christmas?',
        ],
        sad: [
          "Need cheering up? Here's a joke: Why was the function sad? It didn't have any arguments!",
          "Let me brighten your day: What's the object-oriented way to become wealthy? Inheritance!",
          'A joke might help: Why did the developer go to therapy? He had too many issues!',
        ],
        excited: [
          'YES! Joke time! Why did the Python programmer not respond? He was too busy dealing with his tabs and spaces!',
          "I LOVE jokes! Here's one: What did the router say to the doctor? It hurts when IP!",
          "Fantastic! Why do programmers prefer iOS development? Because there's no Windows or Android bugs!",
        ],
      },
      general: {
        happy: [
          "It's wonderful to chat with you! How's your coding journey going?",
          "I'm so glad you're here! What would you like to explore today?",
          'Your positive energy is contagious! What can I help you with?',
        ],
        neutral: [
          "Hello! I'm MARIA, your AI assistant. How can I help you today?",
          "I'm here to assist you with any questions or tasks you have.",
          'What would you like to work on together?',
        ],
        thinking: [
          "That's something to ponder... Tell me more about what you're thinking.",
          "Interesting thought... I'd like to understand more about your perspective.",
          'Let me consider that... What specific aspect interests you most?',
        ],
        surprised: [
          "Oh! That's interesting! Tell me more!",
          "Wow, I didn't expect that! Can you elaborate?",
          "That's quite surprising! I'd love to know more!",
        ],
        sad: [
          "I sense you might be having a tough time. I'm here to help however I can.",
          "Sometimes things get challenging. What's on your mind?",
          "I'm here to support you. What can I do to help?",
        ],
        excited: [
          "Your enthusiasm is amazing! Let's channel that energy into something great!",
          'I love your excitement! What awesome thing should we work on?',
          'This is going to be fantastic! Where should we start?',
        ],
      },
    };

    const intentResponses = responses[intent] || responses.general;
    const moodResponses = intentResponses[mood.current] || intentResponses.neutral;

    return moodResponses[Math.floor(Math.random() * moodResponses.length)];
  }

  /**
   * Reset dialogue context
   */
  public reset(): void {
    this.context.history = [];
    this.context.mood = { current: 'neutral', intensity: 0.5 };
  }

  /**
   * Get current context
   */
  public getContext(): DialogueContext {
    return this.context;
  }

  /**
   * Set avatar personality
   */
  public setPersonality(personality: AvatarPersonality): void {
    this.context.personality = personality;
  }
}
