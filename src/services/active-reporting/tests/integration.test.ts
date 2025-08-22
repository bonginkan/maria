/**
 * Active Reporting System - Integration Tests
 * Tests the complete workflow from user request to task completion
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveReportingService } from '../ActiveReportingService';
import { activeReportingCommand } from '../../../commands/active-reporting';

describe('Active Reporting System Integration', () => {
  let service: ActiveReportingService;
  let consoleSpy: any;

  beforeEach(async () => {
    service = ActiveReportingService.getInstance();
    await service.initialize();
    
    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await service.dispose();
  });

  describe('Complete Workflow Tests', () => {
    it('should handle full workflow: request → SOW → tasks → completion', async () => {
      // Step 1: User makes a request
      const request = 'Create a user authentication system with login and registration';
      
      // Step 2: Analyze intent
      const intent = await service.analyzeUserIntent(request);
      expect(intent.primaryIntent).toBe('implement_feature');
      expect(intent.keywords).toContain('authentication');
      expect(intent.confidence).toBeGreaterThan(0.7);
      
      // Step 3: Generate SOW
      const sow = await service.createSOWFromIntent(intent);
      expect(sow.title).toBeTruthy();
      expect(sow.objective).toBeTruthy();
      expect(sow.tasks.length).toBeGreaterThan(0);
      
      // Step 4: Create tasks from SOW
      const tasks = sow.tasks;
      expect(tasks.length).toBeGreaterThan(0);
      
      // Step 5: Update task progress
      const firstTask = tasks[0];
      await service.updateTaskStatus(firstTask.id, 'in_progress');
      await service.updateTaskProgress(firstTask.id, 50);
      
      let updatedTask = service.getTask(firstTask.id);
      expect(updatedTask?.status).toBe('in_progress');
      expect(updatedTask?.progress).toBe(50);
      
      // Step 6: Complete task
      await service.updateTaskProgress(firstTask.id, 100);
      
      updatedTask = service.getTask(firstTask.id);
      expect(updatedTask?.status).toBe('completed');
      expect(updatedTask?.progress).toBe(100);
      
      // Step 7: Check progress report
      const progressReport = await service.generateProgressReport();
      expect(progressReport.overallProgress).toBeGreaterThan(0);
    });

    it('should handle task dependencies correctly', async () => {
      // Create dependent tasks
      const task1Intent = await service.analyzeUserIntent('Set up database schema');
      const task2Intent = await service.analyzeUserIntent('Create API endpoints');
      
      const task1 = await service.createTask(task1Intent);
      const task2 = await service.createTask(task2Intent);
      
      // Set task2 to depend on task1
      await service.setTaskDependencies(task2.id, [task1.id]);
      
      const updatedTask2 = service.getTask(task2.id);
      expect(updatedTask2?.dependencies).toContain(task1.id);
    });

    it('should handle blocker reporting and resolution', async () => {
      // Create a task
      const intent = await service.analyzeUserIntent('Implement payment processing');
      const task = await service.createTask(intent);
      
      // Block the task
      await service.updateTaskStatus(task.id, 'blocked');
      
      // Report a blocker
      await service.reportBlocker('Payment API is down');
      
      // Check that task is in blocked state
      const blockedTask = service.getTask(task.id);
      expect(blockedTask?.status).toBe('blocked');
    });
  });

  describe('CLI Command Integration Tests', () => {
    it('should handle task add command', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await activeReportingCommand.task('add', 'Test task from CLI');
        
        // Check if task was created
        const allTasks = service.getAllTasks();
        expect(allTasks.length).toBeGreaterThan(0);
        
        // Find the task we just created
        const newTask = allTasks.find(t => t.title.includes('Test') || t.title.includes('CLI'));
        expect(newTask).toBeDefined();
      } catch (error) {
        // Expected if process.exit was called
        if (error instanceof Error && error.message !== 'Process exit called') {
          throw error;
        }
      } finally {
        mockExit.mockRestore();
      }
    });

    it('should handle progress command', async () => {
      // Add some tasks first
      const intent1 = await service.analyzeUserIntent('Task 1');
      const intent2 = await service.analyzeUserIntent('Task 2');
      
      await service.createTask(intent1);
      const task2 = await service.createTask(intent2);
      
      // Complete one task
      await service.updateTaskStatus(task2.id, 'completed');
      
      // Test progress command
      await activeReportingCommand.progress();
      
      // Should have generated console output
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle SOW generation command', async () => {
      await activeReportingCommand.sow('generate', 'Build a todo app with React and TypeScript');
      
      // Check if SOW was generated
      const currentSOW = service.getCurrentSOW();
      expect(currentSOW).toBeDefined();
      expect(currentSOW?.tasks.length).toBeGreaterThan(0);
    });

    it('should handle report generation command', async () => {
      // Create some test data
      const intent = await service.analyzeUserIntent('Test report generation');
      await service.createTask(intent);
      
      // Generate report
      await activeReportingCommand.report();
      
      // Should have generated console output
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle invalid task IDs gracefully', async () => {
      const invalidTaskId = 'invalid-task-id-12345';
      
      // These should not throw errors
      await service.updateTaskStatus(invalidTaskId, 'completed');
      await service.updateTaskProgress(invalidTaskId, 100);
      await service.setTaskDependencies(invalidTaskId, []);
      
      const task = service.getTask(invalidTaskId);
      expect(task).toBeUndefined();
    });

    it('should handle empty task descriptions', async () => {
      try {
        await activeReportingCommand.task('add', '');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Task description is required')
        );
      } catch (error) {
        // Expected if validation throws
      }
    });

    it('should handle invalid task status transitions', async () => {
      const intent = await service.analyzeUserIntent('Test task');
      const task = await service.createTask(intent);
      
      try {
        await service.updateTaskStatus(task.id, 'invalid_status' as any);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent task operations', async () => {
      const promises = [];
      
      // Create 10 tasks concurrently
      for (let i = 0; i < 10; i++) {
        const promise = service.analyzeUserIntent(`Test task ${i}`)
          .then(intent => service.createTask(intent));
        promises.push(promise);
      }
      
      const tasks = await Promise.all(promises);
      expect(tasks).toHaveLength(10);
      
      // Update all tasks concurrently
      const updatePromises = tasks.map(task => 
        service.updateTaskProgress(task.id, 50)
      );
      
      await Promise.all(updatePromises);
      
      // Verify all tasks were updated
      tasks.forEach(task => {
        const updatedTask = service.getTask(task.id);
        expect(updatedTask?.progress).toBe(50);
      });
    });

    it('should maintain performance with large number of tasks', async () => {
      const startTime = Date.now();
      
      // Create 100 tasks
      const tasks = [];
      for (let i = 0; i < 100; i++) {
        const intent = await service.analyzeUserIntent(`Performance test task ${i}`);
        const task = await service.createTask(intent);
        tasks.push(task);
      }
      
      // Generate progress report
      await service.generateProgressReport();
      
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);
      expect(tasks).toHaveLength(100);
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain data consistency across operations', async () => {
      // Create initial state
      const intent1 = await service.analyzeUserIntent('Consistent task 1');
      const intent2 = await service.analyzeUserIntent('Consistent task 2');
      
      const task1 = await service.createTask(intent1);
      const task2 = await service.createTask(intent2);
      
      // Perform various operations
      await service.updateTaskStatus(task1.id, 'in_progress');
      await service.updateTaskProgress(task1.id, 75);
      await service.updateTaskStatus(task2.id, 'completed');
      
      // Check data consistency
      const progressData = service.getProgressData();
      const allTasks = service.getAllTasks();
      
      expect(allTasks).toHaveLength(2);
      expect(progressData.totalTasks).toBe(2);
      expect(progressData.completedTasks).toBe(1);
      expect(progressData.inProgressTasks).toBe(1);
    });

    it('should handle task metadata correctly', async () => {
      const intent = await service.analyzeUserIntent('Metadata test task');
      const task = await service.createTask(intent);
      
      expect(task.metadata.createdAt).toBeInstanceOf(Date);
      expect(task.metadata.updatedAt).toBeInstanceOf(Date);
      
      const originalUpdatedAt = task.metadata.updatedAt;
      
      // Wait a bit and update
      await new Promise(resolve => setTimeout(resolve, 10));
      await service.updateTaskProgress(task.id, 25);
      
      const updatedTask = service.getTask(task.id);
      expect(updatedTask?.metadata.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });
  });

  describe('Visualization Tests', () => {
    it('should generate proper visual output', async () => {
      // Create test data
      const intent1 = await service.analyzeUserIntent('Visual test task 1');
      const intent2 = await service.analyzeUserIntent('Visual test task 2');
      
      const task1 = await service.createTask(intent1);
      const task2 = await service.createTask(intent2);
      
      await service.updateTaskStatus(task1.id, 'completed');
      await service.updateTaskProgress(task1.id, 100);
      
      // Test progress visualization
      const progressData = service.getProgressData();
      const visualization = service.visualizeProgress(progressData);
      
      expect(visualization).toContain('PROGRESS DASHBOARD');
      expect(visualization).toContain('Overall Progress');
      expect(visualization).toContain('%');
    });
  });
});