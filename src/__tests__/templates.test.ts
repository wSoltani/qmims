import path from 'path';
import fs from 'fs-extra';
import { 
  listTemplates, 
  getTemplate, 
  addTemplate, 
  removeTemplate, 
  getTemplateContent,
  initializeTemplates
} from '../utils/templates';
import { config } from '../utils/config';

// Mock fs-extra
jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  readFile: jest.fn(),
  pathExists: jest.fn(),
}));

// Mock config
jest.mock('../utils/config', () => {
  const mockStore: Record<string, any> = {};
  return {
    config: {
      get: jest.fn((key) => {
        if (key === 'customTemplates') {
          return mockStore.customTemplates || {};
        }
        return mockStore[key];
      }),
      set: jest.fn((key, value) => {
        mockStore[key] = value;
      }),
      store: mockStore,
    },
  };
});

describe('Templates Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock store
    (config.get as jest.Mock).mockImplementation((key) => {
      if (key === 'customTemplates') {
        return {};
      }
      return undefined;
    });
  });

  describe('listTemplates', () => {
    test('should list built-in templates', () => {
      const templates = listTemplates();
      
      // Should have at least the 5 built-in templates
      expect(templates.length).toBeGreaterThanOrEqual(5);
      
      // Check for specific built-in templates
      const templateNames = templates.map(t => t.name);
      expect(templateNames).toContain('basic');
      expect(templateNames).toContain('detailed');
      expect(templateNames).toContain('minimal');
      expect(templateNames).toContain('library');
      expect(templateNames).toContain('service');
      
      // All should be marked as built-in
      templates.forEach(template => {
        expect(template.isBuiltIn).toBe(true);
      });
    });

    test('should include custom templates if available', () => {
      // Mock custom templates in config
      const mockCustomTemplates = {
        'custom1': '/path/to/custom1.md',
        'custom2': '/path/to/custom2.md',
      };
      
      (config.get as jest.Mock).mockImplementation((key) => {
        if (key === 'customTemplates') {
          return mockCustomTemplates;
        }
        return undefined;
      });
      
      const templates = listTemplates();
      
      // Should include the custom templates
      const customTemplates = templates.filter(t => !t.isBuiltIn);
      expect(customTemplates.length).toBe(2);
      
      // Check custom template properties
      expect(customTemplates[0].name).toBe('custom1');
      expect(customTemplates[0].path).toBe('/path/to/custom1.md');
      expect(customTemplates[0].isBuiltIn).toBe(false);
      
      expect(customTemplates[1].name).toBe('custom2');
      expect(customTemplates[1].path).toBe('/path/to/custom2.md');
      expect(customTemplates[1].isBuiltIn).toBe(false);
    });
  });

  describe('getTemplate', () => {
    test('should return a built-in template by name', () => {
      const template = getTemplate('basic');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('basic');
      expect(template?.isBuiltIn).toBe(true);
    });

    test('should return a custom template by name', () => {
      // Mock custom templates in config
      const mockCustomTemplates = {
        'custom1': '/path/to/custom1.md',
      };
      
      (config.get as jest.Mock).mockImplementation((key) => {
        if (key === 'customTemplates') {
          return mockCustomTemplates;
        }
        return undefined;
      });
      
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
    test('should add a custom template', async () => {
      const templateName = 'new-template';
      const templatePath = '/path/to/new-template.md';
      
      // Mock fs.pathExists to return true (file exists)
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      
      await addTemplate(templateName, templatePath);
      
      // Should update the config
      expect(config.set).toHaveBeenCalledWith('customTemplates', {
        [templateName]: templatePath,
      });
    });

    test('should throw error if template name already exists', async () => {
      // Mock existing template
      (config.get as jest.Mock).mockImplementation((key) => {
        if (key === 'customTemplates') {
          return { 'existing': '/path/to/existing.md' };
        }
        return undefined;
      });
      
      await expect(addTemplate('existing', '/path/to/new.md'))
        .rejects.toThrow(`Template with name 'existing' already exists`);
      
      // Config should not be updated
      expect(config.set).not.toHaveBeenCalled();
    });

    test('should throw error if template file does not exist', async () => {
      // Mock fs.pathExists to return false (file doesn't exist)
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      
      await expect(addTemplate('new-template', '/path/to/non-existent.md'))
        .rejects.toThrow(`Template source file '/path/to/non-existent.md' does not exist`);
      
      // Config should not be updated
      expect(config.set).not.toHaveBeenCalled();
    });
  });

  describe('removeTemplate', () => {
    test('should remove a custom template', () => {
      // Mock existing custom templates
      const mockCustomTemplates = {
        'custom1': '/path/to/custom1.md',
        'custom2': '/path/to/custom2.md',
      };
      
      (config.get as jest.Mock).mockImplementation((key) => {
        if (key === 'customTemplates') {
          return mockCustomTemplates;
        }
        return undefined;
      });
      
      removeTemplate('custom1');
      
      // Should update the config with the template removed
      expect(config.set).toHaveBeenCalledWith('customTemplates', {
        'custom2': '/path/to/custom2.md',
      });
    });

    test('should throw error if template does not exist', () => {
      expect(() => removeTemplate('non-existent'))
        .toThrow(`Template 'non-existent' does not exist`);
      
      // Config should not be updated
      expect(config.set).not.toHaveBeenCalled();
    });

    test('should throw error if trying to remove a built-in template', () => {
      expect(() => removeTemplate('basic'))
        .toThrow(`Cannot remove built-in template 'basic'`);
      
      // Config should not be updated
      expect(config.set).not.toHaveBeenCalled();
    });
  });

  describe('getTemplateContent', () => {
    test('should read content of a template', async () => {
      const mockContent = '# Template Content';
      
      // Mock fs.readFile to return content
      (fs.readFile as jest.Mock).mockResolvedValue(mockContent);
      
      const content = await getTemplateContent('basic');
      
      expect(content).toBe(mockContent);
      expect(fs.readFile).toHaveBeenCalled();
    });

    test('should throw error if template does not exist', async () => {
      await expect(getTemplateContent('non-existent'))
        .rejects.toThrow(`Template 'non-existent' does not exist`);
      
      // Should not try to read file
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    test('should throw error if reading template fails', async () => {
      // Mock fs.readFile to throw error
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Read error'));
      
      await expect(getTemplateContent('basic'))
        .rejects.toThrow(`Failed to read template 'basic': Error: Read error`);
    });
  });

  describe('initializeTemplates', () => {
    test('should ensure templates directory exists', async () => {
      await initializeTemplates();
      
      // Should ensure directory exists
      expect(fs.ensureDirSync).toHaveBeenCalled();
    });
  });
});
