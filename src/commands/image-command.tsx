/**
 * MARIA CODE Image Generation Commands
 * /image - Text to Image generation using Qwen-Image and other models
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

// Image generation model profiles
const IMAGE_MODELS = {
  'qwen-image': {
    name: 'Qwen-Image',
    badge: '🌟',
    description: 'Advanced text-to-image generation',
    type: 'text-to-image',
    huggingface: 'Qwen/Qwen-Image',
    vram: '~8GB',
    resolution: '1024x1024',
    maxRes: '2048x2048'
  },
  'stable-diffusion-xl': {
    name: 'Stable Diffusion XL',
    badge: '🎨',
    description: 'High-quality artistic image generation',
    type: 'text-to-image',
    huggingface: 'stabilityai/stable-diffusion-xl-base-1.0',
    vram: '~10GB',
    resolution: '1024x1024',
    maxRes: '1536x1536'
  },
  'flux-dev': {
    name: 'FLUX.1-dev',
    badge: '⚡',
    description: 'Fast, high-quality text-to-image',
    type: 'text-to-image', 
    huggingface: 'black-forest-labs/FLUX.1-dev',
    vram: '~12GB',
    resolution: '1024x1024',
    maxRes: '1440x1440'
  },
  'dall-e-3-xl': {
    name: 'DALL-E 3 XL',
    badge: '🖼️',
    description: 'Creative and detailed image generation',
    type: 'text-to-image',
    huggingface: 'openskyml/dalle-3-xl',
    vram: '~16GB',
    resolution: '1024x1024',
    maxRes: '2048x2048'
  }
};

interface ImageGenerationParams {
  prompt: string;
  model: keyof typeof IMAGE_MODELS;
  width?: number;
  height?: number;
  steps?: number;
  guidanceScale?: number;
  seed?: number;
  numImages?: number;
  outputPath?: string;
  negativePrompt?: string;
  style?: string;
}

interface ImageCommandProps {
  initialMode?: 'generate' | 'models' | 'compare' | 'gallery';
  params?: Partial<ImageGenerationParams>;
}

/**
 * /image - Interactive image generation command
 */
