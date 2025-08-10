import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';

interface StepConfirmationProps {
  steps: Array<{
    id: string;
    name: string;
    description: string;
    required: boolean;
    estimatedTime?: string;
    dependencies?: string[];
  }>;
  onConfirm: (confirmedSteps: string[]) => void;
  onCancel: () => void;
}

type ConfirmationState = 'review' | 'selecting' | 'confirming';

const StepConfirmation: React.FC<StepConfirmationProps> = ({ 
  steps, 
  onConfirm, 
  onCancel 
}) => {
  const [state, setState] = useState<ConfirmationState>('review');
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(
    new Set(steps.filter(s => s.required).map(s => s.id))
  );

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    } else if (state === 'review') {
      if (key.return) {
        setState('selecting');
      } else if (input === 's') {
        setState('selecting');
      }
    } else if (state === 'selecting') {
      if (key.return) {
        setState('confirming');
      } else if (input === 'a') {
        // Select all optional steps
        setSelectedSteps(new Set(steps.map(s => s.id)));
      } else if (input === 'r') {
        // Reset to required only
        setSelectedSteps(new Set(steps.filter(s => s.required).map(s => s.id)));
      }
    }
  });

  const toggleStep = (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (step?.required) return; // Cannot deselect required steps

    const newSelected = new Set(selectedSteps);
    if (newSelected.has(stepId)) {
      newSelected.delete(stepId);
    } else {
      newSelected.add(stepId);
    }
    setSelectedSteps(newSelected);
  };

  // Allow spacebar to toggle steps in selection mode
  useInput((input) => {
    if (state === 'selecting' && input === ' ') {
      // For now, just toggle the first optional step
      const firstOptional = steps.find(s => !s.required);
      if (firstOptional) {
        toggleStep(firstOptional.id);
      }
    }
  });

  const renderReview = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Step-by-Step Execution Plan</Text>
      </Box>
      
      <Text>The following steps will be executed:</Text>
      <Box marginTop={1} marginBottom={1}>
        {steps.map((step, i) => (
          <Box key={step.id} marginBottom={1}>
            <Text bold color={step.required ? 'yellow' : 'white'}>
              {i + 1}. {step.name}
              {step.required && <Text color="yellow"> (Required)</Text>}
            </Text>
            <Box marginLeft={3}>
              <Text color="gray">{step.description}</Text>
              {step.estimatedTime && (
                <Text color="gray">Estimated time: {step.estimatedTime}</Text>
              )}
              {step.dependencies && step.dependencies.length > 0 && (
                <Text color="gray">Dependencies: {step.dependencies.join(', ')}</Text>
              )}
            </Box>
          </Box>
        ))}
      </Box>
      
      <Box marginTop={1}>
        <Text color="cyan">Press ENTER to proceed • S to select steps • ESC to cancel</Text>
      </Box>
    </Box>
  );

  const renderSelecting = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Select Steps to Execute</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text>Choose which steps to include in the execution:</Text>
      </Box>
      
      {steps.map((step) => (
        <Box key={step.id} marginBottom={1}>
          <Box>
            <Text color={selectedSteps.has(step.id) ? 'green' : 'gray'}>
              {selectedSteps.has(step.id) ? '✓' : '○'} 
            </Text>
            <Text 
              bold={step.required}
              color={step.required ? 'yellow' : selectedSteps.has(step.id) ? 'white' : 'gray'}
              dimColor={!selectedSteps.has(step.id) && !step.required}
            >
              {' '}{step.name}
            </Text>
            {step.required && <Text color="yellow"> (Required)</Text>}
          </Box>
          
          {!step.required && (
            <Box marginLeft={2}>
              <Text color="gray">Press space to toggle</Text>
            </Box>
          )}
        </Box>
      ))}
      
      <Box marginTop={1} flexDirection="column">
        <Text color="cyan">A - Select all • R - Reset to required • ENTER to confirm • ESC to cancel</Text>
        <Text color="gray">Selected: {selectedSteps.size}/{steps.length} steps</Text>
      </Box>
    </Box>
  );

  const renderConfirming = () => {
    const selectedStepsList = steps.filter(s => selectedSteps.has(s.id));
    const totalEstimatedTime = selectedStepsList.reduce((total, step) => {
      if (step.estimatedTime) {
        const minutes = parseInt(step.estimatedTime.replace(/\D/g, '')) || 0;
        return total + minutes;
      }
      return total;
    }, 0);

    const confirmOptions = [
      { label: `Execute ${selectedSteps.size} selected steps`, value: 'execute' },
      { label: 'Go back to selection', value: 'back' },
      { label: 'Cancel', value: 'cancel' },
    ];

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">Confirm Execution</Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text>You have selected {selectedSteps.size} steps for execution:</Text>
        </Box>
        
        {selectedStepsList.map((step) => (
          <Box key={step.id} marginLeft={2}>
            <Text>• {step.name}</Text>
          </Box>
        ))}
        
        {totalEstimatedTime > 0 && (
          <Box marginTop={1}>
            <Text color="yellow">
              Total estimated time: ~{totalEstimatedTime} minutes
            </Text>
          </Box>
        )}
        
        <Box marginTop={2}>
          <SelectInput 
            items={confirmOptions} 
            onSelect={(item) => {
              switch (item.value) {
                case 'execute':
                  onConfirm(Array.from(selectedSteps));
                  break;
                case 'back':
                  setState('selecting');
                  break;
                case 'cancel':
                  onCancel();
                  break;
              }
            }}
          />
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" borderStyle="round" padding={1}>
      {state === 'review' && renderReview()}
      {state === 'selecting' && renderSelecting()}
      {state === 'confirming' && renderConfirming()}
    </Box>
  );
};

export default StepConfirmation;