import * as configCommand from '../commands/config';
import * as editCommand from '../commands/edit';
import * as generateCommand from '../commands/generate';
import * as templatesCommand from '../commands/templates';

jest.mock('../utils/config');
jest.mock('../utils/logger');
jest.mock('../utils/kiro-cli');
jest.mock('../utils/markdown');
jest.mock('../utils/templates');
jest.mock('fs-extra', () => ({
  existsSync: jest.fn(),
}));

jest.mock('prompts', () => {
  return jest.fn().mockResolvedValue({
    overwrite: true,
    value: true,
  });
});

describe('Command Modules', () => {
  describe('Config Command', () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      success: jest.fn(),
      debug: jest.fn(),
    };

    const mockConfig = {
      user: { name: 'Test User', email: 'test@example.com' },
      defaults: { mode: 'auto', outputFileName: 'README.md' },
      q: { autoApproveEdits: true },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit);

      jest.requireMock('../utils/logger').Logger.mockImplementation(() => mockLogger);

      jest.requireMock('../utils/config').listConfig.mockReturnValue(mockConfig);
      jest.requireMock('../utils/config').getConfig.mockImplementation((key: string) => {
        if (key === 'user.name') return 'Test User';
        if (key === 'user.email') return 'test@example.com';
        return undefined;
      });
      jest.requireMock('../utils/config').setConfig.mockReturnValue(undefined);
      jest.requireMock('../utils/config').deleteConfig.mockReturnValue(undefined);
    });

    test('should define command, description and builder', () => {
      expect(configCommand.command).toBe('config');
      expect(configCommand.desc).toBeDefined();
      expect(configCommand.builder).toBeDefined();
    });

    test('should handle list action', async () => {
      await configCommand.handler({ action: 'list', verbose: false, _: [], $0: '' });

      expect(jest.requireMock('../utils/logger').Logger).toHaveBeenCalledWith(false);
      expect(jest.requireMock('../utils/config').listConfig).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalled();
    });

    test('should handle get action', async () => {
      await configCommand.handler({
        action: 'get',
        key: 'user.name',
        verbose: false,
        _: [],
        $0: '',
      });

      expect(jest.requireMock('../utils/config').getConfig).toHaveBeenCalledWith('user.name');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Test User'));
    });

    test('should handle set action', async () => {
      await configCommand.handler({
        action: 'set',
        key: 'user.name',
        value: 'New User',
        verbose: false,
        _: [],
        $0: '',
      });

      expect(jest.requireMock('../utils/config').setConfig).toHaveBeenCalledWith(
        'user.name',
        'New User',
      );
      expect(mockLogger.success).toHaveBeenCalledWith(expect.stringContaining('user.name'));
    });

    test('should handle delete action', async () => {
      await configCommand.handler({
        action: 'delete',
        key: 'user.name',
        verbose: false,
        _: [],
        $0: '',
      });

      expect(jest.requireMock('../utils/config').deleteConfig).toHaveBeenCalledWith('user.name');
      expect(mockLogger.success).toHaveBeenCalledWith(expect.stringContaining('user.name'));
    });

    test('should handle unknown action', async () => {
      await configCommand.handler({ action: 'unknown', verbose: false, _: [], $0: '' });

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown action'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Edit Command', () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      success: jest.fn(),
      debug: jest.fn(),
    };

    const mockKiroChatProcess = {
      start: jest.fn(),
      sendMessage: jest.fn(),
      stop: jest.fn().mockResolvedValue(undefined),
      terminate: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit);
      jest.spyOn(process, 'once').mockImplementation((() => process) as typeof process.once);
      jest
        .spyOn(process, 'removeListener')
        .mockImplementation((() => process) as typeof process.removeListener);

      jest.requireMock('../utils/logger').Logger.mockImplementation(() => mockLogger);

      jest.requireMock('fs-extra').existsSync.mockReturnValue(true);

      jest
        .requireMock('../utils/kiro-cli')
        .KiroChatProcess.mockImplementation(() => mockKiroChatProcess);

      jest.requireMock('../utils/kiro-cli').checkKiroCli.mockResolvedValue('ready');
      jest
        .requireMock('../utils/kiro-cli')
        .getKiroCliGuidance.mockReturnValue('Kiro CLI instructions');

      jest.requireMock('../utils/markdown').findReadmeFile.mockResolvedValue('README.md');
    });

    test('should define command, description and builder', () => {
      expect(editCommand.command).toBe('edit [file]');
      expect(editCommand.desc).toBeDefined();
      expect(editCommand.builder).toBeDefined();
    });

    test('should handle dry run mode', async () => {
      await editCommand.handler({ file: 'README.md', dryRun: true, verbose: false, _: [], $0: '' });

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('DRY RUN MODE'));
      expect(jest.requireMock('../utils/kiro-cli').checkKiroCli).not.toHaveBeenCalled();
    });

    test('should show requested and target file paths in dry run fallback case', async () => {
      jest.requireMock('fs-extra').existsSync.mockReturnValueOnce(false);
      jest
        .requireMock('../utils/markdown')
        .findReadmeFile.mockResolvedValueOnce('docs/FALLBACK_README.md');

      await editCommand.handler({
        file: 'missing.md',
        dryRun: true,
        verbose: false,
        _: [],
        $0: '',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Requested file:'));
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('File to edit:'));
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('FALLBACK_README.md'));
      expect(jest.requireMock('../utils/kiro-cli').checkKiroCli).not.toHaveBeenCalled();
    });

    test('should handle file not found', async () => {
      jest.requireMock('fs-extra').existsSync.mockReturnValueOnce(false);
      jest.requireMock('../utils/markdown').findReadmeFile.mockResolvedValueOnce(null);

      await editCommand.handler({ file: 'non-existent.md', verbose: false, _: [], $0: '' });

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should handle Kiro CLI not installed', async () => {
      jest.requireMock('../utils/kiro-cli').checkKiroCli.mockResolvedValueOnce('not-installed');

      await editCommand.handler({ file: 'README.md', verbose: false, _: [], $0: '' });

      expect(jest.requireMock('../utils/kiro-cli').getKiroCliGuidance).toHaveBeenCalledWith(
        'not-installed',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('Kiro CLI instructions');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should handle Kiro CLI not authenticated', async () => {
      jest.requireMock('../utils/kiro-cli').checkKiroCli.mockResolvedValueOnce('not-authenticated');

      await editCommand.handler({ file: 'README.md', verbose: false, _: [], $0: '' });

      expect(jest.requireMock('../utils/kiro-cli').getKiroCliGuidance).toHaveBeenCalledWith(
        'not-authenticated',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('Kiro CLI instructions');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should start Kiro chat process and send message', async () => {
      await editCommand.handler({ file: 'README.md', verbose: false, _: [], $0: '' });

      expect(jest.requireMock('../utils/kiro-cli').checkKiroCli).toHaveBeenCalledWith(false);
      expect(jest.requireMock('../utils/kiro-cli').KiroChatProcess).toHaveBeenCalled();
      expect(mockKiroChatProcess.start).toHaveBeenCalled();
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('I need you to edit the Markdown file at'),
      );
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('README.md'),
      );
      expect(mockKiroChatProcess.stop).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith(expect.stringContaining('successfully'));
      expect(process.removeListener).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    test('should use discovered README fallback when requested file is missing', async () => {
      jest.requireMock('fs-extra').existsSync.mockReturnValueOnce(false);
      jest
        .requireMock('../utils/markdown')
        .findReadmeFile.mockResolvedValueOnce('docs/FALLBACK_README.md');

      await editCommand.handler({ file: 'missing.md', verbose: false, _: [], $0: '' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Using discovered README fallback'),
      );
      expect(jest.requireMock('../utils/kiro-cli').KiroChatProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: expect.stringContaining('docs'),
        }),
        expect.any(Object),
      );
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('FALLBACK_README.md'),
      );
      expect(mockKiroChatProcess.sendMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('missing.md'),
      );
      expect(mockKiroChatProcess.stop).toHaveBeenCalled();
    });

    test('should handle error during processing', async () => {
      mockKiroChatProcess.stop.mockRejectedValueOnce(new Error('Processing failed'));

      await editCommand.handler({ file: 'README.md', verbose: false, _: [], $0: '' });

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error processing'));
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(process.removeListener).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });

  describe('Generate Command', () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      success: jest.fn(),
      debug: jest.fn(),
    };

    const mockKiroChatProcess = {
      start: jest.fn(),
      sendMessage: jest.fn(),
      stop: jest.fn().mockResolvedValue(undefined),
      terminate: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit);
      jest.spyOn(process, 'once').mockImplementation((() => process) as typeof process.once);
      jest
        .spyOn(process, 'removeListener')
        .mockImplementation((() => process) as typeof process.removeListener);

      jest.requireMock('../utils/logger').Logger.mockImplementation(() => mockLogger);

      jest.requireMock('fs-extra').existsSync.mockReturnValue(true);

      jest
        .requireMock('../utils/kiro-cli')
        .KiroChatProcess.mockImplementation(() => mockKiroChatProcess);
      jest.requireMock('../utils/kiro-cli').checkKiroCli.mockResolvedValue('ready');
      jest
        .requireMock('../utils/kiro-cli')
        .getKiroCliGuidance.mockReturnValue('Kiro CLI instructions');

      jest.requireMock('../utils/config').config.get.mockImplementation((key: string) => {
        if (key === 'defaults.outputFileName') return 'README.md';
        if (key === 'defaults.mode') return 'auto';
        if (key === 'q.autoApproveEdits') return false;
        if (key === 'defaults.templateName') return 'basic';
        return undefined;
      });

      jest.requireMock('../utils/templates').listTemplates.mockReturnValue([
        { name: 'basic', isBuiltIn: true },
        { name: 'custom', isBuiltIn: false },
      ]);
      jest.requireMock('../utils/templates').getTemplate.mockReturnValue({
        name: 'basic',
        isBuiltIn: true,
      });
      jest
        .requireMock('../utils/templates')
        .getTemplateContent.mockResolvedValue('# Template README');
      jest.requireMock('../utils/markdown').writeMarkdownFile.mockResolvedValue(undefined);
      jest
        .requireMock('../utils/markdown')
        .readMarkdownFile.mockResolvedValue('# README\n\n<!-- qmims: Add installation steps -->');
      jest
        .requireMock('../utils/markdown')
        .parseInstructions.mockReturnValue([
          { instruction: 'Add installation steps', lineNumber: 3 },
        ]);
    });

    test('should define command, description and builder', () => {
      expect(generateCommand.command).toBe('generate [path]');
      expect(generateCommand.desc).toBeDefined();
      expect(generateCommand.builder).toBeDefined();
    });

    test('should handle dry run mode without checking Kiro CLI', async () => {
      await generateCommand.handler({ dryRun: true, verbose: false, _: [], $0: '' });

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('DRY RUN MODE'));
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Would start Kiro CLI chat session'),
      );
      expect(jest.requireMock('../utils/kiro-cli').checkKiroCli).not.toHaveBeenCalled();
    });

    test('should describe trust-all-tools as always enabled in dry run', async () => {
      await generateCommand.handler({ dryRun: true, verbose: false, _: [], $0: '' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Would run Kiro with trust-all-tools enabled'),
      );
    });

    test('should use config-driven auto-approve when yes is not provided', async () => {
      jest.requireMock('../utils/config').config.get.mockImplementation((key: string) => {
        if (key === 'defaults.outputFileName') return 'README.md';
        if (key === 'defaults.mode') return 'auto';
        if (key === 'q.autoApproveEdits') return true;
        if (key === 'defaults.templateName') return 'basic';
        return undefined;
      });

      const testArgv = generateCommand.builder({
        positional: jest.fn().mockReturnThis(),
        option: jest.fn().mockReturnThis(),
      } as never);

      expect(testArgv).toBeDefined();

      await generateCommand.handler({ mode: 'auto', verbose: false, _: [], $0: '' });

      expect(jest.requireMock('../utils/kiro-cli').KiroChatProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          autoApprove: true,
          verbose: false,
        }),
        expect.any(Object),
      );
    });

    test('should handle Kiro CLI not installed', async () => {
      jest.requireMock('../utils/kiro-cli').checkKiroCli.mockResolvedValueOnce('not-installed');

      await generateCommand.handler({ verbose: false, _: [], $0: '' });

      expect(jest.requireMock('../utils/kiro-cli').getKiroCliGuidance).toHaveBeenCalledWith(
        'not-installed',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('Kiro CLI instructions');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should handle Kiro CLI not authenticated', async () => {
      jest.requireMock('../utils/kiro-cli').checkKiroCli.mockResolvedValueOnce('not-authenticated');

      await generateCommand.handler({ verbose: false, _: [], $0: '' });

      expect(jest.requireMock('../utils/kiro-cli').getKiroCliGuidance).toHaveBeenCalledWith(
        'not-authenticated',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('Kiro CLI instructions');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should start Kiro chat process for auto mode', async () => {
      await generateCommand.handler({ mode: 'auto', verbose: false, _: [], $0: '' });

      expect(jest.requireMock('../utils/kiro-cli').checkKiroCli).toHaveBeenCalledWith(false);
      expect(jest.requireMock('../utils/kiro-cli').KiroChatProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          autoApprove: false,
          verbose: false,
        }),
        expect.any(Object),
      );
      expect(mockKiroChatProcess.start).toHaveBeenCalled();
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('Please analyze the project in the current working directory'),
      );
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('Write the complete final README content to'),
      );
      expect(mockKiroChatProcess.stop).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated README.md'),
      );
      expect(process.removeListener).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    test('should pass trust-enabled configuration when yes flag is set', async () => {
      await generateCommand.handler({ mode: 'auto', yes: true, verbose: false, _: [], $0: '' });

      expect(jest.requireMock('../utils/kiro-cli').KiroChatProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          autoApprove: true,
        }),
        expect.any(Object),
      );
    });

    test('should list available templates without checking Kiro CLI', async () => {
      await generateCommand.handler({
        mode: 'template',
        listAvailableTemplates: true,
        verbose: false,
        _: [],
        $0: '',
      });

      expect(jest.requireMock('../utils/templates').listTemplates).toHaveBeenCalled();
      expect(jest.requireMock('../utils/kiro-cli').checkKiroCli).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Available Templates'));
    });

    test('should start Kiro chat process for template mode', async () => {
      await generateCommand.handler({ mode: 'template:basic', verbose: false, _: [], $0: '' });

      expect(jest.requireMock('../utils/templates').getTemplateContent).toHaveBeenCalledWith(
        'basic',
      );
      expect(jest.requireMock('../utils/markdown').writeMarkdownFile).toHaveBeenCalledWith(
        expect.stringContaining('README.md'),
        '# Template README',
      );
      expect(mockKiroChatProcess.start).toHaveBeenCalled();
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('A README template has already been written to'),
      );
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('preserve the template structure'),
      );
      expect(mockKiroChatProcess.stop).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('Template filling completed successfully'),
      );
    });

    test('should combine all parsed instructions into one structured prompt', async () => {
      jest.requireMock('../utils/markdown').parseInstructions.mockReturnValue([
        { instruction: 'Add installation steps', lineNumber: 3 },
        {
          instruction: 'Document environment variables',
          lineNumber: 8,
          targetStart: 10,
          targetEnd: 14,
        },
      ]);

      await generateCommand.handler({
        mode: 'instruct:README.md',
        verbose: false,
        _: [],
        $0: '',
      });

      expect(mockKiroChatProcess.start).toHaveBeenCalled();
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('Use ALL of the embedded qmims instructions discovered from'),
      );
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('1. Add installation steps'),
      );
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('2. Document environment variables'),
      );
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('Source location: line 3'),
      );
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('Source location: line 8, target lines 10-14'),
      );
      expect(mockKiroChatProcess.stop).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('Instruction processing completed successfully'),
      );
    });

    test('should preserve single-instruction behavior in instruct mode', async () => {
      jest
        .requireMock('../utils/markdown')
        .parseInstructions.mockReturnValue([
          { instruction: 'Add installation steps', lineNumber: 3 },
        ]);

      await generateCommand.handler({
        mode: 'instruct:README.md',
        verbose: false,
        _: [],
        $0: '',
      });

      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('1. Add installation steps'),
      );
      expect(mockKiroChatProcess.sendMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('2. '),
      );
    });

    test('should use the existing output file as the instruction source in instruct mode', async () => {
      await generateCommand.handler({ mode: 'instruct', verbose: false, _: [], $0: '' });

      expect(jest.requireMock('../utils/markdown').readMarkdownFile).toHaveBeenCalledWith(
        expect.stringContaining('README.md'),
      );
      expect(mockKiroChatProcess.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('Use ALL of the embedded qmims instructions discovered from'),
      );
      expect(mockKiroChatProcess.stop).toHaveBeenCalled();
    });

    test('should fail when instruct mode finds no embedded instructions', async () => {
      jest.requireMock('../utils/markdown').parseInstructions.mockReturnValue([]);

      await generateCommand.handler({
        mode: 'instruct:README.md',
        verbose: false,
        _: [],
        $0: '',
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('No embedded instructions found'),
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(jest.requireMock('../utils/kiro-cli').KiroChatProcess).not.toHaveBeenCalled();
    });

    test('should handle errors during generate processing', async () => {
      mockKiroChatProcess.stop.mockRejectedValueOnce(new Error('Kiro failed'));

      await generateCommand.handler({ mode: 'auto', verbose: false, _: [], $0: '' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error generating README'),
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(process.removeListener).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });

  describe('Templates Command', () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      success: jest.fn(),
      debug: jest.fn(),
    };

    const mockTemplates = [
      { name: 'basic', isBuiltIn: true },
      { name: 'detailed', isBuiltIn: true },
      { name: 'custom', isBuiltIn: false, path: '/path/to/custom' },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit);

      jest.requireMock('../utils/logger').Logger.mockImplementation(() => mockLogger);

      jest.requireMock('../utils/templates').listTemplates.mockReturnValue(mockTemplates);
      jest.requireMock('../utils/templates').getTemplate.mockImplementation((name: string) => {
        return mockTemplates.find((template) => template.name === name);
      });
      jest
        .requireMock('../utils/templates')
        .getTemplateContent.mockResolvedValue('Template content');
      jest.requireMock('../utils/templates').addTemplate.mockReturnValue(undefined);
      jest.requireMock('../utils/templates').removeTemplate.mockReturnValue(undefined);
    });

    test('should define command, description and builder', () => {
      expect(templatesCommand.command).toBe('templates');
      expect(templatesCommand.desc).toBeDefined();
      expect(templatesCommand.builder).toBeDefined();
    });
  });
});
