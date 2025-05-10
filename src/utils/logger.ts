import chalk from 'chalk';
import os from 'os';

/**
 * Log levels for controlling output verbosity
 */
export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4
}

/**
 * Logger utility for consistent logging throughout the application
 */
export class Logger {
  private verbose: boolean;
  private level: LogLevel;
  private isTest: boolean;
  private logBuffer: string[] = [];

  /**
   * Create a new Logger instance
   * @param verbose Whether to show debug messages
   * @param level The minimum log level to display
   */
  constructor(verbose = false, level = LogLevel.INFO) {
    this.verbose = verbose;
    this.level = verbose ? LogLevel.DEBUG : level;
    this.isTest = process.env.NODE_ENV === 'test';
  }

  /**
   * Log an informational message
   * @param message The message to log
   */
  public info(message: string): void {
    if (this.level >= LogLevel.INFO) {
      this.log(message);
    }
  }

  /**
   * Log a success message
   * @param message The message to log
   */
  public success(message: string): void {
    if (this.level >= LogLevel.INFO) {
      this.log(chalk.green(message));
    }
  }

  /**
   * Log a warning message
   * @param message The message to log
   */
  public warn(message: string): void {
    if (this.level >= LogLevel.WARN) {
      this.logToStderr(chalk.yellow(`Warning: ${message}`));
    }
  }

  /**
   * Log an error message
   * @param message The message to log
   */
  public error(message: string): void {
    if (this.level >= LogLevel.ERROR) {
      this.logToStderr(chalk.red(`Error: ${message}`));
    }
  }

  /**
   * Log a debug message (only when verbose mode is enabled)
   * @param message The message to log
   */
  public debug(message: string): void {
    if (this.level >= LogLevel.DEBUG) {
      this.log(chalk.cyan(`[DEBUG] ${message}`));
    }
  }

  /**
   * Set verbose mode
   * @param verbose Whether to enable verbose mode
   */
  public setVerbose(verbose: boolean): void {
    this.verbose = verbose;
    this.level = verbose ? LogLevel.DEBUG : this.level;
  }

  /**
   * Set the minimum log level
   * @param level The minimum log level to display
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log buffer (useful for testing)
   */
  public getLogBuffer(): string[] {
    return [...this.logBuffer];
  }

  /**
   * Clear the log buffer
   */
  public clearLogBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Internal method to log to stdout
   * @param message The message to log
   */
  private log(message: string): void {
    // In test mode, store logs in buffer instead of console output
    if (this.isTest) {
      this.logBuffer.push(message);
      return;
    }

    // Ensure line endings are appropriate for the platform
    const formattedMessage = this.formatMessage(message);
    process.stdout.write(formattedMessage);
  }

  /**
   * Internal method to log to stderr
   * @param message The message to log
   */
  private logToStderr(message: string): void {
    // In test mode, store logs in buffer instead of console output
    if (this.isTest) {
      this.logBuffer.push(message);
      return;
    }

    // Ensure line endings are appropriate for the platform
    const formattedMessage = this.formatMessage(message);
    process.stderr.write(formattedMessage);
  }

  /**
   * Format a message with appropriate line endings for the platform
   * @param message The message to format
   */
  private formatMessage(message: string): string {
    const lineEnding = os.platform() === 'win32' ? '\r\n' : '\n';
    return message.endsWith(lineEnding) ? message : message + lineEnding;
  }
}