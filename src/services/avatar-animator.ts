/**
 * Avatar Animator Service
 * Handles advanced animations for the ASCII avatar including mouth movements,
 * eye blinking, breathing effects, and _expression states
 */

export interface AnimationFrame {
  lines: string[];
  _duration: number; // milliseconds
}

export interface MouthPattern {
  closed: string[];
  slightlyOpen: string[];
  halfOpen: string[];
  fullyOpen: string[];
  wide: string[];
}

export interface Expression {
  name: string;
  mouthState: keyof MouthPattern;
  eyeModifier?: (_line: string) => string;
  _duration?: number;
}

export class AvatarAnimator {
  private originalLines: string[] = [];
  private currentLines: string[] = [];
  private mouthLineIndices = { start: 46, end: 51 }; // Lines 47-52 (0-indexed)
  private eyeLineIndices = { start: 13, end: 15 }; // Lines 14-16 (0-indexed)

  // Detailed mouth patterns for $ symbol area (lines 47-52)
  private mouthPatterns: MouthPattern = {
    closed: [
      "      11uuxxffXXYYUUCC,,;;[[[[[[;;II;;II;;;;;;,,,,::::::::,,11::11((II;;;;iiii~~^^``    $$$$$$$$$$$$$$$$$$$$$$}}  $$$$**$$ll;;::;;;;((,,ii!!II::,,;;::!!;;;;}}::ddbbbbbbkkbbbbbbkkkkkkkkkkhh",
      "      11xxrrffXXYYJJCC,,^^[[[[ii;;;;;;;;;;II::,,,,,,::;;;;II!!^^++pp^^ff$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$@@$$$$$$$$$$$$$$$$$$$$>>]]::;;II,,,,,,::<<;;II~~??bbbbbbbbkkkkkkkkkkkkkkkkkkhh",
      "      11jjxxffYYYYJJ;;;;nn]][[;;;;;;;;ii,,;;,,,,,,;;,,;;;;``,,WW$$$$$$$$$$$$$$$$%%MMJJaa$$$$$$$$$$$$$$$$$$$$$$%%OO&&$$@@$$$$##%%$$$$$$$$$$$$::,,,,::,,]];;;;;;??11kkwwqqbbkkkkkkbbkkkkkkhhkk",
      "      ))jjnnffYYYYYY;;;;**??[[;;;;::;;??::,,,,,,,,ll^^^^$$$$$$$$$$$$ZZCCpp##ZZmm@@$$$$##BB$$$$$$$$$$$$$$$$$$$$$$$$$$##$$!!      ++%%OO88$$$$``,,,,::,,]],,;;;;[[;;qqddbbhhkkkkkkbbkkkkkkhhkk",
      "      11ffnnffYYzz;;^^;;}}??~~;;;;::,,++,,,,::,,^^'',,,,$$$$$$ww          ''    ++pp$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$hhxx              ..CCxx$$``^^,,,,,,??>>,,,,??++ppqqpphhhhkkbbbbkkkkkkhhkk",
      "      11ffnnffYYYY,,::CC--[[II;;;;;;iiii::,,,,^^^^  ^^,,%%&&//^^''                  dd$$$$$$$$$$$$$$$$$$$$$$$$$$BB||            MM&&----XXBB^^^^^^,,,,++??,,,,::}}00ppqqppkkkkbbbbkkkkkkhhkk",
    ],
    slightlyOpen: [
      "      11uuxxffXXYYUUCC,,;;[[[[[[;;II;;II;;;;;;,,,,::::::::,,11::11((II;;;;iiii~~^^``    ooooooooooooooooooooooo}}  oooo**ooll;;::;;;;((,,ii!!II::,,;;::!!;;;;}}::ddbbbbbbkkbbbbbbkkkkkkkkkkhh",
      "      11xxrrffXXYYJJCC,,^^[[[[ii;;;;;;;;;;II::,,,,,,::;;;;II!!^^++pp^^ffoooooooooooooooooooooooooooooooooooooo@@oooooooooooooooooooooo>>]]::;;II,,,,,,::<<;;II~~??bbbbbbbbkkkkkkkkkkkkkkkkkkhh",
      "      11jjxxffYYYYJJ;;;;nn]][[;;;;;;;;ii,,;;,,,,,,;;,,;;;;``,,WWoooooooooooooooo%%MMJJaaoooooooooooooooooooooo%%OO&&oo@@oooo##%%oooooooooooo::,,,,::,,]];;;;;;??11kkwwqqbbkkkkkkbbkkkkkkhhkk",
      "      ))jjnnffYYYYYY;;;;**??[[;;;;::;;??::,,,,,,,,ll^^^^ooooooooooooZZCCpp##ZZmm@@oooo##BBoooooooooooooooooooooooooo##oo!!      ++%%OO88oooo``,,,,::,,]],,;;;;[[;;qqddbbhhkkkkkkbbkkkkkkhhkk",
      "      11ffnnffYYzz;;^^;;}}??~~;;;;::,,++,,,,::,,^^'',,,,ooooooww          ''    ++ppoooooooooooooooooooooooooooooohhxx              ..CCxxoo``^^,,,,,,??>>,,,,??++ppqqpphhhhkkbbbbkkkkkkhhkk",
      "      11ffnnffYYYY,,::CC--[[II;;;;;;iiii::,,,,^^^^  ^^,,%%&&//^^''                  ddoooooooooooooooooooooooooooBB||            MM&&----XXBB^^^^^^,,,,++??,,,,::}}00ppqqppkkkkbbbbkkkkkkhhkk",
    ],
    halfOpen: [
      "      11uuxxffXXYYUUCC,,;;[[[[[[;;II;;II;;;;;;,,,,::::::::,,11::11((II;;;;iiii~~^^``    OOOOOOOOOOOOOOOOOOOOOOOO}}  OOOO**OOll;;::;;;;((,,ii!!II::,,;;::!!;;;;}}::ddbbbbbbkkbbbbbbkkkkkkkkkkhh",
      "      11xxrrffXXYYJJCC,,^^[[[[ii;;;;;;;;;;II::,,,,,,::;;;;II!!^^++pp^^ffOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO@@OOOOOOOOOOOOOOOOOOOOOO>>]]::;;II,,,,,,::<<;;II~~??bbbbbbbbkkkkkkkkkkkkkkkkkkhh",
      "      11jjxxffYYYYJJ;;;;nn]][[;;;;;;;;ii,,;;,,,,,,;;,,;;;;``,,WWOOOOOOOOOOOOOOO%%MMJJaaOOOOOOOOOOOOOOOOOOOOOOO%%OO&&OO@@OOOO##%%OOOOOOOOOOOO::,,,,::,,]];;;;;;??11kkwwqqbbkkkkkkbbkkkkkkhhkk",
      "      ))jjnnffYYYYYY;;;;**??[[;;;;::;;??::,,,,,,,,ll^^^^OOOOOOOOOOOOZZCCPP##ZZmm@@OOOO##BBOOOOOOOOOOOOOOOOOOOOOOOOOOO##OO!!      ++%%OO88OOOO``,,,,::,,]],,;;;;[[;;qqddbbhhkkkkkkbbkkkkkkhhkk",
      "      11ffnnffYYzz;;^^;;}}??~~;;;;::,,++,,,,::,,^^'',,,,OOOOOOww          ''    ++ppOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOhhxx              ..CCxxOO``^^,,,,,,??>>,,,,??++ppqqpphhhhkkbbbbkkkkkkhhkk",
      "      11ffnnffYYYY,,::CC--[[II;;;;;;iiii::,,,,^^^^  ^^,,%%&&//^^''                  ddOOOOOOOOOOOOOOOOOOOOOOOOOOBB||            MM&&----XXBB^^^^^^,,,,++??,,,,::}}00ppqqppkkkkbbbbkkkkkkhhkk",
    ],
    fullyOpen: [
      "      11uuxxffXXYYUUCC,,;;[[[[[[;;II;;II;;;;;;,,,,::::::::,,11::11((II;;;;iiii~~^^``                            }}      **  ll;;::;;;;((,,ii!!II::,,;;::!!;;;;}}::ddbbbbbbkkbbbbbbkkkkkkkkkkhh",
      "      11xxrrffXXYYJJCC,,^^[[[[ii;;;;;;;;;;II::,,,,,,::;;;;II!!^^++pp^^ff                                      @@                    >>]]::;;II,,,,,,::<<;;II~~??bbbbbbbbkkkkkkkkkkkkkkkkkkhh",
      "      11jjxxffYYYYJJ;;;;nn]][[;;;;;;;;ii,,;;,,,,,,;;,,;;;;``,,WW                  MMJJaa                      %%  &&  @@    ##%%            ::,,,,::,,]];;;;;;??11kkwwqqbbkkkkkkbbkkkkkkhhkk",
      "      ))jjnnffYYYYYY;;;;**??[[;;;;::;;??::,,,,,,,,ll^^^^                ZZCCpp##ZZmm@@    ##BB                        ##  !!      ++%%  88    ``,,,,::,,]],,;;;;[[;;qqddbbhhkkkkkkbbkkkkkkhhkk",
      "      11ffnnffYYzz;;^^;;}}??~~;;;;::,,++,,,,::,,^^'',,,,      ww          ''    ++pp                              hhxx              ..CCxx  ``^^,,,,,,??>>,,,,??++ppqqpphhhhkkbbbbkkkkkkhhkk",
      "      11ffnnffYYYY,,::CC--[[II;;;;;;iiii::,,,,^^^^  ^^,,%%&&//^^''                  dd                            BB||            MM&&----XXBB^^^^^^,,,,++??,,,,::}}00ppqqppkkkkbbbbkkkkkkhhkk",
    ],
    wide: [
      "      11uuxxffXXYYUUCC,,;;[[[[[[;;II;;II;;;;;;,,,,::::::::,,11::11((II;;;;iiii                                                      ((,,ii!!II::,,;;::!!;;;;}}::ddbbbbbbkkbbbbbbkkkkkkkkkkhh",
      "      11xxrrffXXYYJJCC,,^^[[[[ii;;;;;;;;;;II::,,,,,,::;;;;II!!^^++pp^^                                                                  ]]::;;II,,,,,,::<<;;II~~??bbbbbbbbkkkkkkkkkkkkkkkkkkhh",
      "      11jjxxffYYYYJJ;;;;nn]][[;;;;;;;;ii,,;;,,,,,,;;,,;;;;``,,                                                                                ::,,,,::,,]];;;;;;??11kkwwqqbbkkkkkkbbkkkkkkhhkk",
      "      ))jjnnffYYYYYY;;;;**??[[;;;;::;;??::,,,,,,,,ll^^^^                                                                                      ``,,,,::,,]],,;;;;[[;;qqddbbhhkkkkkkbbkkkkkkhhkk",
      "      11ffnnffYYzz;;^^;;}}??~~;;;;::,,++,,,,::,,^^'',,,,                                                                                      ``^^,,,,,,??>>,,,,??++ppqqpphhhhkkbbbbkkkkkkhhkk",
      "      11ffnnffYYYY,,::CC--[[II;;;;;;iiii::,,,,^^^^  ^^,,                                                                                      ^^^^^^,,,,++??,,,,::}}00ppqqppkkkkbbbbkkkkkkhhkk",
    ],
  };

