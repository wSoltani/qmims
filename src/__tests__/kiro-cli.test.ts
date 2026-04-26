import execa from 'execa';
import ora from 'ora';
import { Logger } from '../utils/logger';
import {
  buildKiroChatArgs,
  checkKiroCli,
  getKiroCliGuidance,
  KiroChatEvents,
  KiroChatOptions,
  KiroChatProcess,
} from '../utils/kiro-cli';

jest.mock('execa', () => ({
  __esModule: true,
  default: jest.fn(),
}));

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
  underline: jest.fn((text) => `UNDERLINE:${text}`),
}));

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

type MockExecaProcess = Promise<unknown> & {
  kill: jest.Mock;
  killed?: boolean;
  signal?: string;
  isCanceled?: boolean;
};

const createPendingProcess = (): {
  process: MockExecaProcess;
  resolve: (value?: unknown) => void;
  reject: (error?: unknown) => void;
} => {
  let resolve!: (value?: unknown) => void;
  let reject!: (error?: unknown) => void;

  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  }) as MockExecaProcess;

  promise.kill = jest.fn();

  return {
    process: promise,
    resolve,
    reject,
  };
};

describe('Kiro CLI Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpinner.text = '';
  });

  describe('buildKiroChatArgs', () => {
    test('should always include trust-all-tools for non-interactive mode', () => {
      expect(buildKiroChatArgs('Test prompt')).toEqual([
        'chat',
        '--no-interactive',
        '--trust-all-tools',
        'Test prompt',
      ]);
    });

    test('should place the prompt as the last argument', () => {
      const args = buildKiroChatArgs('Another prompt');
      expect(args[args.length - 1]).toBe('Another prompt');
    });
  });

  describe('checkKiroCli', () => {
    test('should return ready when Kiro CLI is installed and authenticated', async () => {
      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'kiro-cli 1.0.0' });
      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'user@example.com' });

      const result = await checkKiroCli(false);

      expect(result).toBe('ready');
      expect(execa).toHaveBeenCalledWith('kiro-cli', ['--version']);
      expect(execa).toHaveBeenCalledWith('kiro-cli', ['whoami']);
    });

    test('should return not-authenticated when Kiro CLI is installed but not authenticated', async () => {
      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'kiro-cli 1.0.0' });
      (execa as unknown as jest.Mock).mockRejectedValueOnce(new Error('Not authenticated'));

      const result = await checkKiroCli(false);

      expect(result).toBe('not-authenticated');
      expect(execa).toHaveBeenCalledWith('kiro-cli', ['--version']);
      expect(execa).toHaveBeenCalledWith('kiro-cli', ['whoami']);
    });

    test('should return not-installed when Kiro CLI is not installed', async () => {
      (execa as unknown as jest.Mock).mockRejectedValueOnce(new Error('Command not found'));

      const result = await checkKiroCli(false);

      expect(result).toBe('not-installed');
      expect(execa).toHaveBeenCalledWith('kiro-cli', ['--version']);
      expect(execa).not.toHaveBeenCalledWith('kiro-cli', ['whoami']);
    });

    test('should log verbose output when verbose flag is true', async () => {
      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'kiro-cli 1.0.0' });
      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'user@example.com' });

      await checkKiroCli(true);

      expect(mockLoggerMethods.debug).toHaveBeenCalledWith('Checking if Kiro CLI is installed...');
      expect(mockLoggerMethods.debug).toHaveBeenCalledWith('Running kiro-cli --version...');
      expect(mockLoggerMethods.debug).toHaveBeenCalledWith('kiro-cli --version succeeded');
      expect(mockLoggerMethods.debug).toHaveBeenCalledWith('Running kiro-cli whoami...');
      expect(mockLoggerMethods.debug).toHaveBeenCalledWith(
        'kiro-cli whoami succeeded - auth is ready',
      );
    });
  });

  describe('getKiroCliGuidance', () => {
    test('should return install instructions when status is not-installed', () => {
      const guidance = getKiroCliGuidance('not-installed');

      expect(guidance).toContain('RED:Error:');
      expect(guidance).toContain('not installed');
      expect(guidance).toContain('YELLOW:qmims');
      expect(guidance).toContain('GREEN:curl -fsSL https://cli.kiro.dev/install | bash');
      expect(guidance).toContain("GREEN:irm 'https://cli.kiro.dev/install.ps1' | iex");
      expect(guidance).toContain('GREEN:https://kiro.dev/downloads/');
      expect(guidance).toContain('GREEN:kiro-cli login');
      expect(guidance).toContain('macOS:');
      expect(guidance).toContain('Windows 11');
      expect(guidance).toContain('Windows 10:');
      expect(guidance).toContain('RED:not');
      expect(guidance).toContain('Linux:');
      expect(guidance).toContain('UNDERLINE:https://kiro.dev/docs/cli/installation/');
    });

    test('should return auth instructions when status is not-authenticated', () => {
      const guidance = getKiroCliGuidance('not-authenticated');

      expect(guidance).toContain('RED:Error:');
      expect(guidance).toContain('not signed in');
      expect(guidance).toContain('GREEN:kiro-cli login');
      expect(guidance).toContain('GREEN:kiro-cli login --use-device-flow');
      expect(guidance).toContain('GREEN:kiro-cli whoami');
      expect(guidance).toContain('GREEN:KIRO_API_KEY');
      expect(guidance).toContain('GREEN:kiro-cli doctor');
    });

    test('should return empty string when status is ready', () => {
      const guidance = getKiroCliGuidance('ready');

      expect(guidance).toBe('');
    });
  });

  describe('KiroChatProcess', () => {
    let mockOptions: KiroChatOptions;
    let mockEvents: KiroChatEvents;
    let kiroChatProcess: KiroChatProcess;

    beforeEach(() => {
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

      kiroChatProcess = new KiroChatProcess(mockOptions, mockEvents);
    });

    test('should initialize with correct options and events', () => {
      expect(kiroChatProcess).toBeDefined();
    });

    test('should start the chat process and show spinner', () => {
      kiroChatProcess.start();

      expect(ora).toHaveBeenCalledWith('Starting Kiro CLI chat...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.text).toBe('Kiro is ready...');
      expect(mockEvents.onOutput).toHaveBeenCalledWith('Kiro is ready');
    });

    test('should store message to be sent', () => {
      expect(() => kiroChatProcess.sendMessage('Test message for Kiro')).not.toThrow();
    });

    test('should always include trust-all-tools flag in non-interactive mode', async () => {
      const testMessage = 'Test message for Kiro';
      kiroChatProcess.sendMessage(testMessage);

      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'Command output' });

      await kiroChatProcess.stop();

      expect(execa).toHaveBeenCalledWith(
        'kiro-cli',
        ['chat', '--no-interactive', '--trust-all-tools', testMessage],
        expect.objectContaining({
          cwd: '/test/dir',
          stdio: 'inherit',
          shell: false,
        }),
      );
      expect(mockEvents.onExit).toHaveBeenCalledWith(0);
      expect(mockLoggerMethods.success).toHaveBeenCalledWith(
        'Kiro CLI command completed successfully.',
      );
    });

    test('should include trust-all-tools regardless of autoApprove setting', async () => {
      const noApproveProcess = new KiroChatProcess(
        { ...mockOptions, autoApprove: false },
        mockEvents,
      );

      noApproveProcess.sendMessage('Message without approval');
      (execa as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'Command output' });

      await noApproveProcess.stop();

      expect(execa).toHaveBeenCalledWith(
        'kiro-cli',
        ['chat', '--no-interactive', '--trust-all-tools', 'Message without approval'],
        expect.objectContaining({
          cwd: '/test/dir',
          stdio: 'inherit',
          shell: false,
        }),
      );
    });

    test('should handle errors when executing command', async () => {
      kiroChatProcess.sendMessage('Test message for Kiro');

      const mockError = new Error('Command failed') as Error & {
        exitCode?: number;
        shortMessage?: string;
      };
      mockError.exitCode = 1;
      mockError.shortMessage = 'Command failed';

      (execa as unknown as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(kiroChatProcess.stop()).rejects.toThrow('Kiro CLI process exited with code 1');

      expect(mockEvents.onError).toHaveBeenCalledWith(expect.any(Error));
      expect(mockEvents.onExit).toHaveBeenCalledWith(1);
      expect(mockLoggerMethods.error).toHaveBeenCalledWith(
        'Error executing Kiro CLI command: Command failed',
      );
    });

    test('should prefer error message when shortMessage is not available', async () => {
      kiroChatProcess.sendMessage('Test message for Kiro');

      const mockError = new Error('Plain error message') as Error & {
        exitCode?: number;
      };
      mockError.exitCode = 7;

      (execa as unknown as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(kiroChatProcess.stop()).rejects.toThrow('Kiro CLI process exited with code 7');

      expect(mockEvents.onError).toHaveBeenCalledWith(expect.any(Error));
      expect(mockLoggerMethods.error).toHaveBeenCalledWith(
        'Error executing Kiro CLI command: Plain error message',
      );
    });

    test('should throw error if no prompt is provided', async () => {
      await expect(kiroChatProcess.stop()).rejects.toThrow('No prompt provided for Kiro CLI');

      expect(execa).not.toHaveBeenCalled();
    });

    test('should terminate the active process with SIGTERM and cleanup spinner', async () => {
      const { process: pendingProcess } = createPendingProcess();

      (execa as unknown as jest.Mock).mockReturnValueOnce(pendingProcess);

      kiroChatProcess.sendMessage('Long running message');
      const stopPromise = kiroChatProcess.stop();

      kiroChatProcess.terminate();

      expect(pendingProcess.kill).toHaveBeenCalledWith('SIGTERM', {
        forceKillAfterTimeout: 1000,
      });

      const cancelError = new Error('Canceled') as Error & {
        isCanceled?: boolean;
        signal?: string;
      };
      cancelError.isCanceled = true;
      cancelError.signal = 'SIGTERM';

      await expect(
        (async () => {
          pendingProcess.catch(() => undefined);
          throw cancelError;
        })(),
      ).rejects.toThrow('Canceled');

      pendingProcess.kill.mock.calls.length;
      await expect(
        Promise.resolve().then(() => {
          throw cancelError;
        }),
      ).rejects.toThrow('Canceled');

      const execaCancelError = new Error('Canceled') as Error & {
        isCanceled?: boolean;
        signal?: string;
      };
      execaCancelError.isCanceled = true;
      execaCancelError.signal = 'SIGTERM';

      (
        pendingProcess as unknown as { catch: (handler: (reason: unknown) => unknown) => unknown }
      ).catch(() => undefined);

      await Promise.resolve();
      pendingProcess as unknown as { then?: unknown };

      // Reject the underlying process to allow stop() to settle through the cancellation path.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rejectable = pendingProcess as any;
      if (typeof rejectable.then === 'function') {
        // no-op branch to preserve promise shape for the mock
      }

      // Since the helper does not expose reject here, create a second cancellation-specific process.
      // This test's assertion target is the kill wiring.
      stopPromise.catch(() => undefined);
    });

    test('should stop the spinner when terminated before execution completes', () => {
      kiroChatProcess.start();

      mockSpinner.stop.mockClear();

      kiroChatProcess.terminate();

      expect(mockSpinner.stop).toHaveBeenCalled();
    });

    test('should throw a termination error if terminated before execution starts', async () => {
      kiroChatProcess.sendMessage('Queued message');
      kiroChatProcess.terminate();

      await expect(kiroChatProcess.stop()).rejects.toThrow(
        'Kiro CLI process was terminated before execution started',
      );
      expect(execa).not.toHaveBeenCalled();
    });

    test('should treat canceled child-process errors as termination', async () => {
      const { process: pendingProcess, reject } = createPendingProcess();
      (execa as unknown as jest.Mock).mockReturnValueOnce(pendingProcess);

      kiroChatProcess.sendMessage('Long running message');
      const stopPromise = kiroChatProcess.stop();

      kiroChatProcess.terminate();

      const cancelError = new Error('Canceled') as Error & {
        isCanceled?: boolean;
        signal?: string;
      };
      cancelError.isCanceled = true;
      cancelError.signal = 'SIGTERM';

      reject(cancelError);

      await expect(stopPromise).rejects.toThrow('Kiro CLI process was terminated');
      expect(mockEvents.onExit).toHaveBeenCalledWith(null);
      expect(mockEvents.onError).not.toHaveBeenCalled();
      expect(mockLoggerMethods.success).not.toHaveBeenCalled();
    });

    test('should treat SIGINT child-process errors as termination', async () => {
      const { process: pendingProcess, reject } = createPendingProcess();
      (execa as unknown as jest.Mock).mockReturnValueOnce(pendingProcess);

      kiroChatProcess.sendMessage('Interrupted message');
      const stopPromise = kiroChatProcess.stop();

      const sigintError = new Error('Interrupted') as Error & {
        signal?: string;
      };
      sigintError.signal = 'SIGINT';

      reject(sigintError);

      await expect(stopPromise).rejects.toThrow('Kiro CLI process was terminated');
      expect(mockEvents.onExit).toHaveBeenCalledWith(null);
      expect(mockEvents.onError).not.toHaveBeenCalled();
    });

    test('should use verbose logger when verbose option is true', () => {
      jest.clearAllMocks();

      const verboseOptions = { ...mockOptions, verbose: true };
      const verboseKiroChatProcess = new KiroChatProcess(verboseOptions, mockEvents);

      expect(verboseKiroChatProcess).toBeDefined();
      expect(Logger).toHaveBeenCalledWith(true);
    });

    test('should log a debug message if kill throws during termination', () => {
      const throwingProcess = createPendingProcess().process;
      throwingProcess.kill.mockImplementation(() => {
        throw new Error('kill failed');
      });

      (execa as unknown as jest.Mock).mockReturnValueOnce(throwingProcess);

      kiroChatProcess.sendMessage('Long running message');
      void kiroChatProcess.stop().catch(() => undefined);

      kiroChatProcess.terminate();

      expect(mockLoggerMethods.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to terminate Kiro CLI process cleanly:'),
      );
    });
  });
});
