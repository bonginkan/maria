// @ts-nocheck - Complex type interactions requiring gradual type migration
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';

interface SOWReviewProps {
  sow: unknown;
  onApprove: (approved: boolean, modifications?: unknown) => void;
}

type Tab = 'overview' | 'plan' | 'timeline' | 'modifications';

const SOWReview: React.FC<SOWReviewProps> = ({ sow, onApprove }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const tabs = [
    { label: 'Overview', value: 'overview' },
    { label: 'Execution Plan', value: 'plan' },
    { label: 'Timeline', value: 'timeline' },
    { label: 'Modifications', value: 'modifications' },
  ];

  const confirmOptions = [
    { label: 'Approve and Execute', value: 'approve' },
    { label: 'Request Changes', value: 'modify' },
    { label: 'Save to File', value: 'save' },
    { label: 'Cancel', value: 'cancel' },
  ];

  useInput((input, key) => {
    if (key.tab && !showConfirm) {
      const currentIndex = tabs.findIndex((t) => t.value === activeTab);
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveTab((tabs[nextIndex]?.value as Tab) || 'overview');
    }
    if (key.return && !showConfirm) {
      setShowConfirm(true);
    }
    if (input === 'd' && !showConfirm) {
      setShowDetails(!showDetails);
    }
  });

  const handleConfirm = async (item: { value: string }) => {
    switch (item.value) {
      case 'approve':
        onApprove(true);
        break;
      case 'modify':
        onApprove(false, {});
        break;
      case 'save':
        await saveSOWToFile();
        setShowConfirm(false);
        break;
      case 'cancel':
      default:
        onApprove(false);
        break;
    }
  };

  const saveSOWToFile = async () => {
    try {
      const { saveSOW } = await import('../utils/file-output.js');
      await saveSOW(sow, { format: 'markdown' });
    } catch (error: unknown) {
      console.error('Failed to save SOW:', error);
    }
  };

  const renderOverview = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Project Overview</Text>
      </Box>
      <Text>Title: {sow.title}</Text>
      <Text>Description: {sow.description}</Text>
      <Text>Estimated Duration: {sow.estimatedDuration}</Text>
      <Text>Total Budget: ${sow.totalBudget}</Text>
      <Box marginTop={1}>
        <Text bold>Deliverables:</Text>
      </Box>
      {sow.deliverables?.map((d: unknown, i: number) => (
        <Text key={i}> • {d.name}</Text>
      ))}
    </Box>
  );

  const renderPlan = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Execution Plan</Text>
      </Box>
      {sow.tasks?.map((task: unknown, i: number) => (
        <Box key={i} marginBottom={1}>
          <Text bold color="cyan">
            {i + 1}. {task.name}
          </Text>
          <Text> Description: {task.description}</Text>
          <Text> Duration: {task.duration}</Text>
          <Text> Dependencies: {task.dependencies?.join(', ') || 'None'}</Text>
        </Box>
      ))}
    </Box>
  );

  const renderTimeline = () => {
    const timelineData =
      sow.tasks?.map((task: unknown) => ({
        Task: task.name,
        Start: task.startDate || 'TBD',
        End: task.endDate || 'TBD',
        Duration: task.duration,
      })) || [];

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Project Timeline</Text>
        </Box>
        {timelineData.map((item, index: number) => (
          <Box key={index} marginBottom={1}>
            <Text color="cyan">{item.phase || 'Phase'}: </Text>
            <Text>{item.duration || 'N/A'} - </Text>
            <Text color="gray">{item.description || 'No description'}</Text>
          </Box>
        ))}
      </Box>
    );
  };

  const renderModifications = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Request Modifications</Text>
      </Box>
      <Text>This feature allows you to request changes to the Statement of Work.</Text>
      <Box marginTop={1}>
        <Text dimColor>Available modifications:</Text>
      </Box>
      <Text>• Adjust timelines and deadlines</Text>
      <Text>• Modify resource allocation</Text>
      <Text>• Change deliverable requirements</Text>
      <Text>• Request additional analysis</Text>
      <Box marginTop={1}>
        <Text color="yellow">Note: Modification requests will regenerate the SOW</Text>
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Statement of Work Review</Text>
      </Box>

      {!showConfirm && (
        <>
          <Box marginBottom={1}>
            {tabs.map((tab) => (
              <Text
                key={tab.value}
                color={activeTab === tab.value ? 'cyan' : 'gray'}
                bold={activeTab === tab.value}
              >
                [{tab.label}]
              </Text>
            ))}
            <Text dimColor> (Press TAB to switch)</Text>
          </Box>

          <Box flexDirection="column" borderStyle="single" padding={1}>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'plan' && renderPlan()}
            {activeTab === 'timeline' && renderTimeline()}
            {activeTab === 'modifications' && renderModifications()}
          </Box>

          <Box marginTop={1}>
            <Box marginBottom={1}>
              <Text>Press ENTER to continue • TAB to switch tabs • D to toggle details</Text>
            </Box>
            {showDetails && (
              <Box flexDirection="column" borderStyle="double" padding={1}>
                <Text bold color="magenta">
                  Additional Details
                </Text>
                <Text>Session ID: {sow.sessionId || 'N/A'}</Text>
                <Text>Created: {new Date().toISOString()}</Text>
                <Text>Context: {sow.context || 'Default'}</Text>
                <Text>Priority: {sow.priority || 'Medium'}</Text>
              </Box>
            )}
          </Box>
        </>
      )}

      {showConfirm && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Do you want to proceed with this plan?</Text>
          </Box>
          <SelectInput items={confirmOptions} onSelect={handleConfirm} />
        </Box>
      )}
    </Box>
  );
};

export default SOWReview;
