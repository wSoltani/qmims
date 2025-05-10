import execa from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import { Logger } from './logger';

/**
 * Check if Amazon Q CLI is installed and authenticated
 */
export const checkQCli = async (verbose = false): Promise<boolean> => {
  const logger = new Logger(verbose);
  logger.info('Checking if Amazon Q CLI is installed...');
  try {
    // Check if 'q' command exists
    logger.debug('Running q --version...');
    await execa('q', ['--version']);
    logger.debug('q --version succeeded');

    // Use 'q whoami' to check authentication
    logger.debug('Running q whoami...');
    try {
      await execa('q', ['whoami']);
      logger.debug('q whoami succeeded - user is authenticated');
      return true;
    } catch (whoamiError) {
      logger.error(`Error running q whoami - user may not be authenticated: ${whoamiError}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error checking Q CLI: ${error}`);
    return false;
  }
};

/**
 * Get installation instructions for Amazon Q CLI
 */
export const getQCliInstallInstructions = (): string => {
  return `
${chalk.red('Error:')} Amazon Q Developer CLI ('q' command) not found or not authenticated.
${chalk.yellow('qmims')} requires the Amazon Q Developer CLI to function.

Please ensure it is installed and you are logged in:
1. Installation instructions: ${chalk.blue('https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-installing.html')}
2. After installation, run: ${chalk.green('q login')}

Once set up, try running ${chalk.yellow('qmims')} again.
`;
};

/**
 * Interface for Q Chat process options
 */
export interface QChatOptions {
  cwd: string;
  verbose: boolean;
  autoApprove: boolean;
}

/**
 * Interface for Q Chat process events
 */
export interface QChatEvents {
  onOutput: (text: string) => void;
  onError: (error: Error) => void;
  onExit: (code: number | null) => void;
}

/**
 * Class to manage interaction with Amazon Q CLI
 * Uses a direct command approach for reliability and proper output display
 */
export class QChatProcess {
  private options: QChatOptions;
  private events: QChatEvents;
  private prompt: string = '';
  private spinner: ReturnType<typeof ora> | null = null;
  private logger: Logger;
  private childProcess: ReturnType<typeof spawn> | null = null;
  private contextFiles: string[] = [];

  constructor(options: QChatOptions, events: QChatEvents) {
    this.options = options;
    this.events = events;
    this.logger = new Logger(options.verbose);
  }

  /**
   * Start the Q Chat process
   */
  public start(): void {
    this.spinner = ora('Starting Amazon Q Chat...').start();
    if (this.spinner) {
      this.spinner.text = 'Amazon Q is ready...';
    }
    this.events.onOutput('Amazon Q is ready');
  }

  /**
   * Store a message to be sent to Amazon Q
   */
  public sendMessage(message: string): void {
    this.prompt = message;
  }

  /**
   * Stop the Q Chat process
   */
  public async stop(): Promise<void> {
    // Make sure any previous spinner is stopped
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }

    return this.executeCommand();
  }

  /**
   * Terminate the Q Chat process
   */
  public terminate(): void {
    if (this.childProcess) {
      this.childProcess.kill();
    }

    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Execute the Amazon Q command with real-time output
   */
  private async executeCommand(): Promise<void> {
    if (!this.prompt) {
      throw new Error('No prompt provided for Amazon Q');
    }

    // Use spinner for initial startup
    this.spinner = ora('Starting Amazon Q...').start();

    try {
      // On Windows, we need to be careful with command line arguments
      // Use a simpler approach that works across platforms
      const command = 'q';
      const args = ['chat', '--no-interactive', '--trust-all-tools'];

      // Add the prompt as the last argument
      if (this.prompt) {
        args.push(this.prompt);
      }

      // Log the command being executed
      this.logger.debug(`Executing: q chat --no-interactive --trust-all-tools "${this.prompt}"`);

      // Stop the spinner before executing the command to avoid mixing spinner with output
      if (this.spinner) {
        this.spinner.stop();
      }

      this.logger.info('\nAmazon Q is processing your request. Output:');
      this.logger.info('─'.repeat(60));

      // Execute the command
      const result = await execa(command, args, {
        cwd: this.options.cwd,
        stdio: 'inherit', // Show output in real-time
        shell: false, // Don't use shell to avoid quoting issues
      });

      this.logger.info('─'.repeat(60));
      this.logger.success('Amazon Q command completed successfully.');

      this.events.onExit(0);
      return;
    } catch (error) {
      const err = error as any;
      const errorMessage = err.message || 'Unknown error executing Amazon Q command';
      const exitCode = err.exitCode || 1;

      this.events.onError(new Error(errorMessage));
      this.events.onExit(exitCode);

      // Make sure spinner is stopped
      if (this.spinner) {
        this.spinner.stop();
      }

      this.logger.info('\n' + '─'.repeat(60));
      this.logger.error(`Error executing Amazon Q command: ${errorMessage}`);

      throw new Error(`Amazon Q process exited with code ${exitCode}`);
    }
  }
}
