/**
 * Multimodal Commands (Cloud-Only) - Image, Voice, Video Generation
 * Production-ready implementation following SOW v2.0 patterns
 */

import { CommandArgs, CommandContext, CommandResult } from "../../types.js";
import { withAuth, withQuotaCheck, withPlan } from "../../shared/auth-quota-pipe.js";
import { callApi } from "../../shared/cloud-api-client.js";
import { formatError } from "../../shared/telemetry-helper.js";
import { trackCommand } from "../../../services/telemetry/command-tracker.js";

interface MultimodalResponse {
  success: boolean;
  data?: {
    url?: string;
    filename?: string;
    content?: string;
    duration?: number;
  };
  error?: string;
}

// Image Generation Command
export const imageCommand = {
  name: "image",
  category: "multimodal" as const,
  description: "Generate images using AI (cloud-only)",
  usage: "<prompt> [--style=realistic|artistic|cartoon] [--size=1024x1024]",
  
  execute: withAuth(withQuotaCheck("image")(withPlan("FREE")(async (context, ...args) => {
    const startTime = Date.now();
    const prompt = args.join(' ').trim();
    
    if (!prompt) {
      console.log('💡 Usage: /image sunset over mountains --style=realistic');
      console.log('🧪 Preview Feature • Join waitlist: https://maria-code.ai/waitlist');
      return { success: false, endReason: 'invalid-input' };
    }

    console.log('🎨 Generating image with AI...');

    try {
      const response = await callApi('/v1/generate/image', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          model: 'imagen-4.0',
          style: extractStyle(args),
          size: extractSize(args) || '1024x1024',
          quality: 'standard'
        })
      });

      const result = response as MultimodalResponse;
      
      if (result.success && result.data?.url) {
        console.log(`✅ Image generated successfully`);
        console.log(`🔗 URL: ${result.data.url}`);
        
        if (result.data.filename) {
          console.log(`📁 Saved: ${result.data.filename}`);
        }
        
        console.log(`\n🧪 Preview Feature • Full multimodal suite coming in Pro`);
        console.log(`📋 Join waitlist: https://maria-code.ai/waitlist`);
      } else {
        console.log(`❌ ${result.error || 'Image generation failed'}`);
      }

      await trackCommand({
        cmd: 'image',
        status: result.success ? 'success' : 'error',
        latencyMs: Date.now() - startTime,
        plan: context.plan.name,
        quotaLeft: context.quotaLeft,
        userId: context.userId
      });

      return { success: result.success, endReason: 'completed' };

    } catch (error) {
      console.log('❌ Image generation service unavailable');
      console.log('🧪 Preview Feature • Coming soon in Pro');
      
      await trackCommand({
        cmd: 'image',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: context.plan.name,
        quotaLeft: context.quotaLeft,
        userId: context.userId
      });

      return { success: false, endReason: 'service-error' };
    }
  })))
};

// Voice Generation Command
export const voiceCommand = {
  name: "voice",
  category: "multimodal" as const,
  description: "Generate speech from text (cloud-only)",
  usage: "<text> [--voice=alloy|echo|fable|nova] [--speed=0.5-2.0]",
  
  execute: withAuth(withQuotaCheck("voice")(withPlan("STARTER")(async (context, ...args) => {
    const startTime = Date.now();
    const text = args.join(' ').trim();
    
    if (!text) {
      console.log('💡 Usage: /voice Hello world --voice=nova');
      console.log('🧪 Preview Feature (Starter+) • Join waitlist: https://maria-code.ai/waitlist');
      return { success: false, endReason: 'invalid-input' };
    }

    console.log('🗣️ Generating speech with AI...');

    try {
      const response = await callApi('/v1/generate/voice', {
        method: 'POST',
        body: JSON.stringify({
          text,
          voice: extractVoice(args) || 'alloy',
          model: 'gemini-tts-pro',
          speed: extractSpeed(args) || 1.0,
          format: 'mp3'
        })
      });

      const result = response as MultimodalResponse;
      
      if (result.success && result.data?.url) {
        console.log(`✅ Speech generated successfully`);
        console.log(`🔗 Audio: ${result.data.url}`);
        console.log(`⏱️ Duration: ${result.data.duration || 0}s`);
        
        console.log(`\n🧪 Preview Feature • Full voice suite in Starter+`);
        console.log(`📋 Upgrade: https://maria-code.ai/upgrade`);
      } else {
        console.log(`❌ ${result.error || 'Voice generation failed'}`);
      }

      await trackCommand({
        cmd: 'voice',
        status: result.success ? 'success' : 'error',
        latencyMs: Date.now() - startTime,
        plan: context.plan.name,
        quotaLeft: context.quotaLeft,
        userId: context.userId
      });

      return { success: result.success, endReason: 'completed' };

    } catch (error) {
      console.log('❌ Voice generation service unavailable');
      console.log('🧪 Preview Feature • Coming soon in Starter+');
      
      await trackCommand({
        cmd: 'voice',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: context.plan.name,
        quotaLeft: context.quotaLeft,
        userId: context.userId
      });

      return { success: false, endReason: 'service-error' };
    }
  })))
};

