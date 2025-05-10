import execa from 'execa';
import ora from 'ora';
import { Logger } from '../utils/logger';
import {
  checkQCli,
  getQCliInstallInstructions,
  QChatProcess,
  QChatOptions,
  QChatEvents,
} from '../utils/q-cli';

// Mock dependencies
jest.mock('execa', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Create a mock for ora that returns a consistent spinner object
const mockSpinner = {
  start: jest.fn().mockReturnThis(),
  stop: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  text: '',
};

jest.mock('ora', () => {
  return jest.fn(() => mockSpinner);
});

jest.mock('chalk', () => ({
  red: jest.fn((text) => `RED:${text}`),
  yellow: jest.fn((text) => `YELLOW:${text}`),
  blue: jest.fn((text) => `BLUE:${text}`),
  green: jest.fn((text) => `GREEN:${text}`),
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

// Create a shared mock logger for consistent access across tests
const mockLoggerMethods = {
  info: jest.fn(),
  debug: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  setVerbose: jest.fn(),
};

jest.mock('../utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => mockLoggerMethods),
  LogLevel: {
    SILENT: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
  },
}));

describe('Q CLI Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkQCli', () => {
    test('should return true when q CLI is installed and authenticated', async () => {
      // Mock successful version check
      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'q version 1.0.0' });
      // Mock successful whoami check
      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'user@example.com' });

      const result = await checkQCli(false);

      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith('q', ['--version']);
      expect(execa).toHaveBeenCalledWith('q', ['whoami']);
    });

    test('should return false when q CLI is installed but not authenticated', async () => {
      // Mock successful version check
      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'q version 1.0.0' });
      // Mock failed whoami check
      (execa as unknown as jest.Mock).mockRejectedValueOnce(new Error('Not authenticated'));

      const result = await checkQCli(false);

      expect(result).toBe(false);
      expect(execa).toHaveBeenCalledWith('q', ['--version']);
      expect(execa).toHaveBeenCalledWith('q', ['whoami']);
    });

    test('should return false when q CLI is not installed', async () => {
      // Mock failed version check
      (execa as unknown as jest.Mock).mockRejectedValueOnce(new Error('Command not found'));

      const result = await checkQCli(false);

      expect(result).toBe(false);
      expect(execa).toHaveBeenCalledWith('q', ['--version']);
      expect(execa).not.toHaveBeenCalledWith('q', ['whoami']);
    });

    test('should log verbose output when verbose flag is true', async () => {
      // Clear previous mock calls
      jest.clearAllMocks();

      // Mock successful version check
      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'q version 1.0.0' });
      // Mock successful whoami check
      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'user@example.com' });

      await checkQCli(true);

      // Use the shared mock logger methods
      expect(mockLoggerMethods.debug).toHaveBeenCalledWith('Running q --version...');
      expect(mockLoggerMethods.debug).toHaveBeenCalledWith('q --version succeeded');
      expect(mockLoggerMethods.debug).toHaveBeenCalledWith('Running q whoami...');
      expect(mockLoggerMethods.debug).toHaveBeenCalledWith(
        'q whoami succeeded - user is authenticated',
      );
    });
  });

  describe('getQCliInstallInstructions', () => {
    test('should return formatted installation instructions', () => {
      const instructions = getQCliInstallInstructions();

      expect(instructions).toContain('RED:Error:');
      expect(instructions).toContain('YELLOW:qmims');
      expect(instructions).toContain(
        'BLUE:https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-installing.html',
      );
      expect(instructions).toContain('GREEN:q login');
    });
  });

  describe('QChatProcess', () => {
    let mockOptions: QChatOptions;
    let mockEvents: QChatEvents;
    let qChatProcess: QChatProcess;

    beforeEach(() => {
      // Clear previous mock calls
      jest.clearAllMocks();

      mockOptions = {
        cwd: '/test/dir',
        verbose: false,
        autoApprove: false,
      };

      mockEvents = {
        onOutput: jest.fn(),
        onError: jest.fn(),
        onExit: jest.fn(),
      };

      qChatProcess = new QChatProcess(mockOptions, mockEvents);
    });

    test('should initialize with correct options and events', () => {
      expect(qChatProcess).toBeDefined();
    });

    test('should start the chat process and show spinner', () => {
      qChatProcess.start();

      expect(ora).toHaveBeenCalledWith('Starting Amazon Q Chat...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockEvents.onOutput).toHaveBeenCalledWith('Amazon Q is ready');
    });

    test('should store message to be sent', () => {
      const testMessage = 'Test message for Amazon Q';
      qChatProcess.sendMessage(testMessage);
    });

    test('should stop the chat process and execute command', async () => {
      // Setup the test message
      const testMessage = 'Test message for Amazon Q';
      qChatProcess.sendMessage(testMessage);

      // Mock successful command execution
      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'Command output' });

      await qChatProcess.stop();

      expect(mockSpinner.stop).toHaveBeenCalled();
      expect(execa).toHaveBeenCalledWith(
        'q',
        ['chat', '--no-interactive', '--trust-all-tools', testMessage],
        expect.objectContaining({
          cwd: '/test/dir',
          stdio: 'inherit',
          shell: false,
        }),
      );
      expect(mockEvents.onExit).toHaveBeenCalledWith(0);
    });

    test('should handle errors when executing command', async () => {
      // Setup the test message
      const testMessage = 'Test message for Amazon Q';
      qChatProcess.sendMessage(testMessage);

      // Mock failed command execution
      const mockError = new Error('Command failed');
      (mockError as any).exitCode = 1;
      (execa as unknown as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(qChatProcess.stop()).rejects.toThrow('Amazon Q process exited with code 1');

      expect(mockSpinner.stop).toHaveBeenCalled();
      expect(mockEvents.onError).toHaveBeenCalledWith(expect.any(Error));
      expect(mockEvents.onExit).toHaveBeenCalledWith(1);
    });

    test('should throw error if no prompt is provided', async () => {
      // Don't set a message

      await expect(qChatProcess.stop()).rejects.toThrow('No prompt provided for Amazon Q');

      expect(execa).not.toHaveBeenCalled();
    });

    test('should terminate the child process', () => {
      // First call start() to ensure the spinner is created
      qChatProcess.start();
      
      // Reset the mock to clear previous calls
      mockSpinner.stop.mockClear();
      
      // Now terminate
      qChatProcess.terminate();
      
      // Verify that the spinner is stopped
      expect(mockSpinner.stop).toHaveBeenCalled();
    });

    test('should use verbose logger when verbose option is true', () => {
      jest.clearAllMocks();

      const verboseOptions = { ...mockOptions, verbose: true };
      const verboseQChatProcess = new QChatProcess(verboseOptions, mockEvents);

      expect(Logger).toHaveBeenCalledWith(true);
    });
  });
});
