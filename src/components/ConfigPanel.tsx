/**
 * Configuration Panel Component
 * 対話型設定編集用UI
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { MariaConfig } from '../utils/config.js';

interface ConfigPanelProps {
  config: MariaConfig;
  onSave: (config: MariaConfig) => void;
  onCancel: () => void;
}

type ConfigSection = 'main' | 'user' | 'ai' | 'cli' | 'sandbox' | 'permissions' | 'hooks';

const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onSave, onCancel }) => {
  const [currentSection, setCurrentSection] = useState<ConfigSection>('main');
  const [editedConfig, setEditedConfig] = useState<MariaConfig>({ ...config });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const sections = [
    { label: 'User Settings', value: 'user' },
    { label: 'AI Configuration', value: 'ai' },
    { label: 'CLI Settings', value: 'cli' },
    { label: 'Sandbox Settings', value: 'sandbox' },
    { label: 'Permissions', value: 'permissions' },
    { label: 'Hooks', value: 'hooks' },
    { label: 'Save & Exit', value: 'save' },
    { label: 'Cancel', value: 'cancel' },
  ];

  useInput((_input, key) => {
    if (key.escape && !editingField) {
      onCancel();
    }
    if (key.return && editingField) {
      handleFieldUpdate(editingField, inputValue);
      setEditingField(null);
      setInputValue('');
    }
  });

  const handleSectionSelect = useCallback((item: { value: string }) => {
    if (item.value === 'save') {
      onSave(editedConfig);
    } else if (item.value === 'cancel') {
      onCancel();
    } else {
      setCurrentSection(item.value as ConfigSection);
    }
  }, [editedConfig, onSave, onCancel]);

  const handleFieldUpdate = useCallback((field: string, value: string) => {
    const newConfig = { ...editedConfig };
    
    // ネストされたプロパティを処理
    const parts = field.split('.');
    if (parts.length === 2) {
      const [section, key] = parts;
      if (section && !newConfig[section as keyof MariaConfig]) {
        (newConfig as any)[section] = {};
      }
      if (section && key) {
        (newConfig as any)[section][key] = convertValue(value);
      }
    } else {
      (newConfig as any)[field] = convertValue(value);
    }
    
    setEditedConfig(newConfig);
  }, [editedConfig]);

  const convertValue = (value: string): any => {
    // ブール値の変換
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // 数値の変換
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    
    // そのまま文字列として返す
    return value;
  };

  const renderMainMenu = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>📝 MARIA CODE Configuration</Text>
      <Text color="gray">Select a section to configure:</Text>
      <Box marginTop={1}>
        <SelectInput items={sections} onSelect={handleSectionSelect} />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">
          Use arrow keys to navigate, Enter to select, Esc to cancel
        </Text>
      </Box>
    </Box>
  );

  const renderUserSettings = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>👤 User Settings</Text>
      <Box marginTop={1} flexDirection="column">
        <ConfigField
          label="Email"
          value={editedConfig.user?.email || ''}
          field="user.email"
          onEdit={setEditingField}
          isEditing={editingField === 'user.email'}
          inputValue={inputValue}
          onInputChange={setInputValue}
        />
        <ConfigField
          label="Plan"
          value={editedConfig.user?.plan || 'free'}
          field="user.plan"
          onEdit={setEditingField}
          isEditing={editingField === 'user.plan'}
          inputValue={inputValue}
          onInputChange={setInputValue}
          help="Options: free, pro, max"
        />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">B: Back to main menu</Text>
      </Box>
    </Box>
  );

  const renderAISettings = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>🤖 AI Configuration</Text>
      <Box marginTop={1} flexDirection="column">
        <ConfigField
          label="Default Model"
          value={editedConfig.defaultModel || 'gemini-2.5-pro'}
          field="defaultModel"
          onEdit={setEditingField}
          isEditing={editingField === 'defaultModel'}
          inputValue={inputValue}
          onInputChange={setInputValue}
          help="Options: gemini-2.5-pro, grok-4"
        />
        <ConfigField
          label="Preferred Model"
          value={editedConfig.ai?.preferredModel || 'gemini-2.5-pro'}
          field="ai.preferredModel"
          onEdit={setEditingField}
          isEditing={editingField === 'ai.preferredModel'}
          inputValue={inputValue}
          onInputChange={setInputValue}
        />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">B: Back to main menu</Text>
      </Box>
    </Box>
  );

  const renderCLISettings = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>⚡ CLI Settings</Text>
      <Box marginTop={1} flexDirection="column">
        <ConfigField
          label="Default Mode"
          value={editedConfig.cli?.defaultMode || 'chat'}
          field="cli.defaultMode"
          onEdit={setEditingField}
          isEditing={editingField === 'cli.defaultMode'}
          inputValue={inputValue}
          onInputChange={setInputValue}
          help="Options: chat, command, research, creative"
        />
        <ConfigField
          label="Theme"
          value={editedConfig.cli?.theme || 'auto'}
          field="cli.theme"
          onEdit={setEditingField}
          isEditing={editingField === 'cli.theme'}
          inputValue={inputValue}
          onInputChange={setInputValue}
          help="Options: auto, light, dark"
        />
        <ConfigField
          label="Verbosity"
          value={editedConfig.cli?.verbosity || 'normal'}
          field="cli.verbosity"
          onEdit={setEditingField}
          isEditing={editingField === 'cli.verbosity'}
          inputValue={inputValue}
          onInputChange={setInputValue}
          help="Options: quiet, normal, detailed"
        />
        <ConfigField
          label="Auto Save"
          value={editedConfig.cli?.autoSave?.toString() || 'true'}
          field="cli.autoSave"
          onEdit={setEditingField}
          isEditing={editingField === 'cli.autoSave'}
          inputValue={inputValue}
          onInputChange={setInputValue}
          help="Options: true, false"
        />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">B: Back to main menu</Text>
      </Box>
    </Box>
  );

  const renderSandboxSettings = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>☁️ Sandbox Settings</Text>
      <Box marginTop={1} flexDirection="column">
        <ConfigField
          label="Enabled"
          value={editedConfig.sandbox?.enabled?.toString() || 'true'}
          field="sandbox.enabled"
          onEdit={setEditingField}
          isEditing={editingField === 'sandbox.enabled'}
          inputValue={inputValue}
          onInputChange={setInputValue}
          help="Options: true, false"
        />
        <ConfigField
          label="Region"
          value={editedConfig.sandbox?.region || 'us-central1'}
          field="sandbox.region"
          onEdit={setEditingField}
          isEditing={editingField === 'sandbox.region'}
          inputValue={inputValue}
          onInputChange={setInputValue}
        />
        <ConfigField
          label="Instance Type"
          value={editedConfig.sandbox?.instanceType || 'standard'}
          field="sandbox.instanceType"
          onEdit={setEditingField}
          isEditing={editingField === 'sandbox.instanceType'}
          inputValue={inputValue}
          onInputChange={setInputValue}
          help="Options: standard, high-cpu, high-mem"
        />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">B: Back to main menu</Text>
      </Box>
    </Box>
  );

  useInput((input) => {
    if (input.toLowerCase() === 'b' && currentSection !== 'main') {
      setCurrentSection('main');
    }
  });

  if (currentSection === 'main') return renderMainMenu();
  if (currentSection === 'user') return renderUserSettings();
  if (currentSection === 'ai') return renderAISettings();
  if (currentSection === 'cli') return renderCLISettings();
  if (currentSection === 'sandbox') return renderSandboxSettings();

  return renderMainMenu();
};

interface ConfigFieldProps {
  label: string;
  value: string;
  field: string;
  onEdit: (field: string) => void;
  isEditing: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  help?: string;
}

const ConfigField: React.FC<ConfigFieldProps> = ({
  label,
  value,
  field,
  onEdit,
  isEditing,
  inputValue,
  onInputChange,
  help
}) => {
  useInput((_input, key) => {
    if (key.return && !isEditing) {
      onEdit(field);
    }
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Box minWidth={15}>
          <Text color="yellow">{label}:</Text>
        </Box>
        {isEditing ? (
          <TextInput
            value={inputValue}
            onChange={onInputChange}
            placeholder={value}
          />
        ) : (
          <Text color="green">{value} <Text color="gray">(Press Enter to edit)</Text></Text>
        )}
      </Box>
      {help && (
        <Box marginLeft={15}>
          <Text color="gray">{help}</Text>
        </Box>
      )}
    </Box>
  );
};

export default ConfigPanel;