import execa from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import { Logger } from './logger';

export interface KiroChatOptions {
  cwd: string;
  verbose: boolean;
  autoApprove: boolean;
}

export interface KiroChatEvents {
  onOutput: (text: string) => void;
  onError: (error: Error) => void;
  onExit: (code: number | null) => void;
}

interface KiroCliError extends Error {
  exitCode?: number;
  shortMessage?: string;
  isCanceled?: boolean;
  killed?: boolean;
  signal?: string;
}

type ExecaProcess = ReturnType<typeof execa> & {
  kill: (signal?: string, options?: { forceKillAfterTimeout?: number | false }) => void;
  killed?: boolean;
};

const wasProcessCancelled = (error: unknown): boolean => {
  const err = error as KiroCliError | undefined;
  return Boolean(
    err &&
    (err.isCanceled === true ||
      err.killed === true ||
      err.signal === 'SIGINT' ||
      err.signal === 'SIGTERM'),
  );
};

/**
 * Build deterministic Kiro CLI chat arguments.
 *
 * Non-interactive mode requires explicit tool permissions because there is
 * no user present to approve tool calls.  Without --trust-all-tools Kiro
 * rejects every action (fs_write, read, shell, etc.), so the flag is
 * always included.
 *
 * @see https://kiro.dev/docs/cli/headless
 */
export const buildKiroChatArgs = (prompt: string): string[] => {
  const args = ['chat', '--no-interactive', '--trust-all-tools'];

  args.push(prompt);
  return args;
};

export type KiroCliStatus = 'ready' | 'not-installed' | 'not-authenticated';

/**
 * Check if Kiro CLI is installed and authenticated.
 *
 * Availability probe:
 * - kiro-cli --version
 *
 * Auth probe:
 * - kiro-cli whoami
 */
export const checkKiroCli = async (verbose = false): Promise<KiroCliStatus> => {
  const logger = new Logger(verbose);
  logger.debug('Checking if Kiro CLI is installed...');

  try {
    logger.debug('Running kiro-cli --version...');
    await execa('kiro-cli', ['--version']);
    logger.debug('kiro-cli --version succeeded');
  } catch (error) {
    logger.debug(`Kiro CLI not found: ${String(error)}`);
    return 'not-installed';
  }

  try {
    logger.debug('Running kiro-cli whoami...');
    await execa('kiro-cli', ['whoami']);
    logger.debug('kiro-cli whoami succeeded - auth is ready');
    return 'ready';
  } catch (error) {
    logger.debug(`Kiro CLI auth check failed: ${String(error)}`);
    return 'not-authenticated';
  }
};

export const getKiroCliGuidance = (status: KiroCliStatus): string => {
  if (status === 'ready') {
    return '';
  }

  if (status === 'not-installed') {
    return `
${chalk.red('Error:')} Kiro CLI is not installed.
${chalk.yellow('qmims')} requires Kiro CLI to function.

Install it for your platform:

  macOS:
    ${chalk.green('curl -fsSL https://cli.kiro.dev/install | bash')}

  Windows 11 (PowerShell or Windows Terminal — ${chalk.red('not')} Command Prompt):
    ${chalk.green("irm 'https://cli.kiro.dev/install.ps1' | iex")}

  Windows 10:
    ${chalk.green('https://kiro.dev/downloads/')}

  Linux:
    See ${chalk.underline('https://kiro.dev/docs/cli/installation/')} for AppImage, .deb, or zip options.

Then sign in:
    ${chalk.green('kiro-cli login')}

Once done, run ${chalk.yellow('qmims')} again.
`;
  }

  return `
${chalk.red('Error:')} Kiro CLI is installed but you are not signed in.

Sign in with:
    ${chalk.green('kiro-cli login')}

For remote or SSH environments where no browser is available:
    ${chalk.green('kiro-cli login --use-device-flow')}

Verify with:
    ${chalk.green('kiro-cli whoami')}

For headless / CI environments, set ${chalk.green('KIRO_API_KEY')} instead:

  Linux / macOS:
    ${chalk.green('export KIRO_API_KEY=your_key')}

  Windows PowerShell:
    ${chalk.green('$env:KIRO_API_KEY = "your_key"')}

If something looks wrong, try:
    ${chalk.green('kiro-cli doctor')}
`;
};

export class KiroChatProcess {
  private readonly options: KiroChatOptions;
  private readonly events: KiroChatEvents;
  private readonly logger: Logger;

  private prompt = '';
  private spinner: ReturnType<typeof ora> | null = null;
  private activeProcess: ExecaProcess | null = null;
  private terminated = false;

  constructor(options: KiroChatOptions, events: KiroChatEvents) {
    this.options = options;
    this.events = events;
    this.logger = new Logger(options.verbose);
  }

  public start(): void {
    this.spinner = ora('Starting Kiro CLI chat...').start();
    this.spinner.text = 'Kiro is ready...';
    this.events.onOutput('Kiro is ready');
  }

  public sendMessage(message: string): void {
    this.prompt = message;
  }

  public async stop(): Promise<void> {
    this.stopSpinner();

    if (this.terminated) {
      throw new Error('Kiro CLI process was terminated before execution started');
    }

    await this.executeCommand();
  }

  public terminate(): void {
    this.terminated = true;

    const processToKill = this.activeProcess;
    if (processToKill) {
      try {
        processToKill.kill('SIGTERM', { forceKillAfterTimeout: 1000 });
      } catch (error) {
        this.logger.debug(`Failed to terminate Kiro CLI process cleanly: ${String(error)}`);
      }
    }

    this.stopSpinner();
  }

  private stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  private async executeCommand(): Promise<void> {
    if (!this.prompt) {
      throw new Error('No prompt provided for Kiro CLI');
    }

    if (this.terminated) {
      throw new Error('Kiro CLI process was terminated before execution started');
    }

    this.spinner = ora('Starting Kiro CLI...').start();

    const command = 'kiro-cli';
    const args = buildKiroChatArgs(this.prompt);

    this.logger.debug(`Executing: ${command} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`);

    this.stopSpinner();

    this.logger.info('\nKiro is processing your request. Output:');
    this.logger.info('─'.repeat(60));

    try {
      const child = execa(command, args, {
        cwd: this.options.cwd,
        stdio: 'inherit',
        shell: false,
      }) as ExecaProcess;

      this.activeProcess = child;

      if (this.terminated) {
        this.terminate();
      }

      await child;

      this.activeProcess = null;
      this.logger.info('─'.repeat(60));
      this.logger.success('Kiro CLI command completed successfully.');
      this.events.onExit(0);
    } catch (error: unknown) {
      this.activeProcess = null;

      if (this.terminated || wasProcessCancelled(error)) {
        this.events.onExit(null);
        throw new Error('Kiro CLI process was terminated');
      }

      const err = error as KiroCliError;
      const exitCode = typeof err?.exitCode === 'number' ? err.exitCode : 1;
      const errorMessage =
        typeof err?.shortMessage === 'string'
          ? err.shortMessage
          : error instanceof Error
            ? error.message
            : String(error || 'Unknown error executing Kiro CLI');

      this.events.onError(new Error(errorMessage));
      this.events.onExit(exitCode);

      this.logger.info('\n' + '─'.repeat(60));
      this.logger.error(`Error executing Kiro CLI command: ${errorMessage}`);

      throw new Error(`Kiro CLI process exited with code ${exitCode}`);
    }
  }
}
