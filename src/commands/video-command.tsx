/**
 * MARIA CODE Video Generation Commands
 * /video - Text to Video and Image to Video generation using Wan 2.2 models
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// Video model profiles
const VIDEO_MODELS = {
  'wan-2.2-t2v-a14b': {
    name: 'Wan 2.2 T2V A14B',
    badge: '🎬',
    description: 'High-quality text to video, 14B parameters',
    type: 'text-to-video',
    huggingface: 'Wan-AI/Wan2.2-T2V-A14B-Diffusers',
    vram: '~16GB',
    maxFrames: 81,
    resolution: '1280x720'
  },
  'wan-2.2-ti2v-5b': {
    name: 'Wan 2.2 TI2V 5B',
    badge: '⚡',
    description: 'Fast text/image to video, 5B parameters',
    type: 'text-image-to-video',
    huggingface: 'Wan-AI/Wan2.2-TI2V-5B',
    vram: '~8GB',
    maxFrames: 33,
    resolution: '1280x704'
  },
  'wan-2.2-i2v-a14b': {
    name: 'Wan 2.2 I2V A14B',
    badge: '🖼️',
    description: 'Image to video transformation, 14B parameters',
    type: 'image-to-video',
    huggingface: 'Wan-AI/Wan2.2-I2V-A14B',
    vram: '~16GB',
    maxFrames: 81,
    resolution: '1280x720'
  }
};

interface VideoGenerationParams {
  prompt: string;
  model: keyof typeof VIDEO_MODELS;
  frames?: number;
  fps?: number;
  width?: number;
  height?: number;
  inputImage?: string;
  outputPath?: string;
  steps?: number;
  seed?: number;
}

interface VideoCommandProps {
  initialMode?: 'generate' | 'models' | 'compare';
  params?: Partial<VideoGenerationParams>;
}

/**
 * /video - Interactive video generation command
 */