export const ImageCommand: React.FC<ImageCommandProps> = ({ 
  initialMode = 'generate',
  params = {}
}) => {
  const [mode] = useState(initialMode);
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<string[]>([]);
  
  // Form state
  const [prompt, setPrompt] = useState(params.prompt || '');
  const [selectedModel, setSelectedModel] = useState<keyof typeof IMAGE_MODELS>(
    params.model || 'qwen-image'
  );
  const [width] = useState(params.width || 1024);
  const [height] = useState(params.height || 1024);
  const [steps] = useState(params.steps || 20);
  const [guidanceScale] = useState(params.guidanceScale || 7.5);
  const [numImages] = useState(params.numImages || 1);
  const [negativePrompt] = useState(params.negativePrompt || 'low quality, blurry, distorted');
  const [style] = useState(params.style || 'photorealistic');

  useInput((input, key) => {
    if (key.escape) {
      process.exit(0);
    }
    if (key.ctrl && input === 'c') {
      process.exit(0);
    }
  });

  const checkDependencies = async (): Promise<boolean> => {
    try {
      // Check Python
      await execAsync('which python3');
      
      // Check required packages
      const { stdout } = await execAsync('python3 -c "import torch, diffusers, transformers; print(\'ok\')"');
      return stdout.trim() === 'ok';
    } catch {
      return false;
    }
  };

  const setupDependencies = async (): Promise<void> => {
    setProgress('Installing image generation dependencies...');
    
    try {
      // Install required packages
      await execAsync('pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cpu');
      await execAsync('pip3 install diffusers transformers accelerate');
      await execAsync('pip3 install Pillow requests');
      
      setProgress('Dependencies installed successfully');
    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

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
        await execAsync('pip3 install --upgrade huggingface_hub[cli]');
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

  const downloadModel = async (modelId: keyof typeof IMAGE_MODELS): Promise<void> => {
    const model = IMAGE_MODELS[modelId];
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

  const createImageGenerationScript = async (params: ImageGenerationParams): Promise<string> => {
    const scriptDir = `${process.env.HOME}/.maria/scripts`;
    const scriptPath = path.join(scriptDir, 'generate_image.py');
    
    await execAsync(`mkdir -p "${scriptDir}"`);
    
    const pythonScript = `
import torch
from diffusers import DiffusionPipeline
import os
import sys
from PIL import Image

def generate_images(
    prompt,
    model_path,
    output_dir,
    width=${params.width || 1024},
    height=${params.height || 1024},
    steps=${params.steps || 20},
    guidance_scale=${params.guidanceScale || 7.5},
    num_images=${params.numImages || 1},
    negative_prompt="${params.negativePrompt || 'low quality, blurry'}",
    seed=${params.seed || 'None'}
):
    try:
        # Load model
        print(f"Loading model from {model_path}...")
        pipe = DiffusionPipeline.from_pretrained(
            model_path,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto"
        )
        
        # Move to device
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        pipe = pipe.to(device)
        
        # Set seed if provided
        if seed is not None:
            torch.manual_seed(seed)
        
        print(f"Generating {num_images} images...")
        
        # Generate images
        for i in range(num_images):
            print(f"Generating image {i+1}/{num_images}...")
            
            result = pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                num_inference_steps=steps,
                guidance_scale=guidance_scale,
                num_images_per_prompt=1
            )
            
            # Save image
            image = result.images[0]
            filename = f"image_{i+1:03d}.png"
            filepath = os.path.join(output_dir, filename)
            image.save(filepath)
            print(f"Saved: {filepath}")
        
        print("Generation complete!")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python generate_image.py <prompt> <model_path> <output_dir>")
        sys.exit(1)
    
    prompt = sys.argv[1]
    model_path = sys.argv[2] 
    output_dir = sys.argv[3]
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    generate_images(prompt, model_path, output_dir)
`;

    await fs.writeFile(scriptPath, pythonScript);
    return scriptPath;
  };

  const generateImages = async (params: ImageGenerationParams): Promise<string[]> => {
    const timestamp = Date.now();
    const outputDir = `${process.env.HOME}/.maria/outputs/images/${timestamp}`;
    const modelPath = `${process.env.HF_MODEL_DIR || '~/.maria/huggingface/models'}/${params.model}`;
    
    setProgress('Initializing image generation...');
    
    try {
      // Create output directory
      await execAsync(`mkdir -p "${outputDir}"`);
      
      // Check and setup dependencies
      const depsReady = await checkDependencies();
      if (!depsReady) {
        await setupDependencies();
      }
      
      // Setup Hugging Face if needed
      const isHFReady = await checkHuggingFaceSetup();
      if (!isHFReady) {
        await setupHuggingFace();
      }
      
      // Download model if not present
      try {
        await fs.access(modelPath);
      } catch {
        await downloadModel(params.model);
      }
      
      // Create generation script
      const scriptPath = await createImageGenerationScript(params);
      
      // Run generation
      setProgress('Generating images...');
      await execAsync(
        `cd "${outputDir}" && python3 "${scriptPath}" "${params.prompt}" "${modelPath}" "${outputDir}"`,
        { timeout: 600000 } // 10 minute timeout
      );
      
      // Get generated files
      const { stdout } = await execAsync(`ls "${outputDir}"/*.png`);
      const files = stdout.trim().split('\n').filter(f => f.length > 0);
      
      return files;
    } catch (error) {
      throw new Error(`Image generation failed: ${error instanceof Error ? error.message : String(error)}`);
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
    setResults([]);
    
    try {
      const outputFiles = await generateImages({
        prompt,
        model: selectedModel,
        width,
        height,
        steps,
        guidanceScale,
        numImages,
        negativePrompt,
        seed: Math.floor(Math.random() * 1000000),
        style
      });
      
      setResults(outputFiles);
      setProgress(`Generated ${outputFiles.length} images successfully!`);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const renderModelList = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">🎨 Available Image Generation Models</Text>
      </Box>
      
      <Box flexDirection="column" gap={1}>
        {Object.entries(IMAGE_MODELS).map(([id, model]) => (
          <Box key={id} gap={1}>
            <Text color="yellow">{model.badge}</Text>
            <Box width={20}>
              <Text bold>{model.name}</Text>
            </Box>
            <Box width={35}>
              <Text color="gray">{model.description}</Text>
            </Box>
            <Text color="green">{model.resolution}</Text>
            <Text color="magenta">VRAM: {model.vram}</Text>
          </Box>
        ))}
      </Box>
      
      <Box marginTop={1}>
        <Text color="gray">💡 Use `/image` to start generation</Text>
      </Box>
    </Box>
  );

  const renderGenerationForm = () => {
    if (isGenerating) {
      return (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Spinner type="dots" />
            <Text color="yellow"> Generating Images...</Text>
          </Box>
          
          {progress && (
            <Box marginBottom={1}>
              <Text color="cyan">{progress}</Text>
            </Box>
          )}
          
          {error && (
            <Box marginBottom={1}>
              <Text color="red">❌ Error: {error}</Text>
            </Box>
          )}
          
          {results.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color="green">✅ Generated images:</Text>
              {results.map((file, idx) => (
                <Text key={idx} color="cyan">  {file}</Text>
              ))}
            </Box>
          )}
        </Box>
      );
    }

    const steps = [
      'Enter prompt',
      'Select model', 
      'Configure settings',
      'Generate images'
    ];

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">
            🎨 Image Generation ({steps[currentStep]})
          </Text>
        </Box>

        {currentStep === 0 && (
          <Box flexDirection="column">
            <Text color="yellow">Enter your image prompt:</Text>
            <TextInput
              value={prompt}
              onChange={setPrompt}
              onSubmit={() => setCurrentStep(1)}
              placeholder="A beautiful landscape with mountains and a lake at sunset, photorealistic..."
            />
          </Box>
        )}

        {currentStep === 1 && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color="yellow">Select image model:</Text>
            </Box>
            <SelectInput
              items={Object.entries(IMAGE_MODELS).map(([id, model]) => ({
                label: `${model.badge} ${model.name} - ${model.description}`,
                value: id
              }))}
              onSelect={(item) => {
                setSelectedModel(item.value as keyof typeof IMAGE_MODELS);
                setCurrentStep(2);
              }}
            />
          </Box>
        )}

        {currentStep === 2 && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color="yellow">Configuration:</Text>
            </Box>
            <Box flexDirection="column" gap={1}>
              <Text>Resolution: {width}x{height}</Text>
              <Text>Steps: {steps}</Text>
              <Text>Guidance Scale: {guidanceScale}</Text>
              <Text>Number of Images: {numImages}</Text>
              <Text>Style: {style}</Text>
              {negativePrompt && <Text>Negative Prompt: {negativePrompt}</Text>}
            </Box>
            <Box marginTop={1}>
              <Text color="gray">Press Enter to continue, ESC to exit</Text>
            </Box>
            <SelectInput
              items={[
                { label: '✅ Generate with current settings', value: 'generate' },
                { label: '📐 Modify resolution', value: 'resolution' },
                { label: '🎯 Adjust quality settings', value: 'quality' },
                { label: '📷 Change number of images', value: 'count' }
              ]}
              onSelect={(item) => {
                if (item.value === 'generate') {
                  handleGenerate();
                } else {
                  // Could add more configuration steps here
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
      <Box marginBottom={1}>
        <Text bold color="cyan">📊 Image Model Comparison</Text>
      </Box>
      
      <Box gap={2}>
        {Object.entries(IMAGE_MODELS).map(([id, model]) => (
          <Box key={id} flexDirection="column" width={25}>
            <Text bold color="yellow">{model.badge} {model.name}</Text>
            <Text color="gray">Type: {model.type}</Text>
            <Text color="gray">VRAM: {model.vram}</Text>
            <Text color="gray">Resolution: {model.resolution}</Text>
            <Text color="gray">Max Res: {model.maxRes}</Text>
            <Box marginTop={1}>
              <Text color="green">{model.description}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );

  const renderGallery = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">🖼️ Recent Generated Images</Text>
      </Box>
      
      {results.length > 0 ? (
        <Box flexDirection="column" gap={1}>
          {results.map((file, idx) => (
            <Box key={idx} gap={1}>
              <Text color="green">📸</Text>
              <Text>{path.basename(file)}</Text>
              <Text color="gray">{file}</Text>
            </Box>
          ))}
        </Box>
      ) : (
        <Text color="gray">No images generated yet. Use `/image` to create some!</Text>
      )}
    </Box>
  );

  switch (mode) {
    case 'models':
      return renderModelList();
    case 'compare':
      return renderComparison();
    case 'gallery':
      return renderGallery();
    default:
      return renderGenerationForm();
  }
};

/**
 * Parse natural language image requests
 */
export const parseImageRequest = (input: string): {
  action: string;
  model?: keyof typeof IMAGE_MODELS;
  prompt?: string;
  style?: string;
} => {
  const lowerInput = input.toLowerCase();

  // Extract prompt if present
  const promptMatch = input.match(/["']([^"']+)["']/);
  const prompt = promptMatch ? promptMatch[1] : '';

  // Style detection
  let style = 'photorealistic';
  if (lowerInput.includes('anime') || lowerInput.includes('manga')) {
    style = 'anime';
  } else if (lowerInput.includes('art') || lowerInput.includes('painting')) {
    style = 'artistic';
  } else if (lowerInput.includes('cartoon') || lowerInput.includes('illustration')) {
    style = 'cartoon';
  }

  // Model selection logic
  if (lowerInput.includes('qwen') || lowerInput.includes('advanced')) {
    return { 
      action: 'generate', 
      model: 'qwen-image',
      prompt,
      style
    };
  }
  
  if (lowerInput.includes('stable') || lowerInput.includes('artistic')) {
    return { 
      action: 'generate', 
      model: 'stable-diffusion-xl',
      prompt,
      style
    };
  }
  
  if (lowerInput.includes('flux') || lowerInput.includes('fast')) {
    return { 
      action: 'generate', 
      model: 'flux-dev',
      prompt,
      style
    };
  }
  
  if (lowerInput.includes('dall') || lowerInput.includes('creative')) {
    return { 
      action: 'generate', 
      model: 'dall-e-3-xl',
      prompt,
      style
    };
  }

  if (lowerInput.includes('compare') || lowerInput.includes('models')) {
    return { action: 'compare' };
  }

  if (lowerInput.includes('list') || lowerInput.includes('available')) {
    return { action: 'models' };
  }

  if (lowerInput.includes('gallery') || lowerInput.includes('recent')) {
    return { action: 'gallery' };
  }

  return { 
    action: 'generate',
    model: 'qwen-image',
    prompt,
    style
  };
};

export default ImageCommand;