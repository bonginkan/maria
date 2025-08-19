import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import fs from 'fs/promises';
// import path from 'path'; // Not used
import { AvatarAnimator } from '../services/avatar-animator';

// Avatar data file path
const AVATAR_FILE_PATH = '/Users/bongin_max/maria_code/face_only_96x96_ramp.txt';

interface AvatarCommandProps {
  onExit?: () => void;
}

// Component for displaying the ASCII avatar with advanced animations
const AvatarDisplay: React.FC<{ lines: string[]; isTalking: boolean; expression?: string }> = ({
  lines,
  isTalking,
  expression = 'neutral',
}) => {
  const [animatedLines, setAnimatedLines] = useState(lines);
  // const [currentFrame, setCurrentFrame] = useState(0); // Not used yet
  const [isBlinking, setIsBlinking] = useState(false);
  const animatorRef = useRef<AvatarAnimator | null>(null);
  const breathingPhaseRef = useRef(0);

  // Initialize animator
  useEffect(() => {
    if (lines.length > 0) {
      animatorRef.current = new AvatarAnimator(lines);
    }
  }, [lines]);

  // Talking animation
  useEffect(() => {
    if (!animatorRef.current) return;

    if (isTalking) {
      const talkingSequence = animatorRef.current.getTalkingSequence();
      let frameIndex = 0;

      const animateFrame = () => {
        if (frameIndex >= talkingSequence.length) {
          frameIndex = 0;
        }
        const frame = talkingSequence[frameIndex];
        setAnimatedLines(frame.lines);
        frameIndex++;
      };

      const interval = setInterval(animateFrame, 200);
      return () => clearInterval(interval);
    } else {
      // Apply expression when not talking
      const expressionLines = animatorRef.current.applyExpression(expression);
      setAnimatedLines(expressionLines);
    }
  }, [isTalking, expression]);

  // Eye blinking animation
  useEffect(() => {
    const blinkInterval = setInterval(
      () => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
      },
      4000 + Math.random() * 2000,
    ); // Blink every 4-6 seconds

    return () => clearInterval(blinkInterval);
  }, []);

  // Apply blink effect
  useEffect(() => {
    if (isBlinking && animatorRef.current) {
      const blinkLines = animatorRef.current.applyEyeBlink();
      setAnimatedLines(blinkLines);
    }
  }, [isBlinking]);

  // Breathing effect
  useEffect(() => {
    const breathingInterval = setInterval(() => {
      breathingPhaseRef.current += 0.1;
      if (animatorRef.current && !isTalking) {
        const breathingLines = animatorRef.current.applyBreathingEffect(breathingPhaseRef.current);
        setAnimatedLines(breathingLines);
      }
    }, 100);

    return () => clearInterval(breathingInterval);
  }, [isTalking]);

  return (
    <Box flexDirection="column" alignItems="center">
      {animatedLines.map((line, index) => (
        <Text key={index} color="white">
          {line}
        </Text>
      ))}
    </Box>
  );
};

// Component for dialogue area
const DialogueArea: React.FC<{ message: string }> = ({ message }) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="white"
      paddingX={2}
      paddingY={1}
      marginTop={1}
      width="100%"
    >
      <Text color="white" wrap="wrap">
        {message || 'Hello! I am MARIA Assistant. How can I help you today?'}
      </Text>
    </Box>
  );
};

