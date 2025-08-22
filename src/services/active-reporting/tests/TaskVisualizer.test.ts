/**
 * Task Visualizer Tests
 * Test suite for CLI visualization components
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { TaskVisualizer } from '../TaskVisualizer';
import { ProgressMetrics, SOW, Task } from '../types';

describe('TaskVisualizer', () => {
  let visualizer: TaskVisualizer;
  let mockTask: Task;
  let mockSOW: SOW;
  let mockProgress: ProgressMetrics;

  beforeEach(() => {
    visualizer = new TaskVisualizer();
    
    mockTask = {
      id: 'task-1',
      title: 'Implement user authentication',
      description: 'Create login and registration functionality',
      status: 'in_progress',
      priority: 'high',
      estimatedTime: 240,
      actualTime: 120,
      dependencies: ['task-0'],
      subtasks: [],
      assignee: 'ai',
      progress: 50,
      metadata: {
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T14:00:00Z')
      }
    };

    mockSOW = {
      id: 'sow-1',
      title: 'User Management System',
      objective: 'Build comprehensive user management',
      scope: ['authentication', 'profiles', 'permissions'],
      deliverables: [
        {
          id: 'del-1',
          title: 'Authentication Module',
          description: 'Complete auth system',
          acceptanceCriteria: ['Login works', 'Registration works'],
          dueDate: new Date('2024-02-01')
        }
      ],
      timeline: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-01'),
        duration: 30,
        unit: 'days',
        milestones: []
      },
      risks: [],
      assumptions: [],
      successCriteria: [],
      tasks: [mockTask]
    };

    mockProgress = {
      totalTasks: 4,
      completedTasks: 1,
      inProgressTasks: 2,
      blockedTasks: 1,
      overallProgress: 35,
      estimatedTimeRemaining: 480,
      velocity: 1.2,
      lastUpdated: new Date()
    };
  });

  describe('Progress Bar Rendering', () => {
    it('should render progress bar with correct fill', () => {
      const progressBar = visualizer.renderProgressBar(65, 20);
      
      expect(progressBar).toContain('█'); // Filled sections
      expect(progressBar).toContain('░'); // Empty sections
      expect(progressBar.length).toBeGreaterThan(0);
    });

    it('should handle edge cases for progress values', () => {
      expect(() => visualizer.renderProgressBar(0, 20)).not.toThrow();
      expect(() => visualizer.renderProgressBar(100, 20)).not.toThrow();
      expect(() => visualizer.renderProgressBar(-5, 20)).not.toThrow();
      expect(() => visualizer.renderProgressBar(105, 20)).not.toThrow();
    });

    it('should render different bar widths correctly', () => {
      const shortBar = visualizer.renderProgressBar(50, 10);
      const longBar = visualizer.renderProgressBar(50, 40);
      
      // Length check accounts for ANSI color codes
      expect(longBar.replace(/\u001b\[[0-9;]*m/g, '').length).toBeGreaterThan(
        shortBar.replace(/\u001b\[[0-9;]*m/g, '').length
      );
    });
  });

  describe('Task Visualization', () => {
    it('should render task with status indicators', () => {
      const output = visualizer.renderTask(mockTask);
      
      expect(output).toContain(mockTask.title);
      expect(output).toContain('🔄'); // In progress indicator
      expect(output).toContain('50%'); // Progress percentage
    });

    it('should show different status indicators', () => {
      const completedTask = { ...mockTask, status: 'completed' as const };
      const blockedTask = { ...mockTask, status: 'blocked' as const };
      
      const completedOutput = visualizer.renderTask(completedTask);
      const blockedOutput = visualizer.renderTask(blockedTask);
      
      expect(completedOutput).toContain('✅');
      expect(blockedOutput).toContain('⏸');
    });

    it('should display priority with appropriate colors', () => {
      const criticalTask = { ...mockTask, priority: 'critical' as const };
      const lowTask = { ...mockTask, priority: 'low' as const };
      
      const criticalOutput = visualizer.renderTask(criticalTask);
      const lowOutput = visualizer.renderTask(lowTask);
      
      expect(criticalOutput).toBeTruthy();
      expect(lowOutput).toBeTruthy();
      // Color codes are embedded, so we just check they render without error
    });
  });

  describe('Task List Visualization', () => {
    it('should render multiple tasks in organized layout', () => {
      const tasks = [
        mockTask,
        { ...mockTask, id: 'task-2', status: 'completed' as const, progress: 100 },
        { ...mockTask, id: 'task-3', status: 'blocked' as const, progress: 25 }
      ];
      
      const output = visualizer.renderTaskList(tasks);
      
      expect(output).toContain('✅'); // Completed
      expect(output).toContain('🔄'); // In progress
      expect(output).toContain('⏸'); // Blocked
    });

    it('should group tasks by status', () => {
      const tasks = [
        { ...mockTask, id: 'task-1', status: 'completed' as const },
        { ...mockTask, id: 'task-2', status: 'completed' as const },
        { ...mockTask, id: 'task-3', status: 'in_progress' as const }
      ];
      
      const output = visualizer.renderTaskList(tasks, { groupByStatus: true });
      
      expect(output).toContain('Completed');
      expect(output).toContain('In Progress');
    });
  });

  describe('Progress Dashboard', () => {
    it('should render comprehensive dashboard', () => {
      const dashboard = visualizer.renderProgressDashboard(mockProgress);
      
      expect(dashboard).toContain('35%'); // Overall progress
      expect(dashboard).toContain('1/4'); // Completed tasks
      expect(dashboard).toContain('480'); // Estimated time remaining
      expect(dashboard).toContain('1.2'); // Velocity
    });

    it('should handle zero progress gracefully', () => {
      const zeroProgress = { ...mockProgress, overallProgress: 0, completedTasks: 0 };
      
      expect(() => visualizer.renderProgressDashboard(zeroProgress)).not.toThrow();
    });

    it('should display milestone information when available', () => {
      const progressWithMilestones = {
        ...mockProgress,
        nextMilestone: {
          id: 'milestone-1',
          title: 'Alpha Release',
          dueDate: new Date('2024-01-15'),
          tasksRequired: ['task-1', 'task-2']
        }
      };
      
      const output = visualizer.renderProgressDashboard(progressWithMilestones);
      expect(output).toContain('Alpha Release');
    });
  });

  describe('SOW Visualization', () => {
    it('should render SOW overview with key information', () => {
      const output = visualizer.renderSOW(mockSOW);
      
      expect(output).toContain(mockSOW.title);
      expect(output).toContain(mockSOW.objective);
      expect(output).toContain('30 days'); // Timeline
    });

    it('should show deliverables and milestones', () => {
      const output = visualizer.renderSOW(mockSOW);
      
      expect(output).toContain('Authentication Module');
      expect(output).toContain('deliverable');
    });
  });

  describe('Layout and Formatting', () => {
    it('should respect 124-character width constraint', () => {
      const dashboard = visualizer.renderProgressDashboard(mockProgress);
      const lines = dashboard.split('\n');
      
      lines.forEach(line => {
        const cleanLine = line.replace(/\u001b\[[0-9;]*m/g, ''); // Remove ANSI codes
        expect(cleanLine.length).toBeLessThanOrEqual(124);
      });
    });

    it('should create proper box drawing borders', () => {
      const dashboard = visualizer.renderProgressDashboard(mockProgress);
      
      expect(dashboard).toContain('╔'); // Top-left corner
      expect(dashboard).toContain('╗'); // Top-right corner
      expect(dashboard).toContain('╚'); // Bottom-left corner
      expect(dashboard).toContain('╝'); // Bottom-right corner
      expect(dashboard).toContain('═'); // Horizontal lines
      expect(dashboard).toContain('║'); // Vertical lines
    });

    it('should center text properly', () => {
      const centeredText = visualizer.centerText('Test', 20);
      
      expect(centeredText.length).toBe(20);
      expect(centeredText.trim()).toBe('Test');
    });
  });

  describe('Special Visualizations', () => {
    it('should render task completion celebration', () => {
      const celebration = visualizer.renderTaskCompletion(mockTask);
      
      expect(celebration).toContain('🎉');
      expect(celebration).toContain(mockTask.title);
    });

    it('should render blocker alerts prominently', () => {
      const blocker = {
        id: 'blocker-1',
        title: 'API Endpoint Unavailable',
        description: 'External service is down',
        severity: 'high' as const,
        affectedTasks: ['task-1'],
        reportedAt: new Date(),
        reportedBy: 'system'
      };
      
      const alert = visualizer.renderBlockerAlert(blocker);
      
      expect(alert).toContain('🚨');
      expect(alert).toContain('API Endpoint Unavailable');
    });

    it('should render decision points clearly', () => {
      const decision = {
        id: 'decision-1',
        title: 'Choose Database Technology',
        description: 'Select between PostgreSQL and MongoDB',
        options: [
          { id: 'opt-1', title: 'PostgreSQL', pros: ['ACID'], cons: ['Complex'] },
          { id: 'opt-2', title: 'MongoDB', pros: ['Flexible'], cons: ['Consistency'] }
        ],
        impact: 'high' as const,
        deadline: new Date('2024-01-10'),
        context: {}
      };
      
      const decisionOutput = visualizer.renderDecisionPoint(decision);
      
      expect(decisionOutput).toContain('🤔');
      expect(decisionOutput).toContain('PostgreSQL');
      expect(decisionOutput).toContain('MongoDB');
    });
  });

  describe('Interactive Elements', () => {
    it('should render selection menus', () => {
      const options = [
        { value: 'option1', label: 'First Option' },
        { value: 'option2', label: 'Second Option' },
        { value: 'option3', label: 'Third Option' }
      ];
      
      const menu = visualizer.renderMenu('Select an option:', options);
      
      expect(menu).toContain('First Option');
      expect(menu).toContain('Second Option');
      expect(menu).toContain('Third Option');
      expect(menu).toMatch(/\[a\]|\[1\]/); // Should have selection indicators
    });

    it('should render confirmation dialogs', () => {
      const dialog = visualizer.renderConfirmation(
        'Proceed with task deletion?',
        'This action cannot be undone.'
      );
      
      expect(dialog).toContain('Proceed with task deletion?');
      expect(dialog).toContain('[Y/n]');
    });
  });

  describe('Performance', () => {
    it('should render large task lists efficiently', () => {
      const largeTasks = Array.from({ length: 100 }, (_, i) => ({
        ...mockTask,
        id: `task-${i}`,
        title: `Task ${i}`
      }));
      
      const start = Date.now();
      const output = visualizer.renderTaskList(largeTasks);
      const duration = Date.now() - start;
      
      expect(output).toBeTruthy();
      expect(duration).toBeLessThan(1000); // Should render within 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle missing task data gracefully', () => {
      const incompleteTask = {
        id: 'incomplete',
        title: 'Test Task',
        status: 'pending' as const,
        priority: 'medium' as const,
        progress: 0,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      } as Task;
      
      expect(() => visualizer.renderTask(incompleteTask)).not.toThrow();
    });

    it('should handle null or undefined inputs', () => {
      expect(() => visualizer.renderTask(null as any)).not.toThrow();
      expect(() => visualizer.renderProgressDashboard(null as any)).not.toThrow();
    });
  });
});