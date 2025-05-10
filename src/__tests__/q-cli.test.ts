import { EventEmitter } from 'events';
import { checkQCli, getQCliInstallInstructions, QChatProcess } from '../utils/q-cli';
import execa from 'execa';
import { spawn } from 'child_process';
import os from 'os';

// Mock os module to control platform detection
jest.mock('os', () => ({
  platform: jest.fn().mockReturnValue('linux'),
  EOL: '\n',
  release: jest.fn().mockReturnValue('1.0.0'),
  type: jest.fn().mockReturnValue('Linux'),
  tmpdir: jest.fn().mockReturnValue('/tmp'),
}));

// Mock Logger
jest.mock('../utils/logger', () => {
  // Create mock functions that also call the original console methods
  const debugMock = jest.fn();
  const infoMock = jest.fn();
  const warnMock = jest.fn();
  const errorMock = jest.fn();
  const successMock = jest.fn();

  return {
    Logger: jest.fn().mockImplementation(() => ({
      debug: debugMock,
      info: infoMock,
      warn: warnMock,
      error: errorMock,
      success: successMock,
      setVerbose: jest.fn(),
      setLevel: jest.fn(),
      getLogBuffer: jest.fn().mockReturnValue([]),
      clearLogBuffer: jest.fn(),
    })),
    LogLevel: {
      SILENT: 0,
      ERROR: 1,
      WARN: 2,
      INFO: 3,
      DEBUG: 4,
    },
  };
});

