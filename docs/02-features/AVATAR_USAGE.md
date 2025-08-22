# MARIA Avatar Command - Usage Guide

## 🎭 Overview

The `/avatar` command provides an interactive ASCII art avatar interface with voice chat capabilities in MARIA CODE CLI.

## ✅ Current Status (2025-01-20)

- **Avatar Display**: ✅ Fully functional
- **Animations**: ✅ Mouth, eyes, breathing effects working
- **Dialogue System**: ✅ AI-powered responses
- **Voice Mode**: ✅ Implemented with Whisper API
- **Build Status**: ✅ Successfully compiled

## 🚀 How to Use

### Starting the Avatar

```bash
# 1. Build the project (if not already built)
pnpm build

# 2. Start MARIA CLI
./bin/maria

# 3. In the CLI, type:
/avatar
```

### Basic Interaction

1. **Text Chat**:
   - Type messages and press Enter
   - Avatar responds with animations
   - Expressions change based on conversation

2. **Voice Mode** (Press 'V'):
   - **PTT Mode**: Hold SPACE to talk
   - **VOX Mode**: Auto-detect speech
   - **Continuous Mode**: Always listening

3. **Controls**:
   - `V`: Toggle voice mode ON/OFF
   - `M`: Switch voice modes (PTT/VOX/CONT)
   - `SPACE`: Push-to-talk (in PTT mode)
   - `ESC` or `/back`: Exit avatar mode

## 🎨 Features

### Animations
- **Mouth**: Opens/closes when talking
- **Eyes**: Blinks every 4-6 seconds
- **Breathing**: Subtle size changes
- **Expressions**: Happy, sad, thinking, surprised, laughing

### Voice Features
- **Speech Recognition**: OpenAI Whisper API
- **Real-time Transcription**: Shows what you said
- **Visual Feedback**: Recording indicators
- **Audio Level Meter**: Shows microphone input level

## 🔧 Technical Details

### Files Structure
```
src/
├── commands/
│   └── avatar.tsx          # Main avatar command
├── services/
│   ├── avatar-animator.ts  # Animation engine
│   ├── avatar-dialogue.ts  # Dialogue system
│   ├── voice-input.ts      # Microphone handling
│   └── speech-recognition.ts # Whisper API integration
```

### Requirements
- Node.js 18+
- OpenAI API key (for Whisper)
- Microphone permissions
- Terminal with UTF-8 support

## 🐛 Known Issues & Solutions

### Issue 1: Microphone Access
**Problem**: "Failed to access microphone"
**Solution**: 
- macOS: System Preferences → Security & Privacy → Microphone → Allow Terminal
- Linux: Check audio permissions with `arecord -l`
- Windows: Allow microphone access in Settings

### Issue 2: No Audio in Voice Mode
**Problem**: Voice mode doesn't detect speech
**Solution**:
- Ensure `sox` is installed: `brew install sox` (macOS)
- Check OPENAI_API_KEY is set
- Verify microphone is working: `arecord test.wav`

### Issue 3: Avatar Not Displaying
**Problem**: ASCII art shows as broken characters
**Solution**:
- Use a terminal with UTF-8 support
- Try iTerm2, Hyper, or Windows Terminal
- Set terminal font to monospace

## 📊 Test Results

```bash
✅ Build: Successful
✅ Command Registration: Working
✅ Avatar Display: Rendering correctly
✅ Animations: All states functional
✅ User Input: Responsive
✅ Voice Mode: Basic functionality working
⚠️  Advanced Audio Processing: Future enhancement
```

## 🎯 Future Enhancements

1. **Text-to-Speech**: Avatar speaks responses
2. **Multiple Avatars**: Character selection
3. **Emotion Detection**: Analyze voice tone
4. **Wake Word**: "Hey MARIA" activation
5. **Noise Cancellation**: Advanced audio processing

## 📝 Example Session

```
$ ./bin/maria
> /avatar

═══ MARIA AVATAR INTERFACE ═══

[ASCII Avatar displays here]

MARIA: Hello! I am MARIA Assistant. How can I help you today?

> Hello MARIA!
MARIA: It's wonderful to meet you! How are you doing today?

> I need help with coding
MARIA: I'm here to help! What specific coding challenge are you facing?

[Press V for voice mode]
🎤 Voice Mode Active
[Hold SPACE to talk]

[Press ESC to exit]
```

## 🤝 Contributing

To improve the avatar system:
1. Check `TALKING_SOW.md` for detailed specifications
2. Test changes with `pnpm test`
3. Update this guide with new features

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review error logs in terminal
3. Ensure all dependencies are installed
4. Verify API keys are configured

---

**Last Updated**: 2025-01-20
**Version**: 1.0.6-alpha.2
**Status**: Production Ready (with minor enhancements pending)