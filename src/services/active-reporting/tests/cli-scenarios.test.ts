/**
 * CLI Scenarios Test
 * Tests various CLI command scenarios for Active Reporting System
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveReportingCommand } from '../../../commands/active-reporting';
import { ActiveReportingService } from '../ActiveReportingService';

describe('CLI Command Scenarios', () => {
  let command: ActiveReportingCommand;
  let service: ActiveReportingService;
  let consoleSpy: any;

  beforeEach(async () => {
    command = new ActiveReportingCommand();
    service = ActiveReportingService.getInstance();
    await service.initialize();
    
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await service.dispose();
  });

  describe('Task Management Scenarios', () => {
    it('should handle basic task lifecycle', async () => {
      // Scenario 1: Create a new task
      await command.task('add', 'Implement user dashboard with charts and analytics');
      
      const tasks = service.getAllTasks();
      expect(tasks.length).toBeGreaterThan(0);
      
      const newTask = tasks[tasks.length - 1];
      expect(newTask.title).toBeTruthy();
      expect(newTask.status).toBe('pending');
      
      // Scenario 2: Update task status
      await command.task('update', newTask.id, 'in_progress');
      
      const updatedTask = service.getTask(newTask.id);
      expect(updatedTask?.status).toBe('in_progress');
      
      // Scenario 3: Set dependencies
      const dependentTaskIntent = await service.analyzeUserIntent('Create API endpoints');
      const dependentTask = await service.createTask(dependentTaskIntent);
      
      await command.task('depends', newTask.id, dependentTask.id);
      
      const taskWithDeps = service.getTask(newTask.id);
      expect(taskWithDeps?.dependencies).toContain(dependentTask.id);
      
      // Scenario 4: Set time estimate
      await command.task('estimate', newTask.id, '240');
      
      const taskWithEstimate = service.getTask(newTask.id);
      expect(taskWithEstimate?.estimatedTime).toBe(240);
      
      // Scenario 5: List all tasks
      await command.task('list');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ALL TASKS')
      );
    });

    it('should handle edge cases in task commands', async () => {
      // Empty task description
      await command.task('add', '');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task description is required')
      );
      
      // Invalid task ID
      await command.task('update', 'invalid-id', 'completed');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update task')
      );
      
      // Missing parameters
      await command.task('update');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task ID and status are required')
      );
      
      // Invalid estimate
      await command.task('estimate', 'some-id', 'invalid');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task ID and time estimate are required')
      );
    });

    it('should show task overview when no tasks exist', async () => {
      await command.task();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No active tasks')
      );
    });
  });

  describe('SOW Management Scenarios', () => {
    it('should handle SOW generation with various request types', async () => {
      // Scenario 1: Simple feature request
      await command.sow('generate', 'Create a blog system with posts and comments');
      
      const sow1 = service.getCurrentSOW();
      expect(sow1).toBeDefined();
      expect(sow1?.objective).toContain('blog');
      
      // Scenario 2: Complex application request
      await command.sow(
        'generate', 
        'Build a full-stack e-commerce platform with user authentication, product catalog, shopping cart, payment processing, order management, and admin dashboard'
      );
      
      const sow2 = service.getCurrentSOW();
      expect(sow2?.tasks.length).toBeGreaterThan(5);
      
      // Scenario 3: Technical implementation request
      await command.sow(
        'generate',
        'Implement microservices architecture with Docker containers, API gateway, service discovery, and monitoring'
      );
      
      const sow3 = service.getCurrentSOW();
      expect(sow3?.objective).toContain('microservices');
    });

    it('should handle SOW viewing when no SOW exists', async () => {
      await command.sow();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No current SOW')
      );
    });

    it('should handle SOW approval flow', async () => {
      // Generate a SOW first
      await command.sow('generate', 'Simple web application');
      
      // Test approval
      await command.sow('approve');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('approved')
      );
      
      // Test modification mode
      await command.sow('modify');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('modification mode')
      );
    });
  });

  describe('Progress Tracking Scenarios', () => {
    it('should handle progress tracking with various states', async () => {
      // Create tasks in different states
      const tasks = await Promise.all([
        service.analyzeUserIntent('Completed task').then(i => service.createTask(i)),
        service.analyzeUserIntent('In progress task').then(i => service.createTask(i)),
        service.analyzeUserIntent('Blocked task').then(i => service.createTask(i)),
        service.analyzeUserIntent('Pending task').then(i => service.createTask(i))
      ]);
      
      // Set different statuses
      await service.updateTaskStatus(tasks[0].id, 'completed');
      await service.updateTaskProgress(tasks[0].id, 100);
      
      await service.updateTaskStatus(tasks[1].id, 'in_progress');
      await service.updateTaskProgress(tasks[1].id, 60);
      
      await service.updateTaskStatus(tasks[2].id, 'blocked');
      
      // Test progress dashboard
      await command.progress();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('PROGRESS DASHBOARD')
      );
      
      // Test detailed progress
      await command.progress('detailed');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Detailed progress analysis')
      );
      
      // Test progress history
      await command.progress('history');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Progress history')
      );
      
      // Test progress forecast
      await command.progress('forecast');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Progress forecast')
      );
    });
  });

  describe('Reporting Scenarios', () => {
    it('should handle various reporting scenarios', async () => {
      // Create some test data
      const tasks = await Promise.all([
        service.analyzeUserIntent('Report test task 1').then(i => service.createTask(i)),
        service.analyzeUserIntent('Report test task 2').then(i => service.createTask(i))
      ]);
      
      await service.updateTaskStatus(tasks[0].id, 'completed');
      await service.updateTaskStatus(tasks[1].id, 'in_progress');
      
      // Test status report generation
      await command.report();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('STATUS REPORT')
      );
      
      // Test blocker reporting
      await command.report('blocker', 'Database connection timeout causing delays');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Blocker reported')
      );
      
      // Test risk reporting
      await command.report('risk', 'Third-party API might be deprecated');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Risk reported')
      );
      
      // Test export functionality
      await command.report('export', 'json');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Report exported')
      );
      
      await command.report('export', 'markdown');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Report exported')
      );
    });
  });

  describe('User Experience Scenarios', () => {
    it('should provide helpful feedback for common user mistakes', async () => {
      // Test various error scenarios that users might encounter
      
      // Missing command arguments
      await command.task('update');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task ID and status are required')
      );
      
      await command.task('depends');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task ID is required')
      );
      
      await command.task('estimate');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task ID and time estimate are required')
      );
      
      // Empty inputs
      await command.sow('generate', '');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Request description is required')
      );
      
      await command.report('blocker', '');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Blocker description is required')
      );
    });

    it('should handle multilingual scenarios', async () => {
      // Test with different languages
      const requests = [
        'ユーザー認証システムを作成する', // Japanese
        'Create user authentication system', // English
        '创建用户认证系统', // Chinese
        '사용자 인증 시스템 생성', // Korean
        'Tạo hệ thống xác thực người dùng' // Vietnamese
      ];
      
      for (const request of requests) {
        await command.sow('generate', request);
        const sow = service.getCurrentSOW();
        expect(sow).toBeDefined();
        expect(sow?.tasks.length).toBeGreaterThan(0);
      }
    });

    it('should handle complex nested task scenarios', async () => {
      // Create a complex project with dependencies
      const mainTaskIntent = await service.analyzeUserIntent(
        'Build a social media platform with real-time messaging'
      );
      const mainTask = await service.createTask(mainTaskIntent);
      
      // Create prerequisite tasks
      const prereqTasks = await Promise.all([
        service.analyzeUserIntent('Set up database schema').then(i => service.createTask(i)),
        service.analyzeUserIntent('Create authentication system').then(i => service.createTask(i)),
        service.analyzeUserIntent('Design API endpoints').then(i => service.createTask(i))
      ]);
      
      // Set up dependency chain
      await service.setTaskDependencies(mainTask.id, prereqTasks.map(t => t.id));
      
      // Complete prerequisites in order
      for (const task of prereqTasks) {
        await service.updateTaskStatus(task.id, 'in_progress');
        await service.updateTaskProgress(task.id, 100);
      }
      
      // Check that main task can now be started
      const progressData = service.getProgressData();
      expect(progressData.completedTasks).toBe(prereqTasks.length);
      
      // Test progress visualization with complex state
      await command.progress();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('PROGRESS DASHBOARD')
      );
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid command execution', async () => {
      const startTime = Date.now();
      
      // Execute multiple commands rapidly
      const promises = [
        command.task('add', 'Rapid test task 1'),
        command.task('add', 'Rapid test task 2'),
        command.task('add', 'Rapid test task 3'),
        command.sow('generate', 'Quick SOW generation test'),
        command.progress(),
        command.report()
      ];
      
      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(3000);
      
      // Verify all tasks were created
      const tasks = service.getAllTasks();
      expect(tasks.length).toBeGreaterThanOrEqual(3);
    });

    it('should maintain consistency during concurrent operations', async () => {
      // Create initial tasks
      const tasks = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          service.analyzeUserIntent(`Concurrent test task ${i + 1}`)
            .then(intent => service.createTask(intent))
        )
      );
      
      // Perform concurrent updates
      const updatePromises = tasks.map((task, index) => {
        if (index < 2) {
          return service.updateTaskStatus(task.id, 'completed');
        } else if (index < 4) {
          return service.updateTaskStatus(task.id, 'in_progress');
        } else {
          return service.updateTaskStatus(task.id, 'blocked');
        }
      });
      
      await Promise.all(updatePromises);
      
      // Verify final state
      const progressData = service.getProgressData();
      expect(progressData.totalTasks).toBe(5);
      expect(progressData.completedTasks).toBe(2);
      expect(progressData.inProgressTasks).toBe(2);
      expect(progressData.blockedTasks).toBe(1);
    });
  });
});