// Mock execa
jest.mock('execa', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock ora
jest.mock('ora', () => {
  const mockSpinner = {
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
  };
  return {
    __esModule: true,
    default: jest.fn().mockReturnValue(mockSpinner),
  };
});

// Define interfaces for our mock process
interface MockProcess extends EventEmitter {
  stdin: { write: jest.Mock };
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: jest.Mock;
}

// Create a mock process factory to ensure each test gets a fresh mock
function createMockProcess(): {
  mockProcess: MockProcess;
  mockStdout: EventEmitter;
  mockStderr: EventEmitter;
} {
  const mockStdout = new EventEmitter();
  const mockStderr = new EventEmitter();
  const mockProcess = new EventEmitter() as MockProcess;

  mockProcess.stdin = {
    write: jest.fn(),
  };

  mockProcess.stdout = mockStdout;
  mockProcess.stderr = mockStderr;
  mockProcess.kill = jest.fn();

  return {
    mockProcess,
    mockStdout,
    mockStderr,
  };
}

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('Q CLI Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set NODE_ENV to test
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env.NODE_ENV;
  });

  describe('checkQCli', () => {
    test('should return true if Q CLI is installed and authenticated', async () => {
      // Mock successful version check
      (execa as jest.Mock).mockResolvedValueOnce({ stdout: '1.0.0' });

      // Mock successful chat command
      (execa as jest.Mock).mockResolvedValueOnce({ stdout: 'Hello, I am Amazon Q' });

      const result = await checkQCli();

      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith('q', ['--version']);
      expect(execa).toHaveBeenCalledWith('q', ['chat', '--no-interactive', 'echo "test"']);
    });

    test('should return false if Q CLI is not installed', async () => {
      // Mock failed version check
      (execa as jest.Mock).mockRejectedValueOnce(new Error('Command not found'));

      const result = await checkQCli();

      expect(result).toBe(false);
      expect(execa).toHaveBeenCalledWith('q', ['--version']);
      expect(execa).not.toHaveBeenCalledWith('q', ['chat', '--no-interactive', 'echo "test"']);
    });

    test('should return false if Q CLI is not authenticated', async () => {
      // Mock successful version check
      (execa as jest.Mock).mockResolvedValueOnce({ stdout: '1.0.0' });

      // Mock unauthenticated chat command
      (execa as jest.Mock).mockResolvedValueOnce({ stdout: 'not authenticated' });

      const result = await checkQCli();

      expect(result).toBe(false);
      expect(execa).toHaveBeenCalledWith('q', ['--version']);
      expect(execa).toHaveBeenCalledWith('q', ['chat', '--no-interactive', 'echo "test"']);
    });
  });

  describe('getQCliInstallInstructions', () => {
    test('should return installation instructions with correct URL', () => {
      const instructions = getQCliInstallInstructions();

      expect(instructions).toContain('Amazon Q Developer CLI');
      expect(instructions).toContain(
        'https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-installing.html',
      );
      expect(instructions).toContain('q login');
    });
  });

  // Tests for QChatProcess
  describe('QChatProcess', () => {
    let mockProcess: MockProcess;
    let mockStdout: EventEmitter;
    let mockStderr: EventEmitter;
    let qChatEvents: any;
    let qChat: QChatProcess;

    beforeEach(() => {
      // Create fresh mocks for each test
      const mocks = createMockProcess();
      mockProcess = mocks.mockProcess;
      mockStdout = mocks.mockStdout;
      mockStderr = mocks.mockStderr;

      // Set up the spawn mock to return our mock process
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      // Set up event handlers
      qChatEvents = {
        onOutput: jest.fn(),
        onPermissionRequest: jest.fn().mockResolvedValue(true),
        onError: jest.fn(),
        onExit: jest.fn(),
      };

      // Create a new QChatProcess instance for each test
      qChat = new QChatProcess(
        { cwd: '/test/dir', verbose: true, autoApprove: false },
        qChatEvents,
      );

      // Start the process
      qChat.start();

      // Reset the stdin.write mock after start
      mockProcess.stdin.write.mockClear();
    });

    test('should start Q Chat process with mock in test environment', () => {
      // In test environment, should use mock-q-cli.js
      expect(spawn).toHaveBeenCalledWith(
        process.execPath,
        [expect.stringContaining('mock-q-cli.js'), 'chat'],
        expect.objectContaining({
          cwd: '/test/dir',
          stdio: ['pipe', 'pipe', 'pipe'],
        }),
      );
    });

    test('should use platform-specific command on Windows', () => {
      // Reset mocks
      jest.clearAllMocks();

      // Mock Windows platform
      (os.platform as jest.Mock).mockReturnValueOnce('win32');

      // Create a fresh mock process
      const mocks = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mocks.mockProcess);

      // Create a new instance for Windows test
      const windowsQChat = new QChatProcess(
        { cwd: '/test/dir', verbose: false, autoApprove: false },
        qChatEvents,
      );

      windowsQChat.start();

      // Should use shell on Windows
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          shell: true,
        }),
      );
    });

    test('should handle stdout data', () => {
      // Simulate stdout data
      mockStdout.emit('data', Buffer.from('Hello from Q'));

      expect(qChatEvents.onOutput).toHaveBeenCalledWith('[Q STDOUT]: Hello from Q');
    });

    test('should handle stderr data', () => {
      // Simulate stderr data
      mockStderr.emit('data', Buffer.from('Warning message'));

      expect(qChatEvents.onOutput).toHaveBeenCalledWith('[Q STDERR]: Warning message');
    });

    test('should handle process exit', () => {
      // Simulate process exit
      mockProcess.emit('exit', 0);

      expect(qChatEvents.onExit).toHaveBeenCalledWith(0);
    });

    test('should handle process error', () => {
      // Simulate process error
      const error = new Error('Process error');
      mockProcess.emit('error', error);

      expect(qChatEvents.onError).toHaveBeenCalledWith(error);
    });

    test('should send message with platform-specific line endings', () => {
      // Mock Linux platform
      (os.platform as jest.Mock).mockReturnValueOnce('linux');

      qChat.sendMessage('Hello Q');

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('Hello Q\n');

      // Mock Windows platform
      (os.platform as jest.Mock).mockReturnValueOnce('win32');
      qChat.sendMessage('Hello Q');

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('Hello Q\r\n');
    });

    test('should handle permission request with auto-approve', async () => {
      // Create a new instance with auto-approve
      jest.clearAllMocks();
      const mocks = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mocks.mockProcess);

      const autoApproveQChat = new QChatProcess(
        { cwd: '/test/dir', verbose: false, autoApprove: true },
        qChatEvents,
      );

      autoApproveQChat.start();
      mocks.mockProcess.stdin.write.mockClear();

      // Directly access and trigger the private handlePermissionRequest method
      // @ts-ignore - Accessing private method for testing
      await autoApproveQChat['handlePermissionRequest']('edit the file');

      // Should not call permission request handler when auto-approve is true
      expect(qChatEvents.onPermissionRequest).not.toHaveBeenCalled();

      // Should automatically approve with platform-specific line ending
      expect(mocks.mockProcess.stdin.write).toHaveBeenCalledWith(expect.stringMatching(/^y[\r\n]/));
    });

    test('should handle permission request without auto-approve', async () => {
      // Directly access and trigger the private handlePermissionRequest method
      // @ts-ignore - Accessing private method for testing
      await qChat['handlePermissionRequest']('edit the file');

      // Should call permission request handler
      expect(qChatEvents.onPermissionRequest).toHaveBeenCalledWith('edit the file');

      // Should write user's response with platform-specific line ending
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(expect.stringMatching(/^y[\r\n]/));
    });

    test('should handle rejection in permission request', async () => {
      // Mock permission request handler to reject
      qChatEvents.onPermissionRequest.mockResolvedValueOnce(false);

      // Directly access and trigger the private handlePermissionRequest method
      // @ts-ignore - Accessing private method for testing
      await qChat['handlePermissionRequest']('edit the file');

      // Should call permission request handler
      expect(qChatEvents.onPermissionRequest).toHaveBeenCalledWith('edit the file');

      // Should write rejection response
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(expect.stringMatching(/^n[\r\n]/));
    });

    test('should stop Q Chat process', () => {
      qChat.stop();

      expect(mockProcess.stdin.write).toHaveBeenCalledWith(expect.stringMatching(/^\/quit[\r\n]/));
    });

    test('should force kill process if it does not exit gracefully', () => {
      jest.useFakeTimers();

      qChat.stop();

      // Fast-forward time to trigger the kill timeout
      jest.advanceTimersByTime(6000);

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      jest.useRealTimers();
    });

    test.skip('should check for completion', () => {
      // This functionality has been removed in the new implementation
    });

    test.skip('should add custom completion indicators', () => {
      // This functionality has been removed in the new implementation
    });

    test.skip('should throw error when sending message without starting process', () => {
      // This test is no longer applicable with the new implementation
    });
  });
});
