import { main } from '../index';
import yargs from 'yargs';
import { initializeTemplates } from '../utils/templates';

// Mock dependencies
jest.mock('yargs', () => {
  const mockYargs = {
    scriptName: jest.fn().mockReturnThis(),
    usage: jest.fn().mockReturnThis(),
    version: jest.fn().mockReturnThis(),
    alias: jest.fn().mockReturnThis(),
    command: jest.fn().mockReturnThis(),
    demandCommand: jest.fn().mockReturnThis(),
    epilogue: jest.fn().mockReturnThis(),
    wrap: jest.fn().mockReturnThis(),
    strict: jest.fn().mockReturnThis(),
    parse: jest.fn().mockResolvedValue({}),
  };
  
  // Add hideBin to the mock
  const mockHideBin = jest.fn().mockReturnValue([]);
  
  // Return the mock yargs function with additional properties
  const mockYargsFn: any = jest.fn().mockReturnValue(mockYargs);
  mockYargsFn.terminalWidth = jest.fn().mockReturnValue(80);
  
  // Add helpers
  mockYargsFn.helpers = {
    hideBin: mockHideBin,
  };
  
  return mockYargsFn;
});

jest.mock('../utils/templates', () => ({
  initializeTemplates: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../commands/generate', () => ({
  command: 'generate',
  describe: 'Generate a README',
  builder: jest.fn(),
  handler: jest.fn(),
}));

jest.mock('../commands/edit', () => ({
  command: 'edit',
  describe: 'Edit a README',
  builder: jest.fn(),
  handler: jest.fn(),
}));

jest.mock('../commands/config', () => ({
  command: 'config',
  describe: 'Manage configuration',
  builder: jest.fn(),
  handler: jest.fn(),
}));

jest.mock('../commands/templates', () => ({
  command: 'templates',
  describe: 'Manage templates',
  builder: jest.fn(),
  handler: jest.fn(),
}));

// Mock console.error
const originalConsoleError = console.error;
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`Process.exit(${code})`);
});

describe('CLI Entry Point', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
    mockExit.mockRestore();
  });

  test('should initialize templates and set up yargs', async () => {
    await main();
    
    expect(initializeTemplates).toHaveBeenCalled();
    expect(yargs().scriptName).toHaveBeenCalledWith('qmims');
    expect(yargs().command).toHaveBeenCalledTimes(4);
    expect(yargs().parse).toHaveBeenCalled();
  });

  test('should handle errors', async () => {
    // Mock initializeTemplates to throw an error
    (initializeTemplates as jest.Mock).mockRejectedValueOnce(new Error('Test error'));
    
    await expect(main()).rejects.toThrow('Process.exit(1)');
    
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Test error'));
  });
});
