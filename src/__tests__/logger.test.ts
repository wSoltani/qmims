import { Logger, LogLevel } from '../utils/logger';
import chalk from 'chalk';

// Mock process.stdout.write and process.stderr.write
const mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
const mockStderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

describe('Logger', () => {
  beforeEach(() => {
    // Clear mocks before each test
    mockStdoutWrite.mockClear();
    mockStderrWrite.mockClear();
    
    // Set NODE_ENV to production for most tests
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    // Restore mocks
    mockStdoutWrite.mockRestore();
    mockStderrWrite.mockRestore();
  });

  test('should log info messages to stdout', () => {
    const logger = new Logger();
    logger.info('Test info message');
    
    expect(mockStdoutWrite).toHaveBeenCalledWith(expect.stringContaining('Test info message'));
    expect(mockStderrWrite).not.toHaveBeenCalled();
  });

  test('should log success messages to stdout with green color', () => {
    const logger = new Logger();
    logger.success('Test success message');
    
    expect(mockStdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining(chalk.green('Test success message'))
    );
    expect(mockStderrWrite).not.toHaveBeenCalled();
  });

  test('should log warning messages to stderr with yellow color', () => {
    const logger = new Logger();
    logger.warn('Test warning message');
    
    expect(mockStderrWrite).toHaveBeenCalledWith(
      expect.stringContaining(chalk.yellow('Warning: Test warning message'))
    );
    expect(mockStdoutWrite).not.toHaveBeenCalled();
  });

  test('should log error messages to stderr with red color', () => {
    const logger = new Logger();
    logger.error('Test error message');
    
    expect(mockStderrWrite).toHaveBeenCalledWith(
      expect.stringContaining(chalk.red('Error: Test error message'))
    );
    expect(mockStdoutWrite).not.toHaveBeenCalled();
  });

  test('should not log debug messages when verbose is false', () => {
    const logger = new Logger(false);
    logger.debug('Test debug message');
    
    expect(mockStdoutWrite).not.toHaveBeenCalled();
    expect(mockStderrWrite).not.toHaveBeenCalled();
  });

  test('should log debug messages when verbose is true', () => {
    const logger = new Logger(true);
    logger.debug('Test debug message');
    
    expect(mockStdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining(chalk.cyan('[DEBUG] Test debug message'))
    );
    expect(mockStderrWrite).not.toHaveBeenCalled();
  });

  test('should respect log level settings', () => {
    const logger = new Logger(false, LogLevel.ERROR);
    
    logger.info('Info message'); // Should not be logged
    logger.warn('Warning message'); // Should not be logged
    logger.error('Error message'); // Should be logged
    
    expect(mockStdoutWrite).not.toHaveBeenCalled();
    expect(mockStderrWrite).toHaveBeenCalledTimes(1);
    expect(mockStderrWrite).toHaveBeenCalledWith(
      expect.stringContaining('Error message')
    );
  });

  test('should update verbose mode with setVerbose', () => {
    const logger = new Logger(false);
    
    // Initially debug messages should not be logged
    logger.debug('Debug message 1');
    expect(mockStdoutWrite).not.toHaveBeenCalled();
    
    // After setting verbose to true, debug messages should be logged
    logger.setVerbose(true);
    logger.debug('Debug message 2');
    
    expect(mockStdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining('Debug message 2')
    );
  });

  test('should update log level with setLevel', () => {
    const logger = new Logger(false, LogLevel.INFO);
    
    // Initially info messages should be logged
    logger.info('Info message 1');
    expect(mockStdoutWrite).toHaveBeenCalledTimes(1);
    mockStdoutWrite.mockClear();
    
    // After setting level to ERROR, info messages should not be logged
    logger.setLevel(LogLevel.ERROR);
    logger.info('Info message 2');
    logger.error('Error message');
    
    expect(mockStdoutWrite).not.toHaveBeenCalled();
    expect(mockStderrWrite).toHaveBeenCalledTimes(1);
  });

  test('should store logs in buffer in test mode', () => {
    // Set NODE_ENV to test
    process.env.NODE_ENV = 'test';
    
    const logger = new Logger(true);
    logger.info('Test message 1');
    logger.error('Test error 1');
    
    // In test mode, nothing should be written to stdout/stderr
    expect(mockStdoutWrite).not.toHaveBeenCalled();
    expect(mockStderrWrite).not.toHaveBeenCalled();
    
    // Messages should be in the buffer
    const buffer = logger.getLogBuffer();
    expect(buffer).toHaveLength(2);
    expect(buffer[0]).toContain('Test message 1');
    expect(buffer[1]).toContain('Test error 1');
    
    // Clear buffer
    logger.clearLogBuffer();
    expect(logger.getLogBuffer()).toHaveLength(0);
  });
});