export const VideoCommand: React.FC<VideoCommandProps> = ({ 
  initialMode = 'generate',
  params = {}
}) => {
  const [mode] = useState(initialMode);
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  
  // Form state
  const [prompt, setPrompt] = useState(params.prompt || '');
  const [selectedModel, setSelectedModel] = useState<keyof typeof VIDEO_MODELS>(
    params.model || 'wan-2.2-ti2v-5b'
  );
  const [frames] = useState(params.frames || 33);
  const [fps] = useState(params.fps || 24);
  const [inputImage] = useState(params.inputImage || '');
  const [outputPath] = useState(
    params.outputPath || `~/maria_output/video_${Date.now()}.mp4`
  );

  useInput((input, key) => {
    if (key.escape) {
      process.exit(0);
    }
    if (key.ctrl && input === 'c') {
      process.exit(0);
    }
  });

  const checkHuggingFaceSetup = async (): Promise<boolean> => {
    try {
      await execAsync('which huggingface-cli');
      const { stdout } = await execAsync('huggingface-cli whoami');
      return stdout.trim() !== 'Not logged in';
    } catch {
      return false;
    }
  };

  const setupHuggingFace = async (): Promise<void> => {
    setProgress('Setting up Hugging Face CLI...');
    
    try {
      // Install huggingface-cli if not present
      try {
        await execAsync('which huggingface-cli');
      } catch {
        await execAsync('pip install --upgrade huggingface_hub[cli]');
      }

      // Login with token from environment
      const hfToken = process.env.HF_TOKEN;
      if (!hfToken) {
        throw new Error('HF_TOKEN not found in environment variables');
      }

      await execAsync(`huggingface-cli login --token ${hfToken}`);
      setProgress('Hugging Face CLI setup complete');
    } catch (error) {
      throw new Error(`Failed to setup Hugging Face CLI: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const downloadModel = async (modelId: keyof typeof VIDEO_MODELS): Promise<void> => {
    const model = VIDEO_MODELS[modelId];
    const modelPath = `${process.env.HF_MODEL_DIR || '~/.maria/huggingface/models'}/${modelId}`;
    
    setProgress(`Downloading ${model.name}... This may take several minutes`);
    
    try {
      // Create model directory
      await execAsync(`mkdir -p "${modelPath}"`);
      
      // Download model
      await execAsync(`huggingface-cli download ${model.huggingface} --local-dir "${modelPath}"`);
      
      setProgress(`Model ${model.name} downloaded successfully`);
    } catch (error) {
      throw new Error(`Failed to download model: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const setupComfyUI = async (): Promise<void> => {
    const comfyPath = `${process.env.HOME}/.maria/comfyui`;
    
    setProgress('Setting up ComfyUI...');
    
    try {
      // Check if ComfyUI exists
      try {
        await fs.access(path.join(comfyPath, 'main.py'));
      } catch {
        // Clone ComfyUI
        await execAsync(`mkdir -p "${comfyPath}"`);
        await execAsync(`git clone https://github.com/comfyanonymous/ComfyUI.git "${comfyPath}"`);
        
        // Install dependencies
        await execAsync(`cd "${comfyPath}" && pip install -r requirements.txt`);
      }
      
      setProgress('ComfyUI setup complete');
    } catch (error) {
      throw new Error(`Failed to setup ComfyUI: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const generateVideo = async (params: VideoGenerationParams): Promise<string> => {
    const timestamp = Date.now();
    const outputDir = `${process.env.HOME}/.maria/outputs/video/${timestamp}`;
    const outputFile = path.join(outputDir, `${params.model}_${timestamp}.mp4`);
    
    setProgress('Initializing video generation...');
    
    try {
      // Create output directory
      await execAsync(`mkdir -p "${outputDir}"`);
      
      // Setup Hugging Face and ComfyUI if needed
      const isHFReady = await checkHuggingFaceSetup();
      if (!isHFReady) {
        await setupHuggingFace();
      }
      
      await setupComfyUI();
      await downloadModel(params.model);
      
      // Generate workflow JSON
      const workflowPath = await createComfyUIWorkflow(params, outputFile);
      
      // Run ComfyUI headless
      setProgress('Generating video...');
      await runComfyUIHeadless(workflowPath, outputFile);
      
      return outputFile;
    } catch (error) {
      throw new Error(`Video generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const createComfyUIWorkflow = async (
    params: VideoGenerationParams, 
    outputPath: string
  ): Promise<string> => {
    const model = VIDEO_MODELS[params.model];
    const workflowDir = `${process.env.HOME}/.maria/comfyui/workflows`;
    const workflowPath = path.join(workflowDir, `${params.model}_workflow.json`);
    
    await execAsync(`mkdir -p "${workflowDir}"`);
    
    // Basic workflow template (simplified)
    const workflow = {
      nodes: [
        {
          id: 1,
          class: 'CLIPTextEncode',
          inputs: {
            text: params.prompt,
            clip: ['model_loader', 1]
          }
        },
        {
          id: 2,
          class: 'VideoGenerate',
          inputs: {
            conditioning: [1, 0],
            frames: params.frames || model.maxFrames,
            fps: params.fps || 24,
            width: params.width || parseInt(model.resolution.split('x')[0] ?? '720'),
            height: params.height || parseInt(model.resolution.split('x')[1] ?? '480'),
            steps: params.steps || 20,
            seed: params.seed || Math.floor(Math.random() * 1000000)
          }
        },
        {
          id: 3,
          class: 'SaveVideo',
          inputs: {
            video: [2, 0],
            filename_prefix: path.basename(outputPath, '.mp4')
          }
        }
      ]
    };
    
    await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2));
    return workflowPath;
  };

  const runComfyUIHeadless = async (workflowPath: string, outputPath: string): Promise<void> => {
    const comfyPath = `${process.env.HOME}/.maria/comfyui`;
    const port = 8188;
    
    setProgress('Starting ComfyUI server...');
    
    // Start ComfyUI in background
    const serverProcess = exec(`cd "${comfyPath}" && python main.py --listen 127.0.0.1 --port ${port} --headless`);
    
    try {
      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Submit workflow
      setProgress('Submitting generation job...');
      const workflow = await fs.readFile(workflowPath, 'utf-8');
      
      await execAsync(`curl -s -X POST "http://127.0.0.1:${port}/prompt" \
        -H "Content-Type: application/json" \
        --data '${workflow}'`);
      
      // Poll for completion
      setProgress('Video generation in progress...');
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max
      
      while (attempts < maxAttempts) {
        try {
          await fs.access(outputPath);
          break;
        } catch {
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
          setProgress(`Video generation in progress... (${attempts * 5}s)`);
        }
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Video generation timeout');
      }
      
    } finally {
      // Kill server
      if (serverProcess.pid) {
        process.kill(serverProcess.pid);
      }
    }
  };

  const handleGenerate = async (): Promise<void> => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError('');
    setProgress('');
    
    try {
      const outputFile = await generateVideo({
        prompt,
        model: selectedModel,
        frames,
        fps,
        inputImage: inputImage || undefined,
        outputPath,
        steps: 20,
        seed: Math.floor(Math.random() * 1000000)
      });
      
      setResult(outputFile);
      setProgress('Video generated successfully!');
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const renderModelList = () => (
    <Box flexDirection="column">
      <Box >
        <Text bold color="cyan">🎬 Available Video Models</Text>
      </Box>
      
      <Box flexDirection="column" gap={1}>
        {Object.entries(VIDEO_MODELS).map(([id, model]) => (
          <Box key={id} gap={1}>
            <Text color="yellow">{model.badge}</Text>
            <Box width={25}>
              <Text bold>{model.name}</Text>
            </Box>
            <Box width={30}>
              <Text color="gray">{model.description}</Text>
            </Box>
            <Text color="green">{model.type}</Text>
            <Text color="magenta">VRAM: {model.vram}</Text>
            <Text color="cyan">{model.resolution}</Text>
          </Box>
        ))}
      </Box>
      
      <Box marginTop={1}>
        <Text color="gray">💡 Use `/video` to start generation</Text>
      </Box>
    </Box>
  );

  const renderGenerationForm = () => {
    if (isGenerating) {
      return (
        <Box flexDirection="column">
          <Box >
            <Spinner type="dots" />
            <Text color="yellow"> Generating Video...</Text>
          </Box>
          
          {progress && (
            <Box >
              <Text color="cyan">{progress}</Text>
            </Box>
          )}
          
          {error && (
            <Box >
              <Text color="red">❌ Error: {error}</Text>
            </Box>
          )}
          
          {result && (
            <Box >
              <Text color="green">✅ Video saved: {result}</Text>
            </Box>
          )}
        </Box>
      );
    }

    const steps = [
      'Enter prompt',
      'Select model', 
      'Configure settings',
      'Generate video'
    ];

    return (
      <Box flexDirection="column">
        <Box >
          <Text bold color="cyan">
            🎬 Video Generation ({steps[currentStep]})
          </Text>
        </Box>

        {currentStep === 0 && (
          <Box flexDirection="column">
            <Text color="yellow">Enter your video prompt:</Text>
            <TextInput
              value={prompt}
              onChange={setPrompt}
              onSubmit={() => setCurrentStep(1)}
              placeholder="A red sports car drifting on a mountain road at sunset..."
            />
          </Box>
        )}

        {currentStep === 1 && (
          <Box flexDirection="column">
            <Box>
              <Text color="yellow">Select video model:</Text>
            </Box>
            <SelectInput
              items={Object.entries(VIDEO_MODELS).map(([id, model]) => ({
                label: `${model.badge} ${model.name} - ${model.description}`,
                value: id
              }))}
              onSelect={(item) => {
                setSelectedModel(item.value as keyof typeof VIDEO_MODELS);
                setCurrentStep(2);
              }}
            />
          </Box>
        )}

        {currentStep === 2 && (
          <Box flexDirection="column">
            <Box>
              <Text color="yellow">Configuration:</Text>
            </Box>
            <Box flexDirection="column" gap={1}>
              <Text>Frames: {frames} (max: {VIDEO_MODELS[selectedModel].maxFrames})</Text>
              <Text>FPS: {fps}</Text>
              <Text>Resolution: {VIDEO_MODELS[selectedModel].resolution}</Text>
              {inputImage && <Text>Input Image: {inputImage}</Text>}
            </Box>
            <Box marginTop={1}>
              <Text color="gray">Press Enter to continue, ESC to exit</Text>
            </Box>
            <SelectInput
              items={[
                { label: '✅ Generate with current settings', value: 'generate' },
                { label: '⚙️ Modify frames count', value: 'frames' },
                { label: '🖼️ Add input image (I2V)', value: 'image' }
              ]}
              onSelect={(item) => {
                if (item.value === 'generate') {
                  handleGenerate();
                } else {
                  setCurrentStep(3);
                }
              }}
            />
          </Box>
        )}

        {error && (
          <Box marginTop={1}>
            <Text color="red">❌ {error}</Text>
          </Box>
        )}
      </Box>
    );
  };

  const renderComparison = () => (
    <Box flexDirection="column">
      <Box >
        <Text bold color="cyan">📊 Video Model Comparison</Text>
      </Box>
      
      <Box gap={2}>
        {Object.entries(VIDEO_MODELS).map(([id, model]) => (
          <Box key={id} flexDirection="column" width={30}>
            <Text bold color="yellow">{model.badge} {model.name}</Text>
            <Text color="gray">Type: {model.type}</Text>
            <Text color="gray">VRAM: {model.vram}</Text>
            <Text color="gray">Max Frames: {model.maxFrames}</Text>
            <Text color="gray">Resolution: {model.resolution}</Text>
            <Box marginTop={1}>
              <Text color="green">{model.description}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );

  switch (mode) {
    case 'models':
      return renderModelList();
    case 'compare':
      return renderComparison();
    default:
      return renderGenerationForm();
  }
};

/**
 * Parse natural language video requests
 */
export const parseVideoRequest = (input: string): {
  action: string;
  model?: keyof typeof VIDEO_MODELS;
  prompt?: string;
} => {
  const lowerInput = input.toLowerCase();

  // Extract prompt if present
  const promptMatch = input.match(/["']([^"']+)["']/);
  const prompt = promptMatch ? promptMatch[1] : '';

  // Model selection logic
  if (lowerInput.includes('14b') || lowerInput.includes('high quality') || lowerInput.includes('detailed')) {
    return { 
      action: 'generate', 
      model: 'wan-2.2-t2v-a14b',
      prompt 
    };
  }
  
  if (lowerInput.includes('fast') || lowerInput.includes('5b') || lowerInput.includes('quick')) {
    return { 
      action: 'generate', 
      model: 'wan-2.2-ti2v-5b',
      prompt 
    };
  }
  
  if (lowerInput.includes('image to video') || lowerInput.includes('i2v')) {
    return { 
      action: 'generate', 
      model: 'wan-2.2-i2v-a14b',
      prompt 
    };
  }

  if (lowerInput.includes('compare') || lowerInput.includes('models')) {
    return { action: 'compare' };
  }

  if (lowerInput.includes('list') || lowerInput.includes('available')) {
    return { action: 'models' };
  }

  return { 
    action: 'generate',
    model: 'wan-2.2-ti2v-5b',
    prompt
  };
};

export default VideoCommand;