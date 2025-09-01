/**
 * /configuration unknown - Handle unknown configuration commands
 * Provides help and suggestions for configuration options
 */

export const metadata = {
  name: 'unknown',
  description: 'Handle unknown configuration commands with help',
  category: 'configuration',
  version: '1.0.0',
  type: 'functional' as const,
  planRequired: 'free' as const,
  isPreview: false
};

export async function execute(context: any): Promise<any> {
  const args = context?.args || [];
  const unknownCommand = args[0] || 'unknown';
  
  return {
    success: true,
    output: `❓ Unknown configuration command: "${unknownCommand}"

🔧 Available configuration commands:
  /config setup              # Setup configuration interactively
  /config auth               # Authentication settings  
  /config model              # AI model preferences
  /config brain              # Brain configuration
  /config show               # Show current configuration
  /config reset              # Reset to defaults

💡 Did you mean one of these?
  • /config setup --help     # Get setup help
  • /config model --list     # List available models
  • /config show --all       # Show all settings

📖 Use /help config for more information`,
    requiresInput: false,
    endReason: 'success'
  };
}