  // Expression presets
  private expressions: Record<string, Expression> = {
    neutral: { name: "neutral", mouthState: "closed" },
    talking: { name: "talking", mouthState: "halfOpen" },
    happy: { name: "happy", mouthState: "slightlyOpen" },
    surprised: { name: "surprised", mouthState: "fullyOpen" },
    thinking: { name: "thinking", mouthState: "closed" },
    laughing: { name: "laughing", mouthState: "wide" },
  };

  constructor(_avatarLines: string[]) {
    this.originalLines = [..._avatarLines];
    this.currentLines = [..._avatarLines];
  }

  /**
   * Apply mouth animation based on current state
   */
  public applyMouthAnimation(state: keyof MouthPattern): string[] {
    const _animatedLines = [...this.originalLines];
    const _mouthPattern = this.mouthPatterns[state];

    // Replace mouth area lines with animated pattern
    for (let i = 0; i < _mouthPattern.length; i++) {
      const _lineIndex = this.mouthLineIndices.start + i;
      if (_lineIndex < _animatedLines.length && i < _mouthPattern.length) {
        _animatedLines[_lineIndex] = _mouthPattern[i] || "";
      }
    }

    this.currentLines = _animatedLines;
    return _animatedLines;
  }

  /**
   * Apply eye blinking animation
   */
  public applyEyeBlink(): string[] {
    const _animatedLines = [...this.currentLines];

    // Simple blink by replacing eye characters with dashes
    for (let i = this.eyeLineIndices.start; i <= this.eyeLineIndices.end; i++) {
      if (i < _animatedLines.length) {
        // Replace 'I' and 'l' with '-' for closed eyes effect
        _animatedLines[i] = _animatedLines[i]!.replace(/[Il]/g, "-");
      }
    }

    return _animatedLines;
  }