// Video Generation Command
export const videoCommand = {
  name: "video",
  category: "multimodal" as const,
  description: "Generate videos using AI (cloud-only)",
  usage: "<prompt> [--duration=5|10|15] [--style=cinematic|documentary|cartoon]",
  
  execute: withAuth(withQuotaCheck("video")(withPlan("PRO")(async (context, ...args) => {
    const startTime = Date.now();
    const prompt = args.join(' ').trim();
    
    if (!prompt) {
      console.log('💡 Usage: /video a cat playing piano --duration=10 --style=cinematic');
      console.log('🧪 Preview Feature (Pro+) • Join waitlist: https://maria-code.ai/waitlist');
      return { success: false, endReason: 'invalid-input' };
    }

    console.log('🎬 Generating video with AI...');

    try {
      const response = await callApi('/v1/generate/video', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          model: 'veo-2.0',
          duration: extractDuration(args) || 5,
          style: extractVideoStyle(args) || 'cinematic',
          resolution: '1080p',
          fps: 30
        })
      });

      const result = response as MultimodalResponse;
      
      if (result.success && result.data?.url) {
        console.log(`✅ Video generated successfully`);
        console.log(`🔗 Video: ${result.data.url}`);
        console.log(`⏱️ Duration: ${result.data.duration || 0}s`);
        
        console.log(`\n🧪 Preview Feature • Full video suite in Pro+`);
        console.log(`📋 Upgrade: https://maria-code.ai/pricing`);
      } else {
        console.log(`❌ ${result.error || 'Video generation failed'}`);
      }

      await trackCommand({
        cmd: 'video',
        status: result.success ? 'success' : 'error',
        latencyMs: Date.now() - startTime,
        plan: context.plan.name,
        quotaLeft: context.quotaLeft,
        userId: context.userId
      });

      return { success: result.success, endReason: 'completed' };

    } catch (error) {
      console.log('❌ Video generation service unavailable');
      console.log('🧪 Preview Feature • Coming soon in Pro+');
      
      await trackCommand({
        cmd: 'video',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: context.plan.name,
        quotaLeft: context.quotaLeft,
        userId: context.userId
      });

      return { success: false, endReason: 'service-error' };
    }
  })))
};

// Helper functions for argument parsing
function extractStyle(args: string[]): string | undefined {
  const styleArg = args.find(arg => arg.startsWith('--style='));
  return styleArg?.split('=')[1];
}

function extractSize(args: string[]): string | undefined {
  const sizeArg = args.find(arg => arg.startsWith('--size='));
  return sizeArg?.split('=')[1];
}

function extractVoice(args: string[]): string | undefined {
  const voiceArg = args.find(arg => arg.startsWith('--voice='));
  return voiceArg?.split('=')[1];
}

function extractSpeed(args: string[]): number | undefined {
  const speedArg = args.find(arg => arg.startsWith('--speed='));
  const speed = speedArg?.split('=')[1];
  return speed ? parseFloat(speed) : undefined;
}

function extractDuration(args: string[]): number | undefined {
  const durationArg = args.find(arg => arg.startsWith('--duration='));
  const duration = durationArg?.split('=')[1];
  return duration ? parseInt(duration) : undefined;
}

function extractVideoStyle(args: string[]): string | undefined {
  const styleArg = args.find(arg => arg.startsWith('--style='));
  return styleArg?.split('=')[1];
}

// Export metadata and execute for command registry
export const metadata = {
  name: 'multimodal',
  description: 'Generate images, voice, and video using AI (cloud-only)',
  category: 'code',
  version: '1.0.0',
  type: 'functional' as const,
  planRequired: 'free' as const,
  isPreview: true
};

export async function execute(context: any): Promise<any> {
  // Route to the appropriate multimodal command based on first argument
  const command = context.args?.[0];
  const remainingArgs = context.args?.slice(1) || [];
  
  switch(command) {
    case 'image':
      return await imageCommand.execute(context, ...remainingArgs);
    case 'voice':
      return await voiceCommand.execute(context, ...remainingArgs);
    case 'video':
      return await videoCommand.execute(context, ...remainingArgs);
    default:
      console.log('🎨 Multimodal Generation Commands:');
      console.log('  /multimodal image <prompt>  - Generate images');
      console.log('  /multimodal voice <text>    - Generate speech');
      console.log('  /multimodal video <prompt>  - Generate videos');
      return { success: false, endReason: 'invalid-input' };
  }
}