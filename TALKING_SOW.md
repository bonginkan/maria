# TALKING_SOW.md - Interactive ASCII Avatar CLI Feature

## Project Overview

Implement a new slash command `/avatar` in MARIA CODE to create an interactive CLI interface where users can have conversations with an ASCII art avatar.

## Design Specifications

### Layout Structure

```
┌────────────────────────────────────────────┐
│                                            │
│            ASCII AVATAR (96x96)            │
│         (Fixed position - centered)        │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│         AVATAR DIALOGUE AREA               │
│        (Avatar's speech area)              │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│          USER INPUT AREA                   │
│         (User input field)                 │
│                                            │
└────────────────────────────────────────────┘
```

### Color Scheme

- **All text**: White (#FFFFFF)
- **Background**: Terminal default (usually black)
- **Animation**: Expressed with white ASCII characters

### Animation Specifications

#### Mouth Open/Close Animation

1. **Idle state**: Mouth closed (default)
2. **Talking state**: Mouth opening and closing animation
   - Speed: 200ms intervals
   - Patterns: 3 stages (closed → slightly open → fully open)

#### Animation Target Area (Estimated)

```
Lines 43-56: Estimated mouth area
- Lines 43-46: Upper lip area
- Lines 47-52: Center of mouth (area with many $ symbols)
- Lines 53-56: Lower lip area
```

## Implementation Task List

### Phase 1: Foundation Building ✅ COMPLETED

- [x] **Task 1**: Create `/avatar` command file
  - ✅ Created `src/commands/avatar.tsx`
  - ✅ React/Ink-based component structure implemented

- [x] **Task 2**: ASCII Art Data Management
  - ✅ Avatar data loading from `/Users/bongin_max/maria_code/face_only_96x96_ramp.txt`
  - ✅ Basic mouth patterns defined (3 states: closed, half-open, fully-open)

- [x] **Task 3**: Layout Component Implementation
  - ✅ `AvatarInterface` main component created
  - ✅ Three-section layout implemented (Avatar, Dialogue, Input)
  - ✅ All text rendered in white color as specified

**Phase 1 Achievements:**

- Successfully created `/avatar` command with full component structure
- Registered command in `slash-command-handler.ts` with `avatar-interface` component type
- Basic mouth animation working with $ symbol manipulation (lines 47-52)
- User input handling with white cursor and text
- ESC/Ctrl+C exit functionality

### Phase 2: Animation Implementation ✅ COMPLETED

- [x] **Task 4**: Enhanced Mouth Animation System
  - ✅ Created `avatar-animator.ts` service class
  - ✅ Defined 5 detailed mouth patterns (closed, slightlyOpen, halfOpen, fullyOpen, wide)
  - ✅ Implemented smooth transition between animation states
  - ✅ Added animation speed control with configurable durations

- [x] **Task 5**: Advanced Animation Features
  - ✅ Added eye blinking animation (lines 14-16, blinks every 4-6 seconds)
  - ✅ Implemented breathing effect (subtle size changes using sine wave)
  - ✅ Added 6 expression states (neutral, talking, happy, surprised, thinking, laughing)
  - ✅ Synchronized animations with speech and expressions

**Phase 2 Achievements:**

- Created comprehensive `AvatarAnimator` service with advanced animation capabilities
- Implemented realistic mouth movements with 5 different states
- Added natural eye blinking with randomized intervals
- Integrated breathing effect for lifelike appearance
- Expression system responds to user input keywords
- Smooth transitions between all animation states

### Phase 3: Dialogue System ✅ COMPLETED

- [x] **Task 6**: Conversation Engine Integration
  - ✅ Created comprehensive `avatar-dialogue.ts` service
  - ✅ Avatar personality system with customizable traits
  - ✅ AI provider integration support
  - ✅ Template-based fallback responses

- [x] **Task 7**: Input Processing
  - ✅ Mood detection from user input (6 mood states)
  - ✅ Intent analysis (help, coding, debugging, humor, general)
  - ✅ Context-aware response generation
  - ✅ Expression synchronization with mood

**Phase 3 Achievements:**

- Complete dialogue service with 300+ template responses
- Mood and intent detection system
- AI provider integration ready
- Personality customization system
- Context history management (20 message limit)
- Duration estimation for speech timing

### Phase 4: Integration and Polish ✅ COMPLETED

- [x] **Task 8**: Command Registration
  - ✅ Registered in `slash-command-handler.ts` with handleAvatar method
  - ✅ Added to `ChatInterface.tsx` supportedCommands list
  - ✅ Added to `SlashCommandHandler.tsx` component routing
  - ✅ Component type 'avatar-interface' added

- [x] **Task 9**: Build and Integration
  - ✅ Successfully compiled with tsup
  - ✅ All imports properly configured with .js extensions
  - ✅ Avatar command integrated into interactive chat system

- [x] **Task 10**: Known Issues and Fixes
  - ⚠️ Issue: Command shows "Unknown command" in some cases
  - ✅ Fix: Added to supportedCommands in ChatInterface.tsx
  - ✅ Fix: Registered in SlashCommandHandler component
  - ✅ Fix: Build process completed successfully

## Current Implementation Status

### Files Created

```
✅ /Users/bongin_max/maria_code/src/commands/avatar.tsx
   - Complete avatar command with all components
   - AvatarDisplay with advanced animations
   - DialogueArea for avatar messages
   - UserInput for user interaction

✅ /Users/bongin_max/maria_code/src/services/avatar-animator.ts
   - 5 mouth animation states
   - Eye blinking system
   - Breathing effects
   - Expression management

✅ /Users/bongin_max/maria_code/src/services/avatar-dialogue.ts
   - Complete dialogue engine
   - Mood detection (6 states)
   - Intent analysis
   - 300+ template responses

✅ Integration Files Modified:
   - src/services/slash-command-handler.ts
   - src/components/ChatInterface.tsx
   - src/components/SlashCommandHandler.tsx
```

### How to Use

1. **Start MARIA CLI**:

   ```bash
   ./bin/maria
   ```

2. **Enter the avatar command**:

   ```
   /avatar
   ```

3. **Interact with the avatar**:
   - Type messages and press Enter
   - Avatar responds with animations
   - Expressions change based on keywords
   - Press ESC to exit

### Mouth Animation Patterns

```typescript
const mouthPatterns = {
  closed: [
    // Lines 47-52 $ symbols in closed mouth shape
  ],
  halfOpen: [
    // Lines 47-52 $ symbols in slightly open mouth shape
  ],
  fullOpen: [
    // Lines 47-52 $ symbols in fully open mouth shape
  ],
};
```

### Animation Cycle

```typescript
const animationCycle = [
  'closed', // 0ms
  'halfOpen', // 200ms
  'fullOpen', // 400ms
  'halfOpen', // 600ms
  'closed', // 800ms
];
```

## Success Metrics

1. **Visual Appeal**: Avatar appears lively and animated
2. **Responsiveness**: Immediate reaction to input
3. **Smoothness**: No stuttering in animation
4. **Usability**: Intuitive operation
5. **Performance**: CPU usage below 5%

## Implementation Priority

1. **Highest Priority**: Basic display and layout
2. **High**: Mouth animation
3. **Medium**: AI dialogue functionality
4. **Low**: Additional animation effects

## Estimated Development Time

- Phase 1: 2 hours
- Phase 2: 3 hours
- Phase 3: 2 hours
- Phase 4: 1 hour
- **Total**: 8 hours

## Future Expansion Possibilities

- Multiple avatar selection feature
- Emotional expressions (eye changes, etc.)
- Integration with voice synthesis
- Customizable personality settings
- Avatar costume changes

## Avatar Personality Settings Proposal

- Name: MARIA Assistant
- Personality: Friendly and approachable
- Speaking style: Casual but professional
- Characteristics: Encourages and supports developers

---

Based on this SOW, we will proceed with implementation step by step. Each task is divided into independently developable and testable units, suitable for agile development methodology.
