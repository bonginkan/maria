import React, { useState, useEffect } from 'react';
import { Text, Box, Newline } from 'ink';
import Spinner from 'ink-spinner';
import { videoGenerationService, VideoOptions } from '../services/video-generation';
import { GenerationProgress } from '../services/video-generation';

interface VideoCommandProps {
  prompt: string;
  model?: 'wan22-5b' | 'wan22-14b';
  inputImage?: string;
  resolution?: '720p' | '1080p';
  fps?: number;
  frames?: number;
  steps?: number;
  compare?: boolean;
  outputPath?: string;
}

const VideoCommand: React.FC<VideoCommandProps> = ({
  prompt,
  model = 'wan22-5b',
  inputImage,
  resolution = '720p',
  fps = 24,
  frames = 33,
  steps,
  compare = false,
  outputPath
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [result, setResult] = useState<{ success: boolean; outputPath?: string; comparisonPath?: string; error?: string } | null>(null);
  const [startTime, setStartTime] = useState<number>(0);

  useEffect(() => {
    const generateVideo = async () => {
      setIsGenerating(true);
      setStartTime(Date.now());
      
      const options: VideoOptions = {
        model,
        prompt,
        inputImage,
        resolution,
        fps,
        frames,
        steps: steps || (model === 'wan22-14b' ? 50 : 30),
        compare,
        outputPath,
        seed: Math.floor(Math.random() * 1000000)
      };

      try {
        const videoResult = await videoGenerationService.generateVideo(
          prompt,
          options,
          (progressUpdate) => setProgress(progressUpdate)
        );
        
        setResult(videoResult);
      } catch (error) {
        setResult({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        setIsGenerating(false);
      }
    };

    generateVideo();
  }, [prompt, model, inputImage, resolution, fps, frames, steps, compare, outputPath]);

  const renderHeader = () => (
    <Box flexDirection="column">
      <Box>
        <Text color="magenta" bold>🎬 AI動画生成</Text>
      </Box>
      <Text color="gray">プロンプト: {prompt}</Text>
      {inputImage && <Text color="gray">入力画像: {inputImage}</Text>}
      <Box marginY={1}>
        <Text color="cyan">📊 設定:</Text>
        <Text> モデル={model} 解像度={resolution} fps={fps} フレーム={frames}</Text>
      </Box>
      {compare && (
        <Box>
          <Text color="yellow">⚖️  比較モード: 5B/14B両モデルで生成し横並び比較動画を作成</Text>
        </Box>
      )}
    </Box>
  );

  const renderProgress = () => {
    if (!progress) return null;

    return (
      <Box flexDirection="column" marginY={1}>
        <Box>
          <Spinner type="dots" />
          <Text> {progress.stage} ({progress.percentage}%)</Text>
        </Box>
        <Text color="gray">Step: {progress.currentStep}</Text>
        {progress.estimatedTimeRemaining && (
          <Text color="gray">ETA: {progress.estimatedTimeRemaining}s</Text>
        )}
        
        {progress.stage === 'processing' && (
          <Box marginTop={1}>
            <Text color="blue">🔄 </Text>
            <Text>{progress.currentStep}</Text>
          </Box>
        )}
        
        {progress.error && (
          <Box marginTop={1}>
            <Text color="red">❌ エラー: {progress.error}</Text>
          </Box>
        )}
      </Box>
    );
  };

  const renderResult = () => {
    if (!result) return null;

    if (result.success) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      return (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color="green" bold>✨ 動画生成完了！</Text>
          </Box>
          
          <Box marginTop={1}>
            <Text color="cyan">📁 メイン出力: </Text>
            <Text>{result.outputPath}</Text>
          </Box>
          
          {result.comparisonPath && (
            <Box>
              <Text color="cyan">🎞️  比較動画: </Text>
              <Text>{result.comparisonPath}</Text>
            </Box>
          )}
          
          <Box marginTop={1}>
            <Text color="gray">⏱️  生成時間: {duration}秒</Text>
            <Text color="gray"> | モデル: {model}</Text>
            <Text color="gray"> | 解像度: {resolution}</Text>
          </Box>

          <Box marginTop={1}>
            <Text color="green">💡 ヒント:</Text>
            <Text> ファイルマネージャーで動画を開いて確認してください</Text>
          </Box>
        </Box>
      );
    } else {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red" bold>❌ 動画生成エラー</Text>
          <Text color="red">{result.error}</Text>
          
          <Box marginTop={1}>
            <Text color="yellow">💡 解決策:</Text>
          </Box>
          <Text color="yellow">• ComfyUIが起動していることを確認</Text>
          <Text color="yellow">• モデルファイルが正しく配置されていることを確認</Text>
          <Text color="yellow">• 十分なVRAMが利用可能であることを確認</Text>
        </Box>
      );
    }
  };

  return (
    <Box flexDirection="column" paddingX={2}>
      {renderHeader()}
      <Newline />
      
      {isGenerating && renderProgress()}
      {result && renderResult()}
      
      {!isGenerating && !result && (
        <Box>
          <Text color="blue">🚀 動画生成を開始しています...</Text>
        </Box>
      )}
    </Box>
  );
};

export default VideoCommand;