  /**
   * Apply breathing effect (subtle size change)
   */
  public applyBreathingEffect(phase: number): string[] {
    const _animatedLines = [...this.currentLines];
    const _breathScale = Math.sin(phase) * 0.02 + 1; // Subtle 2% variation

    // Add or remove _spaces at the beginning for breathing effect
    const _spaceCount = Math.floor(_breathScale * 2);
    const _spaces = " ".repeat(Math.max(0, _spaceCount));

    return _animatedLines.map((_line) => _spaces + _line);
  }

  /**
   * Get animation sequence for talking
   */
  public getTalkingSequence(): AnimationFrame[] {
    return [
      { lines: this.applyMouthAnimation("closed"), _duration: 200 },
      { lines: this.applyMouthAnimation("slightlyOpen"), _duration: 150 },
      { lines: this.applyMouthAnimation("halfOpen"), _duration: 200 },
      { lines: this.applyMouthAnimation("fullyOpen"), _duration: 150 },
      { lines: this.applyMouthAnimation("halfOpen"), _duration: 200 },
      { lines: this.applyMouthAnimation("slightlyOpen"), _duration: 150 },
      { lines: this.applyMouthAnimation("closed"), _duration: 200 },
    ];
  }

  /**
   * Apply _expression to avatar
   */
  public applyExpression(expressionName: string): string[] {
    const _expression = this.expressions[expressionName];
    if (!_expression) {
      return this.currentLines;
    }

    const _animatedLines = this.applyMouthAnimation(_expression.mouthState);

    // Apply eye modifier if exists
    if (_expression.eyeModifier) {
      for (
        let i = this.eyeLineIndices.start;
        i <= this.eyeLineIndices.end;
        i++
      ) {
        if (i < _animatedLines.length) {
          _animatedLines[i] = _expression.eyeModifier(_animatedLines[i] || "");
        }
      }
    }

    return _animatedLines;
  }

  /**
   * Create smooth transition between two mouth states
   */
  public createTransition(
    fromState: keyof MouthPattern,
    toState: keyof MouthPattern,
    steps: number = 3,
  ): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const _duration = 100; // ms per frame

    // Start frame
    frames.push({ lines: this.applyMouthAnimation(fromState), _duration });

    // Intermediate frames (if needed)
    if (steps > 2) {
      const intermediateStates: Array<keyof MouthPattern> = [
        "slightlyOpen",
        "halfOpen",
      ];
      for (let i = 0; i < Math.min(steps - 2, intermediateStates.length); i++) {
        frames.push({
          lines: this.applyMouthAnimation(intermediateStates[i]!),
          _duration,
        });
      }
    }

    // End frame
    frames.push({ lines: this.applyMouthAnimation(toState), _duration });

    return frames;
  }

  /**
   * Reset to original state
   */
  public reset(): string[] {
    this.currentLines = [...this.originalLines];
    return this.currentLines;
  }
}
