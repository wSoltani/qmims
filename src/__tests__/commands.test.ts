import yargs from 'yargs';
import * as generateCommand from '../commands/generate';
import * as editCommand from '../commands/edit';
import * as configCommand from '../commands/config';
import * as templatesCommand from '../commands/templates';
import { checkQCli } from '../utils/q-cli';
import { findReadmeFile, readMarkdownFile, parseInstructions } from '../utils/markdown';
import { listTemplates, getTemplate, getTemplateContent } from '../utils/templates';
import { config } from '../utils/config';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Mock os module
jest.mock('os', () => ({
  platform: jest.fn().mockReturnValue('linux'),
  EOL: '\n',
  release: jest.fn().mockReturnValue('1.0.0'),
  type: jest.fn().mockReturnValue('Linux'),
  tmpdir: jest.fn().mockReturnValue('/tmp')
}));

// Mock dependencies
jest.mock('../utils/q-cli', () => {
  const QChatProcessMock = jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    sendMessage: jest.fn(),
    addContext: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    terminate: jest.fn(),
    executeCommand: jest.fn().mockResolvedValue({ stdout: 'Command executed', stderr: '' }),
  }));

  return {
    checkQCli: jest.fn(),
    getQCliInstallInstructions: jest.fn().mockReturnValue('Mock instructions'),
    QChatProcess: QChatProcessMock,
  };
});

// Mock Logger - make it use the mocked console methods
jest.mock('../utils/logger', () => {
  return {
    Logger: jest.fn().mockImplementation(() => ({
      debug: jest.fn(msg => console.log(msg)),
      info: jest.fn(msg => console.log(msg)),
      warn: jest.fn(msg => console.warn(msg)),
      error: jest.fn(msg => console.error(msg)),
      success: jest.fn(msg => console.log(msg)),
      setVerbose: jest.fn(),
      setLevel: jest.fn(),
      getLogBuffer: jest.fn().mockReturnValue([]),
      clearLogBuffer: jest.fn()
    })),
    LogLevel: {
      SILENT: 0,
      ERROR: 1,
      WARN: 2,
      INFO: 3,
      DEBUG: 4
    }
  };
});

jest.mock('../utils/markdown', () => ({
  findReadmeFile: jest.fn(),
  readMarkdownFile: jest.fn(),
  writeMarkdownFile: jest.fn(),
  parseInstructions: jest.fn().mockReturnValue([]),
  extractTargetContent: jest.fn(),
  createReadmeFile: jest.fn(),
}));

jest.mock('../utils/templates', () => ({
  listTemplates: jest.fn(),
  getTemplate: jest.fn(),
  getTemplateContent: jest.fn(),
  addTemplate: jest.fn(),
  removeTemplate: jest.fn(),
  initializeTemplates: jest.fn(),
}));

jest.mock('../utils/config', () => ({
  config: {
    get: jest.fn(),
    set: jest.fn(),
  },
  getConfig: jest.fn(),
  setConfig: jest.fn(),
  deleteConfig: jest.fn(),
  listConfig: jest.fn(),
}));

jest.mock('fs-extra', () => ({
  existsSync: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  pathExists: jest.fn(),
  readdir: jest.fn().mockResolvedValue(['README.md']),
}));

// Mock prompts
jest.mock('prompts', () => jest.fn().mockResolvedValue({ approve: true, overwrite: true }));