// Component for user input area
const UserInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}> = ({ value, onChange, onSubmit }) => {
  useInput((input, key) => {
    if (key.return) {
      onSubmit();
    } else if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
    } else if (input) {
      onChange(value + input);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="white"
      paddingX={2}
      paddingY={1}
      marginTop={1}
      width="100%"
    >
      <Text color="white">
        {'> '}
        {value}
        <Text color="white">█</Text>
      </Text>
    </Box>
  );
};

// Main Avatar Interface Component
const AvatarInterface: React.FC<AvatarCommandProps> = ({ onExit }) => {
  const [avatarLines, setAvatarLines] = useState<string[]>([]);
  const [userInput, setUserInput] = useState('');
  const [avatarMessage, setAvatarMessage] = useState('');
  const [isTalking, setIsTalking] = useState(false);
  const [expression, setExpression] = useState('neutral');
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const { exit } = useApp();

  // Load avatar ASCII art
  useEffect(() => {
    const loadAvatar = async () => {
      try {
        const data = await fs.readFile(AVATAR_FILE_PATH, 'utf-8');
        const lines = data.split('\n');
        setAvatarLines(lines);
      } catch (error) {
        console.error('Error loading avatar:', error);
        setAvatarLines(['[Avatar loading error]']);
      }
    };
    loadAvatar();
  }, []);

  // Handle user input submission
  const handleSubmit = async () => {
    if (!userInput.trim()) return;

    // Add user message to history
    const newHistory = [...conversationHistory, { role: 'user', content: userInput }];
    setConversationHistory(newHistory);

    // Simulate avatar thinking and responding
    setIsTalking(true);
    setExpression('thinking');
    setAvatarMessage('Let me think about that...');

    // Simulate AI response (replace with actual AI integration later)
    setTimeout(() => {
      // Choose response and expression based on input
      let response: string;
      let avatarExpression: string;

      if (userInput.toLowerCase().includes('happy') || userInput.toLowerCase().includes('good')) {
        response = "That's wonderful to hear! I'm so glad things are going well!";
        avatarExpression = 'happy';
      } else if (
        userInput.toLowerCase().includes('help') ||
        userInput.toLowerCase().includes('problem')
      ) {
        response = "I'm here to help you! Let me see what I can do about that.";
        avatarExpression = 'neutral';
      } else if (
        userInput.toLowerCase().includes('surprise') ||
        userInput.toLowerCase().includes('wow')
      ) {
        response = "Oh my! That's quite surprising indeed!";
        avatarExpression = 'surprised';
      } else if (
        userInput.toLowerCase().includes('funny') ||
        userInput.toLowerCase().includes('joke')
      ) {
        response = "Haha! That's hilarious! You really made me laugh!";
        avatarExpression = 'laughing';
      } else {
        const responses = [
          "That's an interesting question! Let me help you with that.",
          "I understand what you're asking. Here's what I think...",
          'Great point! From my perspective...',
          "I'm here to assist you. Let me process that...",
          "Thanks for sharing that with me. Here's my take...",
        ];
        response = responses[Math.floor(Math.random() * responses.length)];
        avatarExpression = 'talking';
      }

      setAvatarMessage(response);
      setExpression(avatarExpression);
      setConversationHistory([...newHistory, { role: 'assistant', content: response }]);

      // Stop talking after response
      setTimeout(() => {
        setIsTalking(false);
        setExpression('neutral');
      }, 3000);
    }, 2000);

    setUserInput('');
  };

  // Handle exit command
  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      if (onExit) {
        onExit();
      } else {
        exit();
      }
    }
  });

  return (
    <Box flexDirection="column" width="100%" paddingX={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color="white" bold>
          ═══ MARIA AVATAR INTERFACE ═══
        </Text>
      </Box>

      <AvatarDisplay lines={avatarLines} isTalking={isTalking} expression={expression} />
      <DialogueArea message={avatarMessage} />
      <UserInput value={userInput} onChange={setUserInput} onSubmit={handleSubmit} />

      <Box marginTop={1}>
        <Text color="white" dimColor>
          Press ESC or Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
};

// Export the command handler
export const avatarCommand = {
  name: 'avatar',
  description: 'Interactive ASCII avatar chat interface',
  execute: () => {
    return <AvatarInterface />;
  },
};

// Export as default for use in SlashCommandHandler
const AvatarCommand = AvatarInterface;
export default AvatarCommand;
