import React from 'react';
import AvatarCommand from './avatar';

interface VoiceCommandProps {
  onExit?: () => void;
}

// Voice command that launches avatar with voice mode enabled
const VoiceCommand: React.FC<VoiceCommandProps> = ({ onExit }) => {
  // Launch avatar with voice mode enabled by default
  return <AvatarCommand onExit={onExit} />;
};

// Export the command handler
export const voiceCommand = {
  name: 'voice',
  description: 'Start voice chat with ASCII avatar',
  execute: () => {
    return <VoiceCommand />;
  },
};

// Export as default for use in SlashCommandHandler
export default VoiceCommand;
