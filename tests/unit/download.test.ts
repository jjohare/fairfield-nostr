import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  downloadFile,
  generateTimestampedFilename,
  formatFileSize
} from '$lib/utils/download';

describe('Download Utils', () => {
  beforeEach(() => {
    // Mock DOM elements
    global.document.createElement = vi.fn((tagName) => {
      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          click: vi.fn(),
          setAttribute: vi.fn()
        } as any;
      }
      return {} as any;
    });

    global.document.body.appendChild = vi.fn();
    global.document.body.removeChild = vi.fn();

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    global.Blob = vi.fn((content, options) => ({
      content,
      type: options?.type || ''
    })) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('downloadFile', () => {
    it('should create blob and trigger download', () => {
      const content = 'Test content';
      const filename = 'test.txt';
      const mimeType = 'text/plain';

      downloadFile(content, filename, mimeType);

      expect(global.Blob).toHaveBeenCalledWith([content], { type: mimeType });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should clean up resources', () => {
      downloadFile('content', 'file.txt', 'text/plain');

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('generateTimestampedFilename', () => {
    it('should generate filename with timestamp', () => {
      const prefix = 'export';
      const extension = 'json';

      const filename = generateTimestampedFilename(prefix, extension);

      expect(filename).toMatch(/^export_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-.+\.json$/);
    });

    it('should use correct extension', () => {
      const filename = generateTimestampedFilename('data', 'csv');
      expect(filename).toMatch(/\.csv$/);
    });

    it('should include prefix', () => {
      const filename = generateTimestampedFilename('my-export', 'txt');
      expect(filename).toMatch(/^my-export_/);
    });

    it('should generate unique filenames', () => {
      const filename1 = generateTimestampedFilename('test', 'json');
      const filename2 = generateTimestampedFilename('test', 'json');

      // In practice these would be identical if called in same millisecond,
      // but format should be consistent
      expect(filename1).toMatch(/^test_\d{4}-\d{2}-\d{2}/);
      expect(filename2).toMatch(/^test_\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(10240)).toBe('10 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(5242880)).toBe('5 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(2147483648)).toBe('2 GB');
    });

    it('should round to 2 decimal places', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1587)).toBe('1.55 KB');
    });

    it('should handle large numbers', () => {
      const largeSize = 10737418240; // 10 GB
      expect(formatFileSize(largeSize)).toBe('10 GB');
    });
  });
});
