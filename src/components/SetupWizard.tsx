import React, { useState, useEffect } from 'react';
import { Box, Text, Spinner, Newline } from 'ink';
import {
  ZeroConfigSetup,
  SetupWizardConfig,
  ProviderStatus,
} from '../services/zero-config-setup.js';

interface SetupWizardProps {
  onComplete: (config: SetupWizardConfig) => void;
  onCancel?: () => void;
}

type SetupStep = 'language' | 'detection' | 'preferences' | 'testing' | 'completion';

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>('language');
  const [loading, setLoading] = useState(false);
  const [_config, setConfig] = useState<Partial<SetupWizardConfig>>({});
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ja'>('en');

  const setup = new ZeroConfigSetup();

  useEffect(() => {
    startSetup();
  }, []);

  const startSetup = async () => {
    try {
      setLoading(true);

      // Check if setup is needed
      const shouldRun = await setup.shouldRunSetup();
      if (!shouldRun) {
        const existingConfig = await setup.getExistingConfig();
        if (existingConfig) {
          onComplete(existingConfig);
          return;
        }
      }

      // Start with language detection
      await detectLanguage();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const detectLanguage = async () => {
    setCurrentStep('language');
    setLoading(true);

    try {
      // Auto-detect language
      const locale = process.env['LANG'] || process.env['LC_ALL'] || 'en_US';
      const detectedLang: 'en' | 'ja' =
        locale.includes('ja') || locale.includes('JP') ? 'ja' : 'en';

      setSelectedLanguage(detectedLang);
      setConfig((prev) => ({ ...prev, language: detectedLang }));

      // Move to provider detection
      setTimeout(() => detectProviders(), 1000);
    } catch (err: unknown) {
      setError('Language detection failed');
    } finally {
      setLoading(false);
    }
  };

  const detectProviders = async () => {
    setCurrentStep('detection');
    setLoading(true);

    try {
      const detectedProviders = await setup.detectProviders();
      setProviders(detectedProviders);

      // Move to preferences
      setTimeout(() => setCurrentStep('preferences'), 1500);
    } catch (err: unknown) {
      setError('Provider detection failed');
    } finally {
      setLoading(false);
    }
  };

  const configurePreferences = async () => {
    setCurrentStep('testing');
    setLoading(true);

    try {
      // Run full setup
      const finalConfig = await setup.run();
      setConfig(finalConfig);

      // Move to completion
      setCurrentStep('completion');
      setTimeout(() => onComplete(finalConfig), 2000);
    } catch (err: unknown) {
      setError('Configuration failed');
    } finally {
      setLoading(false);
    }
  };

  const renderLanguageStep = () => {
    const isJapanese = selectedLanguage === 'ja';

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>
          {isJapanese ? '🌍 言語設定' : '🌍 Language Configuration'}
        </Text>
        <Newline />

        <Text>
          {isJapanese
            ? `検出された言語: ${selectedLanguage === 'ja' ? '日本語' : 'English'}`
            : `Detected language: ${selectedLanguage === 'ja' ? 'Japanese' : 'English'}`}
        </Text>

        <Newline />

        {loading && (
          <Box>
            <Spinner type="dots" />
            <Text color="yellow">{isJapanese ? ' 設定を準備中...' : ' Preparing setup...'}</Text>
          </Box>
        )}
      </Box>
    );
  };

  const renderDetectionStep = () => {
    const isJapanese = selectedLanguage === 'ja';

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>
          {isJapanese ? '🔍 プロバイダー検出' : '🔍 Provider Detection'}
        </Text>
        <Newline />

        {loading && (
          <Box>
            <Spinner type="dots" />
            <Text color="yellow">
              {isJapanese ? ' AIプロバイダーを検索中...' : ' Searching for AI providers...'}
            </Text>
          </Box>
        )}

        {providers.length > 0 && (
          <Box flexDirection="column">
            <Text color="green">
              {isJapanese ? '検出されたプロバイダー:' : 'Detected providers:'}
            </Text>

            {providers.map((provider) => (
              <Box key={provider.name} marginLeft={2}>
                <Text color={provider.available ? 'green' : 'gray'}>
                  {provider.available ? '✅' : '❌'} {provider.name}
                  {provider.type === 'local' ? ' (Local)' : ' (Cloud)'}
                  {provider.configured && ' - Ready'}
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  const renderPreferencesStep = () => {
    const isJapanese = selectedLanguage === 'ja';
    const localProviders = providers.filter((p) => p.type === 'local' && p.available);
    const cloudProviders = providers.filter((p) => p.type === 'cloud' && p.configured);

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>
          {isJapanese ? '⚙️ 設定の構成' : '⚙️ Configuring Preferences'}
        </Text>
        <Newline />

        <Box flexDirection="column">
          <Text color="green">{isJapanese ? '利用可能:' : 'Available:'}</Text>
          <Text color="blue">
            🏠 {isJapanese ? 'ローカル' : 'Local'}: {localProviders.length}
          </Text>
          <Text color="magenta">
            📡 {isJapanese ? 'クラウド' : 'Cloud'}: {cloudProviders.length}
          </Text>
        </Box>

        <Newline />

        <Box>
          <Text color="yellow">
            {isJapanese ? '最適な設定を自動選択中...' : 'Auto-selecting optimal configuration...'}
          </Text>
        </Box>

        <Newline />

        <Box>
          <Text color="cyan" backgroundColor="blue" onClick={configurePreferences}>
            {isJapanese ? ' 設定を続行 ' : ' Continue Setup '}
          </Text>
        </Box>
      </Box>
    );
  };

  const renderTestingStep = () => {
    const isJapanese = selectedLanguage === 'ja';

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>
          {isJapanese ? '🧪 接続テスト' : '🧪 Testing Connections'}
        </Text>
        <Newline />

        <Box>
          <Spinner type="dots" />
          <Text color="yellow">
            {isJapanese ? ' プロバイダー接続をテスト中...' : ' Testing provider connections...'}
          </Text>
        </Box>

        <Newline />

        <Text color="gray">
          {isJapanese ? '• API エンドポイントの確認' : '• Verifying API endpoints'}
        </Text>
        <Text color="gray">{isJapanese ? '• 認証情報の検証' : '• Validating credentials'}</Text>
        <Text color="gray">
          {isJapanese ? '• 最適なプロバイダーの選択' : '• Selecting optimal provider'}
        </Text>
      </Box>
    );
  };

  const renderCompletionStep = () => {
    const isJapanese = selectedLanguage === 'ja';
    const localCount = providers.filter((p) => p.type === 'local' && p.configured).length;
    const cloudCount = providers.filter((p) => p.type === 'cloud' && p.configured).length;

    return (
      <Box flexDirection="column">
        <Text color="green" bold>
          {isJapanese ? '🎉 セットアップ完了!' : '🎉 Setup Complete!'}
        </Text>
        <Newline />

        <Box flexDirection="column">
          <Text color="cyan">{isJapanese ? '📊 設定サマリー:' : '📊 Configuration Summary:'}</Text>

          <Box marginLeft={2} flexDirection="column">
            <Text>
              {isJapanese
                ? `🌍 言語: ${selectedLanguage === 'ja' ? '日本語' : 'English'}`
                : `🌍 Language: ${selectedLanguage}`}
            </Text>
            <Text>
              {isJapanese
                ? `🏠 ローカルプロバイダー: ${localCount}`
                : `🏠 Local providers: ${localCount}`}
            </Text>
            <Text>
              {isJapanese
                ? `📡 クラウドプロバイダー: ${cloudCount}`
                : `📡 Cloud providers: ${cloudCount}`}
            </Text>
          </Box>
        </Box>

        <Newline />

        <Box padding={1} borderStyle="round" borderColor="green">
          <Text color="green">
            {isJapanese ? '🚀 MARIA CODE の準備が完了しました！' : '🚀 MARIA CODE is ready to use!'}
          </Text>
        </Box>

        <Newline />

        <Text color="cyan">
          {isJapanese ? 'コマンドで開始: maria または mc' : 'Start with: maria or mc'}
        </Text>
      </Box>
    );
  };

  const renderErrorStep = () => {
    const isJapanese = selectedLanguage === 'ja';

    return (
      <Box flexDirection="column">
        <Text color="red" bold>
          {isJapanese ? '❌ セットアップエラー' : '❌ Setup Error'}
        </Text>
        <Newline />

        <Text color="red">{error}</Text>

        <Newline />

        <Box>
          <Text color="yellow" backgroundColor="red" onClick={() => setError(null)}>
            {isJapanese ? ' リトライ ' : ' Retry '}
          </Text>

          {onCancel && (
            <>
              <Text> </Text>
              <Text color="gray" backgroundColor="black" onClick={onCancel}>
                {isJapanese ? ' キャンセル ' : ' Cancel '}
              </Text>
            </>
          )}
        </Box>
      </Box>
    );
  };

  if (error) {
    return renderErrorStep();
  }

  switch (currentStep) {
    case 'language':
      return renderLanguageStep();
    case 'detection':
      return renderDetectionStep();
    case 'preferences':
      return renderPreferencesStep();
    case 'testing':
      return renderTestingStep();
    case 'completion':
      return renderCompletionStep();
    default:
      return (
        <Box>
          <Text color="red">Unknown step: {currentStep}</Text>
        </Box>
      );
  }
};
