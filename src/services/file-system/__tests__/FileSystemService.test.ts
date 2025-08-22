import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileSystemService, FileSystemService } from '../FileSystemService.js';
import { tmpdir } from 'os';

describe('FileSystemService', () => {
  let testDir: string;
  let testFile: string;
  let testContent: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(tmpdir(), `maria-fs-test-${Date.now()}`);
    testFile = path.join(testDir, 'test.txt');
    testContent = 'This is test content for MARIA file system';
    
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic File Operations', () => {
    it('should write and read a file', async () => {
      await fileSystemService.writeFile(testFile, testContent);
      const readContent = await fileSystemService.readFile(testFile);
      
      expect(readContent).toBe(testContent);
    });

    it('should check if file exists', async () => {
      expect(await fileSystemService.exists(testFile)).toBe(false);
      
      await fileSystemService.writeFile(testFile, testContent);
      expect(await fileSystemService.exists(testFile)).toBe(true);
    });

    it('should delete a file', async () => {
      await fileSystemService.writeFile(testFile, testContent);
      expect(await fileSystemService.exists(testFile)).toBe(true);
      
      await fileSystemService.deleteFile(testFile);
      expect(await fileSystemService.exists(testFile)).toBe(false);
    });

    it('should get file statistics', async () => {
      await fileSystemService.writeFile(testFile, testContent);
      const stats = await fileSystemService.getFileStats(testFile);
      
      expect(stats.name).toBe('test.txt');
      expect(stats.isFile).toBe(true);
      expect(stats.isDirectory).toBe(false);
      expect(stats.size).toBe(testContent.length);
      expect(stats.path).toBe(path.resolve(testFile));
    });

    it('should handle dry run mode', async () => {
      await fileSystemService.writeFile(testFile, testContent, { dryRun: true });
      expect(await fileSystemService.exists(testFile)).toBe(false);
    });

    it('should create backup when specified', async () => {
      await fileSystemService.writeFile(testFile, 'original content');
      await fileSystemService.writeFile(testFile, 'new content', { backup: true });
      
      const files = await fs.promises.readdir(testDir);
      const backupFiles = files.filter(file => file.includes('.backup.'));
      expect(backupFiles.length).toBe(1);
    });
  });

  describe('Directory Operations', () => {
    it('should create a directory', async () => {
      const subDir = path.join(testDir, 'subdir');
      await fileSystemService.createDirectory(subDir);
      
      expect(await fileSystemService.exists(subDir)).toBe(true);
      const stats = await fileSystemService.getFileStats(subDir);
      expect(stats.isDirectory).toBe(true);
    });

    it('should create nested directories recursively', async () => {
      const nestedDir = path.join(testDir, 'level1', 'level2', 'level3');
      await fileSystemService.createDirectory(nestedDir, { recursive: true });
      
      expect(await fileSystemService.exists(nestedDir)).toBe(true);
    });

    it('should list directory contents', async () => {
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');
      const subDir = path.join(testDir, 'subdir');
      
      await fileSystemService.writeFile(file1, 'content1');
      await fileSystemService.writeFile(file2, 'content2');
      await fileSystemService.createDirectory(subDir);
      
      const files = await fileSystemService.listDirectory(testDir);
      expect(files.length).toBe(3);
      
      const fileNames = files.map(f => f.name).sort();
      expect(fileNames).toEqual(['file1.txt', 'file2.txt', 'subdir']);
    });

    it('should filter directory listing by type', async () => {
      const file1 = path.join(testDir, 'file1.txt');
      const subDir = path.join(testDir, 'subdir');
      
      await fileSystemService.writeFile(file1, 'content');
      await fileSystemService.createDirectory(subDir);
      
      const filesOnly = await fileSystemService.listDirectory(testDir, { type: 'file' });
      expect(filesOnly.length).toBe(1);
      expect(filesOnly[0].name).toBe('file1.txt');
      
      const dirsOnly = await fileSystemService.listDirectory(testDir, { type: 'directory' });
      expect(dirsOnly.length).toBe(1);
      expect(dirsOnly[0].name).toBe('subdir');
    });

    it('should delete directory recursively', async () => {
      const subDir = path.join(testDir, 'subdir');
      const nestedFile = path.join(subDir, 'nested.txt');
      
      await fileSystemService.createDirectory(subDir);
      await fileSystemService.writeFile(nestedFile, 'nested content');
      
      await fileSystemService.deleteDirectory(subDir, { recursive: true });
      expect(await fileSystemService.exists(subDir)).toBe(false);
    });
  });

  describe('Advanced Operations', () => {
    it('should copy a file', async () => {
      const sourceFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'dest.txt');
      
      await fileSystemService.writeFile(sourceFile, testContent);
      await fileSystemService.copyFile(sourceFile, destFile);
      
      expect(await fileSystemService.exists(destFile)).toBe(true);
      const copiedContent = await fileSystemService.readFile(destFile);
      expect(copiedContent).toBe(testContent);
    });

    it('should move/rename a file', async () => {
      const sourceFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'dest.txt');
      
      await fileSystemService.writeFile(sourceFile, testContent);
      await fileSystemService.moveFile(sourceFile, destFile);
      
      expect(await fileSystemService.exists(sourceFile)).toBe(false);
      expect(await fileSystemService.exists(destFile)).toBe(true);
      
      const movedContent = await fileSystemService.readFile(destFile);
      expect(movedContent).toBe(testContent);
    });

    it('should preserve timestamps when copying', async () => {
      const sourceFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'dest.txt');
      
      await fileSystemService.writeFile(sourceFile, testContent);
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await fileSystemService.copyFile(sourceFile, destFile, { preserveTimestamps: true });
      
      const sourceStats = await fileSystemService.getFileStats(sourceFile);
      const destStats = await fileSystemService.getFileStats(destFile);
      
      expect(destStats.modified.getTime()).toBe(sourceStats.modified.getTime());
    });

    it('should not overwrite existing files without force option', async () => {
      const sourceFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'dest.txt');
      
      await fileSystemService.writeFile(sourceFile, 'source content');
      await fileSystemService.writeFile(destFile, 'existing content');
      
      await expect(
        fileSystemService.copyFile(sourceFile, destFile)
      ).rejects.toThrow('already exists');
    });

    it('should overwrite existing files with force option', async () => {
      const sourceFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'dest.txt');
      
      await fileSystemService.writeFile(sourceFile, 'source content');
      await fileSystemService.writeFile(destFile, 'existing content');
      
      await fileSystemService.copyFile(sourceFile, destFile, { force: true });
      
      const finalContent = await fileSystemService.readFile(destFile);
      expect(finalContent).toBe('source content');
    });
  });

  describe('Search and Navigation', () => {
    beforeEach(async () => {
      // Create a complex directory structure for testing
      const dirs = ['dir1', 'dir2', 'dir1/subdir'];
      const files = [
        'file1.txt',
        'file2.js',
        'dir1/nested.txt',
        'dir1/script.js',
        'dir1/subdir/deep.txt',
        'dir2/readme.md',
        '.hidden.txt'
      ];
      
      for (const dir of dirs) {
        await fileSystemService.createDirectory(path.join(testDir, dir));
      }
      
      for (const file of files) {
        await fileSystemService.writeFile(path.join(testDir, file), `Content of ${file}`);
      }
    });

    it('should find files by pattern', async () => {
      const results = await fileSystemService.findFiles(testDir, {
        pattern: '.txt',
        type: 'file'
      });
      
      const txtFiles = results.filter(f => f.name.endsWith('.txt'));
      expect(txtFiles.length).toBeGreaterThan(0);
    });

    it('should find files with maximum depth', async () => {
      const shallowResults = await fileSystemService.findFiles(testDir, {
        maxDepth: 1,
        type: 'file'
      });
      
      const deepResults = await fileSystemService.findFiles(testDir, {
        maxDepth: 3,
        type: 'file'
      });
      
      expect(deepResults.length).toBeGreaterThan(shallowResults.length);
    });

    it('should include/exclude hidden files', async () => {
      const withHidden = await fileSystemService.findFiles(testDir, {
        includeHidden: true,
        type: 'file'
      });
      
      const withoutHidden = await fileSystemService.findFiles(testDir, {
        includeHidden: false,
        type: 'file'
      });
      
      expect(withHidden.length).toBeGreaterThan(withoutHidden.length);
    });

    it('should filter by file type', async () => {
      const filesOnly = await fileSystemService.findFiles(testDir, {
        type: 'file'
      });
      
      const dirsOnly = await fileSystemService.findFiles(testDir, {
        type: 'directory'
      });
      
      expect(filesOnly.every(f => f.isFile)).toBe(true);
      expect(dirsOnly.every(f => f.isDirectory)).toBe(true);
    });

    it('should use regex patterns', async () => {
      const jsFiles = await fileSystemService.findFiles(testDir, {
        pattern: '\\.js$',
        regex: true,
        type: 'file'
      });
      
      expect(jsFiles.every(f => f.name.endsWith('.js'))).toBe(true);
    });

    it('should implement glob patterns', async () => {
      // Create a file first to ensure there's something to match
      await fileSystemService.writeFile(path.join(testDir, 'glob-test.txt'), 'content');
      const globResults = await fileSystemService.glob(path.join(testDir, '*.txt'));
      expect(globResults.length).toBeGreaterThan(0);
    });
  });

  describe('Utility Methods', () => {
    it('should resolve real path', async () => {
      await fileSystemService.writeFile(testFile, testContent);
      const realPath = await fileSystemService.getRealPath(testFile);
      const expectedPath = await fs.promises.realpath(path.resolve(testFile));
      
      expect(path.isAbsolute(realPath)).toBe(true);
      expect(realPath).toBe(expectedPath);
    });

    it('should log operations', async () => {
      fileSystemService.clearOperationLog();
      
      await fileSystemService.writeFile(testFile, testContent);
      await fileSystemService.readFile(testFile);
      
      const log = fileSystemService.getOperationLog();
      expect(log.length).toBe(2);
      expect(log[0].operation).toBe('write');
      expect(log[1].operation).toBe('read');
      expect(log.every(entry => entry.success)).toBe(true);
    });

    it('should clear operation log', async () => {
      await fileSystemService.writeFile(testFile, testContent);
      expect(fileSystemService.getOperationLog().length).toBeGreaterThan(0);
      
      fileSystemService.clearOperationLog();
      expect(fileSystemService.getOperationLog().length).toBe(0);
    });

    it('should handle file operation errors gracefully', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.txt');
      
      await expect(
        fileSystemService.readFile(nonExistentFile)
      ).rejects.toThrow('Failed to read file');
      
      await expect(
        fileSystemService.deleteFile(nonExistentFile)
      ).rejects.toThrow('does not exist');
    });
  });

  describe('Service Singleton', () => {
    it('should return the same instance', () => {
      const instance1 = FileSystemService.getInstance();
      const instance2 = FileSystemService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(fileSystemService);
    });
  });

  describe('Error Handling', () => {
    it('should handle permission errors gracefully', async () => {
      // This test might not work on all systems, so we'll mock it
      const mockFsAsync = vi.spyOn(fs.promises, 'readFile');
      mockFsAsync.mockRejectedValueOnce(new Error('EACCES: permission denied'));
      
      await expect(
        fileSystemService.readFile('/root/protected-file.txt')
      ).rejects.toThrow('Failed to read file');
      
      mockFsAsync.mockRestore();
    });

    it('should log failed operations', async () => {
      fileSystemService.clearOperationLog();
      
      try {
        await fileSystemService.readFile(path.join(testDir, 'non-existent.txt'));
      } catch (error) {
        // Expected error
      }
      
      const log = fileSystemService.getOperationLog();
      expect(log.length).toBe(1);
      expect(log[0].success).toBe(false);
    });

    it('should handle directory creation errors', async () => {
      // Test with an invalid path that would cause an error
      const invalidPath = '/invalid/permission/path/that/should/fail';
      
      await expect(
        fileSystemService.createDirectory(invalidPath, { recursive: false })
      ).rejects.toThrow();
    });
  });
});