describe('CLI Commands', () => {
  // Mock exit
  const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`Process.exit(${code})`);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    
    // Reset process.exit mock
    mockExit.mockClear();
    
    // Set default mock values
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (checkQCli as jest.Mock).mockResolvedValue(true);
    (parseInstructions as jest.Mock).mockReturnValue([{ instruction: 'Test instruction', lineNumber: 1 }]);
  });

  afterAll(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    mockExit.mockRestore();
  });

  describe('generate command - basic checks', () => {
    test('should check if project directory exists', async () => {
      // Mock fs.existsSync to return false
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Call handler with minimal args
      await expect(
        generateCommand.handler({
          path: '/non-existent',
          _: ['generate'],
          $0: 'qmims',
        }),
      ).rejects.toThrow('Process.exit(1)');

      expect(fs.existsSync).toHaveBeenCalledWith(path.resolve('/non-existent'));
      expect(console.error).toHaveBeenCalled();
    });

    test('should list templates when --list-available-templates is specified', async () => {
      // Mock fs.existsSync to return true
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock listTemplates to return some templates
      (listTemplates as jest.Mock).mockReturnValue([
        { name: 'basic', isBuiltIn: true },
        { name: 'detailed', isBuiltIn: true },
        { name: 'custom', isBuiltIn: false },
      ]);

      // Call handler with list-available-templates flag
      await generateCommand.handler({
        path: '.',
        listAvailableTemplates: true,
        _: ['generate'],
        $0: 'qmims',
      });

      expect(listTemplates).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
    });

    test('should check if Amazon Q CLI is available', async () => {
      // Mock fs.existsSync to return true
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock checkQCli to return false
      (checkQCli as jest.Mock).mockResolvedValue(false);

      // Call handler with minimal args
      await expect(
        generateCommand.handler({
          path: '.',
          _: ['generate'],
          $0: 'qmims',
        }),
      ).rejects.toThrow('Process.exit(1)');

      expect(checkQCli).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle dry run mode', async () => {
      // Mock fs.existsSync to return true
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Call handler with dry-run flag
      await generateCommand.handler({
        path: '.',
        dryRun: true,
        _: ['generate'],
        $0: 'qmims',
      });

      // Should not check Q CLI in dry run mode
      expect(checkQCli).not.toHaveBeenCalled();

      // Should output dry run info
      expect(console.log).toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
    });
  });

  describe('generate command - advanced functionality', () => {
    test('should handle invalid mode', async () => {
      // Mock fs.existsSync to return true
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock checkQCli to return true
      (checkQCli as jest.Mock).mockResolvedValue(true);

      // Call handler with invalid mode
      await expect(
        generateCommand.handler({
          path: '.',
          mode: 'invalid',
          _: ['generate'],
          $0: 'qmims',
        }),
      ).rejects.toThrow('Process.exit(1)');

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Invalid mode 'invalid'"));
    });

    test('should handle file exists and user cancels overwrite', async () => {
      // Mock fs.existsSync to return true for both project path and output file
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock checkQCli to return true
      (checkQCli as jest.Mock).mockResolvedValue(true);

      // Mock prompts to return { overwrite: false }
      const prompts = require('prompts');
      prompts.mockResolvedValueOnce({ overwrite: false });

      // Call handler with default args
      await generateCommand.handler({
        path: '.',
        _: ['generate'],
        $0: 'qmims',
      });

      // The warning is now handled by the Logger mock, not console.log
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Generation cancelled'));
    });

    test('should handle template mode with valid template', async () => {
      // Mock fs.existsSync to return true for project path and false for output file
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        // Return true for project path, false for output file
        return !path.includes('README.md');
      });

      // Mock checkQCli to return true
      (checkQCli as jest.Mock).mockResolvedValue(true);

      // Mock getTemplate to return a template
      (getTemplate as jest.Mock).mockReturnValue({ name: 'basic', path: 'templates/basic.md' });

      // Mock getTemplateContent to return content
      (getTemplateContent as jest.Mock).mockResolvedValue('# Basic Template');

      // Mock writeMarkdownFile
      const writeMarkdownFile = require('../utils/markdown').writeMarkdownFile;
      writeMarkdownFile.mockResolvedValue(undefined);

      // Call handler with template mode
      await generateCommand.handler({
        path: '.',
        mode: 'template',
        _: ['generate'],
        $0: 'qmims',
      });

      expect(getTemplate).toHaveBeenCalled();
      expect(getTemplateContent).toHaveBeenCalled();
      expect(writeMarkdownFile).toHaveBeenCalled();
    });

    test('should handle template not found', async () => {
      // Mock fs.existsSync to return true for project path
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock checkQCli to return true
      (checkQCli as jest.Mock).mockResolvedValue(true);

      // Mock getTemplate to return null
      (getTemplate as jest.Mock).mockReturnValue(null);

      // Call handler with template mode and non-existent template
      await expect(
        generateCommand.handler({
          path: '.',
          mode: 'template:non-existent',
          _: ['generate'],
          $0: 'qmims',
        }),
      ).rejects.toThrow();
    });

    test('should handle auto mode', async () => {
      // Mock fs.existsSync to return true for project path and false for output file
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        // Return true for project path, false for output file
        return !path.includes('README.md');
      });

      // Mock checkQCli to return true
      (checkQCli as jest.Mock).mockResolvedValue(true);

      // Mock writeMarkdownFile
      const writeMarkdownFile = require('../utils/markdown').writeMarkdownFile;
      writeMarkdownFile.mockResolvedValue(undefined);

      // Mock QChatProcess methods
      const QChatProcess = require('../utils/q-cli').QChatProcess;
      const mockQChatInstance = {
        start: jest.fn(),
        sendMessage: jest.fn(),
        addContext: jest.fn(),
        stop: jest.fn(),
        checkCompletion: jest.fn().mockReturnValue(true),
      };
      QChatProcess.mockImplementation(() => mockQChatInstance);

      // Mock setInterval and clearInterval
      const originalSetInterval = global.setInterval;
      const originalClearInterval = global.clearInterval;
      const mockSetInterval = jest.fn().mockReturnValue(123);
      const mockClearInterval = jest.fn();
      global.setInterval = mockSetInterval;
      global.clearInterval = mockClearInterval;

      // Mock process.once to capture SIGINT handler
      const originalProcessOnce = process.once;
      const mockProcessOnce = jest.fn();
      process.once = mockProcessOnce;

      try {
        // Call handler with auto mode
        await generateCommand.handler({
          path: '.',
          mode: 'auto',
          _: ['generate'],
          $0: 'qmims',
        });

        expect(writeMarkdownFile).toHaveBeenCalled();
        expect(mockQChatInstance.start).toHaveBeenCalled();
        expect(mockQChatInstance.sendMessage).toHaveBeenCalled();
        expect(mockQChatInstance.addContext).toHaveBeenCalled();
        expect(mockSetInterval).toHaveBeenCalled();
        
        // Manually trigger the interval callback to test completion
        const intervalCallback = mockSetInterval.mock.calls[0][0];
        intervalCallback();
        
        expect(mockClearInterval).toHaveBeenCalled();
        expect(mockProcessOnce).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      } finally {
        // Restore globals
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
        process.once = originalProcessOnce;
      }
    });

    test('should handle instruct mode', async () => {
      // Mock fs.existsSync to return true for project path and false for output file
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        // Return true for project path, false for output file
        return !path.includes('README.md');
      });

      // Mock checkQCli to return true
      (checkQCli as jest.Mock).mockResolvedValue(true);

      // Mock findReadmeFile
      const findReadmeFile = require('../utils/markdown').findReadmeFile;
      findReadmeFile.mockResolvedValue('/path/to/README.md');

      // Mock readMarkdownFile
      const readMarkdownFile = require('../utils/markdown').readMarkdownFile;
      readMarkdownFile.mockResolvedValue('# Test README');

      // Mock QChatProcess methods
      const QChatProcess = require('../utils/q-cli').QChatProcess;
      const mockQChatInstance = {
        start: jest.fn(),
        sendMessage: jest.fn(),
        addContext: jest.fn(),
        stop: jest.fn(),
        checkCompletion: jest.fn().mockReturnValue(true),
      };
      QChatProcess.mockImplementation(() => mockQChatInstance);

      // Mock setInterval and clearInterval
      const originalSetInterval = global.setInterval;
      const originalClearInterval = global.clearInterval;
      const mockSetInterval = jest.fn().mockReturnValue(123);
      const mockClearInterval = jest.fn();
      global.setInterval = mockSetInterval;
      global.clearInterval = mockClearInterval;

      // Mock process.once to capture SIGINT handler
      const originalProcessOnce = process.once;
      const mockProcessOnce = jest.fn();
      process.once = mockProcessOnce;

      try {
        // Call handler with instruct mode
        await generateCommand.handler({
          path: '.',
          mode: 'instruct',
          _: ['generate'],
          $0: 'qmims',
        });

        expect(findReadmeFile).toHaveBeenCalled();
        expect(mockQChatInstance.start).toHaveBeenCalled();
        expect(mockQChatInstance.addContext).toHaveBeenCalled();
        expect(mockQChatInstance.sendMessage).toHaveBeenCalled();
        expect(mockSetInterval).toHaveBeenCalled();
        
        // Manually trigger the interval callback to test completion
        const intervalCallback = mockSetInterval.mock.calls[0][0];
        intervalCallback();
        
        expect(mockClearInterval).toHaveBeenCalled();
        expect(mockProcessOnce).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      } finally {
        // Restore globals
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
        process.once = originalProcessOnce;
      }
    });
  });

  describe('edit command', () => {
    test('should check if file exists', async () => {
      // Mock fs.existsSync to return false
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Mock findReadmeFile to return null
      (findReadmeFile as jest.Mock).mockResolvedValue(null);

      // Call handler with non-existent file
      await expect(
        editCommand.handler({
          file: '/non-existent.md',
          _: ['edit'],
          $0: 'qmims',
        }),
      ).rejects.toThrow('Process.exit(1)');

      expect(fs.existsSync).toHaveBeenCalled();
      expect(findReadmeFile).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test('should check if Amazon Q CLI is available', async () => {
      // Mock fs.existsSync to return true
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock checkQCli to return false
      (checkQCli as jest.Mock).mockResolvedValue(false);
      
      // Mock readMarkdownFile to return content
      (readMarkdownFile as jest.Mock).mockResolvedValue('# Test');

      // Call handler with minimal args
      await expect(
        editCommand.handler({
          file: 'README.md',
          _: ['edit'],
          $0: 'qmims',
        }),
      ).rejects.toThrow('Process.exit(1)');

      expect(checkQCli).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test('should warn if no instructions found', async () => {
      // Mock fs.existsSync to return true
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock readMarkdownFile to return content
      (readMarkdownFile as jest.Mock).mockResolvedValue('# Test');

      // Mock parseInstructions to return empty array
      (parseInstructions as jest.Mock).mockReturnValue([]);

      // Call handler with minimal args
      await editCommand.handler({
        file: 'README.md',
        dryRun: true, // Use dry run to avoid Q CLI check
        _: ['edit'],
        $0: 'qmims',
      });

      expect(readMarkdownFile).toHaveBeenCalled();
      expect(parseInstructions).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('No embedded instructions found'),
      );
    });

    test('should handle dry run mode', async () => {
      // Mock fs.existsSync to return true
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock readMarkdownFile to return content
      (readMarkdownFile as jest.Mock).mockResolvedValue(
        '# Test\n\n<!-- qmims: Test instruction -->',
      );

      // Mock parseInstructions to return instructions
      (parseInstructions as jest.Mock).mockReturnValue([{ instruction: 'Test instruction', lineNumber: 2 }]);

      // Call handler with dry-run flag
      await editCommand.handler({
        file: 'README.md',
        dryRun: true,
        _: ['edit'],
        $0: 'qmims',
      });

      // Should not check Q CLI in dry run mode
      expect(checkQCli).not.toHaveBeenCalled();

      // Should output dry run info
      expect(console.log).toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
    });
  });

  describe('config command', () => {
    test('should handle get command', async () => {
      // Mock getConfig to return a value
      const getConfig = require('../utils/config').getConfig;
      getConfig.mockReturnValue('test-value');

      // Call handler with get command
      await configCommand.handler({
        _: ['config', 'get'],
        key: 'test.key',
        $0: 'qmims',
      });

      expect(getConfig).toHaveBeenCalledWith('test.key');
      expect(console.log).toHaveBeenCalledWith('test-value');
    });

    test('should handle set command', async () => {
      // Mock setConfig
      const setConfig = require('../utils/config').setConfig;

      // Call handler with set command
      await configCommand.handler({
        _: ['config', 'set'],
        key: 'test.key',
        value: 'test-value',
        $0: 'qmims',
      });

      expect(setConfig).toHaveBeenCalledWith('test.key', 'test-value');
      expect(console.log).toHaveBeenCalled();
    });

    test('should handle delete command', async () => {
      // Mock getConfig and deleteConfig
      const getConfig = require('../utils/config').getConfig;
      const deleteConfig = require('../utils/config').deleteConfig;
      getConfig.mockReturnValue('test-value');

      // Call handler with delete command
      await configCommand.handler({
        _: ['config', 'delete'],
        key: 'test.key',
        $0: 'qmims',
      });

      expect(deleteConfig).toHaveBeenCalledWith('test.key');
      expect(console.log).toHaveBeenCalled();
    });

    test('should handle list command', async () => {
      // Mock listConfig to return values
      const listConfig = require('../utils/config').listConfig;
      listConfig.mockReturnValue({
        'test.key1': 'value1',
        'test.key2': 'value2',
      });

      // Call handler with list command
      await configCommand.handler({
        _: ['config', 'list'],
        $0: 'qmims',
      });

      expect(listConfig).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    test('should handle unknown command', async () => {
      // Call handler with unknown command
      await expect(
        configCommand.handler({
          _: ['config', 'unknown'],
          $0: 'qmims',
        }),
      ).rejects.toThrow('Process.exit(1)');

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('templates command', () => {
    test('should handle list command', async () => {
      // Mock listTemplates to return templates
      (listTemplates as jest.Mock).mockReturnValue([
        { name: 'basic', isBuiltIn: true },
        { name: 'custom', isBuiltIn: false, path: '/path/to/custom.md' },
      ]);

      // Call handler with list command
      await templatesCommand.handler({
        _: ['templates', 'list'],
        $0: 'qmims',
      });

      expect(listTemplates).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    test('should handle add command', async () => {
      // Call handler with add command
      await templatesCommand.handler({
        _: ['templates', 'add'],
        templateName: 'new-template',
        templatePath: '/path/to/template.md',
        $0: 'qmims',
      });

      expect(require('../utils/templates').addTemplate).toHaveBeenCalledWith(
        'new-template',
        expect.any(String), // Resolved path
      );
      expect(console.log).toHaveBeenCalled();
    });

    test('should handle remove command', async () => {
      // Call handler with remove command
      await templatesCommand.handler({
        _: ['templates', 'remove'],
        templateName: 'custom-template',
        $0: 'qmims',
      });

      expect(require('../utils/templates').removeTemplate).toHaveBeenCalledWith('custom-template');
      expect(console.log).toHaveBeenCalled();
    });

    test('should handle show command', async () => {
      // Mock getTemplate and getTemplateContent
      (getTemplate as jest.Mock).mockReturnValue({
        name: 'basic',
        isBuiltIn: true,
        path: '/path/to/basic.md',
      });

      (getTemplateContent as jest.Mock).mockResolvedValue('# Template Content');

      // Call handler with show command
      await templatesCommand.handler({
        _: ['templates', 'show'],
        templateName: 'basic',
        $0: 'qmims',
      });

      expect(getTemplate).toHaveBeenCalledWith('basic');
      expect(getTemplateContent).toHaveBeenCalledWith('basic');
      expect(console.log).toHaveBeenCalled();
    });

    test('should handle unknown command', async () => {
      // Call handler with unknown command
      await expect(
        templatesCommand.handler({
          _: ['templates', 'unknown'],
          $0: 'qmims',
        }),
      ).rejects.toThrow('Process.exit(1)');

      expect(console.error).toHaveBeenCalled();
    });
  });
});