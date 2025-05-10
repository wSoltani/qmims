import * as fs from 'fs-extra';
import path from 'path';
import { config } from '../utils/config';
import {
  listTemplates,
  getTemplate,
  addTemplate,
  removeTemplate,
  getTemplateContent,
  initializeTemplates,
} from '../utils/templates';

// Mock dependencies
jest.mock('fs-extra', () => ({
  readFile: jest.fn(),
  pathExists: jest.fn(),
  ensureDirSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

jest.mock('os', () => ({
  homedir: jest.fn().mockReturnValue('/home/user'),
}));

jest.mock('../utils/config', () => ({
  config: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

// Mock process.platform
Object.defineProperty(process, 'platform', {
  value: 'linux',
  configurable: true,
});

describe('Templates Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset customTemplates mock
    (config.get as jest.Mock).mockReturnValue({});
  });

  describe('listTemplates', () => {
    test('should list built-in templates', () => {
      const templates = listTemplates();

      // Should have 5 built-in templates
      expect(templates.length).toBeGreaterThanOrEqual(5);
      expect(templates.some((t) => t.name === 'basic' && t.isBuiltIn)).toBe(true);
      expect(templates.some((t) => t.name === 'detailed' && t.isBuiltIn)).toBe(true);
      expect(templates.some((t) => t.name === 'minimal' && t.isBuiltIn)).toBe(true);
      expect(templates.some((t) => t.name === 'library' && t.isBuiltIn)).toBe(true);
      expect(templates.some((t) => t.name === 'service' && t.isBuiltIn)).toBe(true);
    });

    test('should include custom templates', () => {
      const mockCustomTemplates = {
        custom1: '/path/to/custom1.md',
        custom2: '/path/to/custom2.md',
      };
      (config.get as jest.Mock).mockReturnValue(mockCustomTemplates);

      const templates = listTemplates();

      // Should include custom templates
      expect(templates.some((t) => t.name === 'custom1' && !t.isBuiltIn)).toBe(true);
      expect(templates.some((t) => t.name === 'custom2' && !t.isBuiltIn)).toBe(true);

      // Should still include built-in templates
      expect(templates.some((t) => t.name === 'basic' && t.isBuiltIn)).toBe(true);
    });

    test('should handle empty custom templates', () => {
      (config.get as jest.Mock).mockReturnValue(null);

      const templates = listTemplates();

      // Should only have built-in templates
      expect(templates.length).toBeGreaterThanOrEqual(5);
      expect(templates.every((t) => t.isBuiltIn)).toBe(true);
    });
  });

  describe('getTemplate', () => {
    test('should get a built-in template by name', () => {
      const template = getTemplate('basic');

      expect(template).toBeDefined();
      expect(template?.name).toBe('basic');
      expect(template?.isBuiltIn).toBe(true);
    });

    test('should get a custom template by name', () => {
      const mockCustomTemplates = {
        custom1: '/path/to/custom1.md',
      };
      (config.get as jest.Mock).mockReturnValue(mockCustomTemplates);

      const template = getTemplate('custom1');

      expect(template).toBeDefined();
      expect(template?.name).toBe('custom1');
      expect(template?.path).toBe('/path/to/custom1.md');
      expect(template?.isBuiltIn).toBe(false);
    });

    test('should return undefined for non-existent template', () => {
      const template = getTemplate('non-existent');

      expect(template).toBeUndefined();
    });
  });

  describe('addTemplate', () => {
    test('should add a new custom template', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (config.get as jest.Mock).mockReturnValue({});

      await addTemplate('newTemplate', '/path/to/template.md');

      expect(fs.pathExists).toHaveBeenCalledWith('/path/to/template.md');
      expect(config.set).toHaveBeenCalledWith('customTemplates', {
        newTemplate: '/path/to/template.md',
      });
    });

    test('should throw error if template name already exists', async () => {
      // Mock a built-in template

      await expect(addTemplate('basic', '/path/to/template.md')).rejects.toThrow(
        "Template with name 'basic' already exists",
      );

      expect(config.set).not.toHaveBeenCalled();
    });

    test('should throw error if source file does not exist', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);

      await expect(addTemplate('newTemplate', '/path/to/non-existent.md')).rejects.toThrow(
        "Template source file '/path/to/non-existent.md' does not exist",
      );

      expect(config.set).not.toHaveBeenCalled();
    });

    test('should add to existing custom templates', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      const existingTemplates = {
        existing: '/path/to/existing.md',
      };
      (config.get as jest.Mock).mockReturnValue(existingTemplates);

      await addTemplate('newTemplate', '/path/to/template.md');

      expect(config.set).toHaveBeenCalledWith('customTemplates', {
        existing: '/path/to/existing.md',
        newTemplate: '/path/to/template.md',
      });
    });
  });

  describe('removeTemplate', () => {
    test('should remove a custom template', () => {
      const mockCustomTemplates = {
        custom1: '/path/to/custom1.md',
        custom2: '/path/to/custom2.md',
      };
      (config.get as jest.Mock).mockReturnValue(mockCustomTemplates);

      removeTemplate('custom1');

      expect(config.set).toHaveBeenCalledWith('customTemplates', {
        custom2: '/path/to/custom2.md',
      });
    });

    test('should throw error if template does not exist', () => {
      expect(() => removeTemplate('non-existent')).toThrow(
        "Template 'non-existent' does not exist",
      );

      expect(config.set).not.toHaveBeenCalled();
    });

    test('should throw error if trying to remove a built-in template', () => {
      expect(() => removeTemplate('basic')).toThrow("Cannot remove built-in template 'basic'");

      expect(config.set).not.toHaveBeenCalled();
    });
  });

  describe('getTemplateContent', () => {
    test('should get content of a template', async () => {
      const mockContent = '# Template Content';
      (fs.readFile as jest.Mock).mockResolvedValue(mockContent);

      const content = await getTemplateContent('basic');

      expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining('basic.md'), 'utf-8');
      expect(content).toBe(mockContent);
    });

    test('should throw error if template does not exist', async () => {
      await expect(getTemplateContent('non-existent')).rejects.toThrow(
        "Template 'non-existent' does not exist",
      );

      expect(fs.readFile).not.toHaveBeenCalled();
    });

    test('should throw error if reading template fails', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Read error'));

      await expect(getTemplateContent('basic')).rejects.toThrow(
        "Failed to read template 'basic': Error: Read error",
      );
    });
  });

  describe('initializeTemplates', () => {
    test('should ensure custom templates directory exists', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);

      await initializeTemplates();

      expect(fs.ensureDirSync).toHaveBeenCalled();
      expect(fs.pathExists).toHaveBeenCalledTimes(5); // Once for each built-in template
    });

    test('should verify built-in templates are accessible', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);

      await initializeTemplates();

      // Should check each built-in template
      expect(fs.pathExists).toHaveBeenCalledTimes(5);
    });
  });

  describe('Platform-specific paths', () => {
    test('should use home directory path on Linux', () => {
      // Clear previous calls to path.join
      jest.clearAllMocks();

      // Ensure platform is set to linux
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });

      // Call initializeTemplates which will trigger the internal getCustomTemplatesPath
      initializeTemplates();

      // Now we can check if path.join was called with the right arguments
      expect(path.join).toHaveBeenCalledWith('/home/user', '.config', 'qmims', 'templates');
    });
  });
});
