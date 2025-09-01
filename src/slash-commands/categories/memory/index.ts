/**
 * Memory Management Commands
 */

import { RememberCommand } from './remember.command';
import { RecallCommand } from './recall.command';
import { ForgetCommand } from './forget.command';
import { MemoryStatusCommand } from './memory-status.command';

export const memoryCommands = [
  RememberCommand,
  RecallCommand,
  ForgetCommand,
  MemoryStatusCommand,
];

export default memoryCommands;