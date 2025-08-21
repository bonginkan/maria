#!/usr/bin/env node

/**
 * Simple test script to demonstrate the enhanced approval UI
 */

const chalk = require('chalk');

function showEnhancedApprovalDemo() {
  // Clear screen for better visibility
  console.clear();
  
  // Top border with attention-grabbing pattern
  console.log('\n' + chalk.red('┏' + '━'.repeat(78) + '┓'));
  console.log(chalk.red('┃') + chalk.bgYellow.black.bold(' '.repeat(24) + '🤝 APPROVAL REQUEST' + ' '.repeat(24)) + chalk.red(' ┃'));
  console.log(chalk.red('┃') + chalk.bgYellow.black.bold(' '.repeat(20) + '重要な決定が必要です (Important Decision)' + ' '.repeat(17)) + chalk.red(' ┃'));
  console.log(chalk.red('┗' + '━'.repeat(78) + '┛'));
  console.log('');

  // Main content box
  console.log(chalk.cyan('┌' + '─'.repeat(78) + '┐'));
  console.log(chalk.cyan('│') + chalk.white(' 📋 Request Details:' + ' '.repeat(56)) + chalk.cyan('│'));
  console.log(chalk.cyan('├' + '─'.repeat(78) + '┤'));
  
  // Display request details with better formatting
  const themeDisplay = `Theme: ${chalk.bold.white('code-implementation')}`;
  console.log(chalk.cyan('│') + ` ${themeDisplay}${' '.repeat(77 - themeDisplay.length)}` + chalk.cyan('│'));
  
  const contextDisplay = `Context: ${chalk.white('Generate new approval system interface')}`;
  console.log(chalk.cyan('│') + ` ${contextDisplay}${' '.repeat(77 - contextDisplay.length)}` + chalk.cyan('│'));
  
  const riskDisplay = `Risk Level: ${chalk.yellow.bold('MEDIUM')}`;
  console.log(chalk.cyan('│') + ` ${riskDisplay}${' '.repeat(77 - riskDisplay.length)}` + chalk.cyan('│'));
  
  const timeDisplay = `Estimated Time: ${chalk.white('5-10 minutes')}`;
  console.log(chalk.cyan('│') + ` ${timeDisplay}${' '.repeat(77 - timeDisplay.length)}` + chalk.cyan('│'));

  console.log(chalk.cyan('├' + '─'.repeat(78) + '┤'));
  const rationaleDisplay = `Rationale: ${chalk.white('This will improve user experience and visual clarity')}`;
  console.log(chalk.cyan('│') + ` ${rationaleDisplay}${' '.repeat(77 - rationaleDisplay.length)}` + chalk.cyan('│'));

  // Display proposed actions in a box
  console.log(chalk.cyan('├' + '─'.repeat(78) + '┤'));
  console.log(chalk.cyan('│') + chalk.white(' 📝 Proposed Actions:' + ' '.repeat(56)) + chalk.cyan('│'));
  const actionText = `  1. Update QuickApprovalInterface.ts with enhanced UI`;
  console.log(chalk.cyan('│') + ` ${chalk.gray(actionText)}${' '.repeat(77 - actionText.length)}` + chalk.cyan('│'));
  const actionText2 = `  2. Add colorful chalk formatting and boxes`;
  console.log(chalk.cyan('│') + ` ${chalk.gray(actionText2)}${' '.repeat(77 - actionText2.length)}` + chalk.cyan('│'));

  console.log(chalk.cyan('└' + '─'.repeat(78) + '┘'));

  console.log('');

  // Quick choices box with emphasis
  console.log(chalk.magenta('┌' + '─'.repeat(78) + '┐'));
  console.log(chalk.magenta('│') + chalk.bgMagenta.white.bold(' ⚡ Quick Approval Options (キーボードショートカット):' + ' '.repeat(27)) + chalk.magenta('│'));
  console.log(chalk.magenta('├' + '─'.repeat(78) + '┤'));

  // Display quick choices with enhanced formatting
  const choices = [
    { key: 'shift+tab', label: 'Quick Approve', labelJa: 'いいよ', color: chalk.bgGreen.black.bold },
    { key: 'ctrl+y', label: 'Yes, Approve', labelJa: 'はい、承認', color: chalk.bgBlue.white.bold },
    { key: 'ctrl+n', label: 'No, Reject', labelJa: 'いいえ、拒否', color: chalk.bgRed.white.bold },
    { key: 'ctrl+t', label: 'Trust & Auto-approve', labelJa: '任せる', color: chalk.bgMagenta.white.bold },
    { key: 'ctrl+r', label: 'Request Review', labelJa: 'レビュー要求', color: chalk.bgYellow.black.bold },
  ];

  choices.forEach((choice) => {
    const keyDisplay = choice.color(` ${choice.key.toUpperCase()} `);
    const choiceText = `${keyDisplay} ${chalk.bold.white(choice.labelJa)} - ${chalk.gray(choice.label)}`;
    console.log(chalk.magenta('│') + ` ${choiceText}${' '.repeat(77 - choiceText.length)}` + chalk.magenta('│'));
  });

  console.log(chalk.magenta('└' + '─'.repeat(78) + '┘'));

  // Instructions with emphasis
  console.log('');
  console.log(chalk.bgBlue.white.bold(' 📌 Instructions: '));
  console.log(chalk.blue('• Press any of the above keys to make your choice'));
  console.log(chalk.blue('• Press ESC to cancel this approval request'));
  console.log(chalk.blue('• Your choice will be processed immediately'));
  console.log('');
  
  // Blinking prompt for attention (simulate with repeated characters)
  console.log(chalk.yellow.bold('>>> Waiting for your input... <<<'));
  
  // Wait 3 seconds then show selection demo
  setTimeout(() => {
    // Clear and show selection
    console.clear();
    
    // Show dramatic selection confirmation
    console.log('\n' + chalk.bgGreen.black.bold('┌' + '─'.repeat(78) + '┐'));
    console.log(chalk.bgGreen.black.bold('│') + chalk.bgGreen.black.bold(' ✓ CHOICE SELECTED / 選択完了:' + ' '.repeat(47)) + chalk.bgGreen.black.bold('│'));
    console.log(chalk.bgGreen.black.bold('├' + '─'.repeat(78) + '┤'));
    const choiceText = `Quick Approve (いいよ)`;
    const padding = ' '.repeat(Math.max(0, 76 - choiceText.length));
    console.log(chalk.bgGreen.black.bold('│') + chalk.bgGreen.black.bold(` ${choiceText}${padding}`) + chalk.bgGreen.black.bold('│'));
    console.log(chalk.bgGreen.black.bold('└' + '─'.repeat(78) + '┘'));
    
    console.log(chalk.yellow('\n🔄 Processing your approval decision...'));
    
    // Show success after another second
    setTimeout(() => {
      console.log('\n' + chalk.bgGreen.black('┌' + '─'.repeat(78) + '┐'));
      console.log(chalk.bgGreen.black('│') + chalk.bgGreen.black(' 🎉 APPROVAL PROCESSED SUCCESSFULLY / 承認処理完了!' + ' '.repeat(32)) + chalk.bgGreen.black('│'));
      console.log(chalk.bgGreen.black('└' + '─'.repeat(78) + '┘'));
      
      console.log(chalk.blue(`\n✨ Trust level updated: collaborative`));
      console.log(chalk.gray('\nDemo complete! The enhanced approval UI is now ready.'));
    }, 1000);
  }, 3000);
}

console.log(chalk.blue.bold('\n🎨 Enhanced Approval UI Demo'));
console.log(chalk.gray('This demonstrates the new highly visible approval interface...'));
showEnhancedApprovalDemo();