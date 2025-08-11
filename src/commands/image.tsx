import React, { useState, useEffect } from 'react';
import { Text, Box, Newline } from 'ink';
import Spinner from 'ink-spinner';
import { imageGenerationService, ImageOptions } from '../services/image-generation';
import { ImageProgress } from '../services/image-generation';

interface ImageCommandProps {
  prompt: string;
  style?: 'photorealistic' | 'artistic' | 'anime' | 'concept' | 'technical';
  size?: '512x512' | '768x768' | '1024x1024' | '1024x768' | '768x1024';
  quality?: 'low' | 'medium' | 'high';
  guidance?: number;
  steps?: number;
  batch?: number;
  variations?: number;
  seed?: number;
  outputPath?: string;
}

const ImageCommand: React.FC<ImageCommandProps> = ({
  prompt,
  style = 'photorealistic',
  size = '1024x1024',
  quality = 'high',
  guidance = 7.5,
  steps = 30,
  batch = 1,
  variations = 1,
  seed,
  outputPath,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ImageProgress | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    outputPaths?: string[];
    error?: string;
    metadata?: any;
  } | null>(null);
  const [startTime, setStartTime] = useState<number>(0);

  useEffect(() => {
    const generateImage = async () => {
      setIsGenerating(true);
      setStartTime(Date.now());

      const options: ImageOptions = {
        model: 'qwen-image',
        prompt,
        style,
        size,
        quality,
        guidance,
        steps,
        batch,
        variations,
        seed: seed || Math.floor(Math.random() * 1000000),
        outputPath,
      };

      try {
        const imageResult = await imageGenerationService.generateImage(
          prompt,
          options,
          (progressUpdate) => setProgress(progressUpdate),
        );

        setResult(imageResult);
      } catch (error) {
        setResult({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsGenerating(false);
      }
    };

    generateImage();
  }, [prompt, style, size, quality, guidance, steps, batch, variations, seed, outputPath]);

  const renderHeader = () => (
    <Box flexDirection="column">
      <Box>
        <Text color="blue" bold>
          🖼️ AI画像生成
        </Text>
      </Box>
      <Text color="gray">プロンプト: {prompt}</Text>
      <Box marginY={1}>
        <Text color="cyan">📊 設定:</Text>
        <Text>
          {' '}
          スタイル={style} サイズ={size} 品質={quality}
        </Text>
      </Box>
      {(batch > 1 || variations > 1) && (
        <Box>
          <Text color="yellow">
            📦 バッチ生成: {batch}×{variations} = {batch * variations}枚
          </Text>
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
          <Text>
            {' '}
            {progress.stage} ({progress.percentage}%)
          </Text>
        </Box>
        <Text color="gray">Step: {progress.currentStep}</Text>
        {progress.estimatedTimeRemaining && (
          <Text color="gray">ETA: {progress.estimatedTimeRemaining}s</Text>
        )}

        {progress.currentImage && progress.totalImages && progress.totalImages > 1 && (
          <Box marginTop={1}>
            <Text color="blue">📸 </Text>
            <Text>
              画像 {progress.currentImage}/{progress.totalImages} 生成中
            </Text>
          </Box>
        )}

        {progress.stage === 'processing' && (
          <Box marginTop={1}>
            <Text color="blue">🎨 </Text>
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

    if (result.success && result.outputPaths) {
      const duration = Math.round((Date.now() - startTime) / 1000);

      return (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color="green" bold>
              ✨ 画像生成完了！
            </Text>
          </Box>

          <Box marginTop={1}>
            <Text color="cyan">📁 出力ファイル ({result.outputPaths.length}枚):</Text>
          </Box>

          {result.outputPaths.slice(0, 3).map((path, index) => (
            <Box key={index}>
              <Text color="gray"> • </Text>
              <Text>{path}</Text>
            </Box>
          ))}

          {result.outputPaths.length > 3 && (
            <Box>
              <Text color="gray"> ... 他 {result.outputPaths.length - 3} ファイル</Text>
            </Box>
          )}

          <Box marginTop={1}>
            <Text color="gray">⏱️ 生成時間: {duration}秒</Text>
            <Text color="gray"> | スタイル: {style}</Text>
            <Text color="gray"> | 解像度: {size}</Text>
          </Box>

          {result.metadata && (
            <Box marginTop={1}>
              <Text color="cyan">📋 メタデータ:</Text>
              <Text> シード: {result.metadata.seedUsed}</Text>
              <Text> モデル: {result.metadata.modelUsed}</Text>
            </Box>
          )}

          <Box marginTop={1}>
            <Text color="green">💡 ヒント:</Text>
            <Text> 画像ファイルをダブルクリックしてプレビューできます</Text>
          </Box>
        </Box>
      );
    } else {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red" bold>
            ❌ 画像生成エラー
          </Text>
          <Text color="red">{result.error}</Text>

          <Box marginTop={1}>
            <Text color="yellow">💡 解決策:</Text>
          </Box>
          <Text color="yellow">• ComfyUIが起動していることを確認</Text>
          <Text color="yellow">• Qwen-Imageモデルが正しく配置されていることを確認</Text>
          <Text color="yellow">• プロンプトが適切であることを確認</Text>
        </Box>
      );
    }
  };

  const renderStyleInfo = () => {
    const styleDescriptions = {
      photorealistic: '写真のような高解像度でリアルな表現',
      artistic: '芸術的で表現豊かなペイント風',
      anime: 'アニメ・漫画スタイル、セルシェーディング',
      concept: 'コンセプトアート風のシネマティック表現',
      technical: '技術図面のような清潔で正確な線画',
    };

    return (
      <Box marginBottom={1}>
        <Text color="gray">🎨 {styleDescriptions[style]}</Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" paddingX={2}>
      {renderHeader()}
      {renderStyleInfo()}
      <Newline />

      {isGenerating && renderProgress()}
      {result && renderResult()}

      {!isGenerating && !result && (
        <Box>
          <Text color="blue">🚀 画像生成を開始しています...</Text>
        </Box>
      )}
    </Box>
  );
};

export default ImageCommand;
