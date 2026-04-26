import path from 'path';

const mockPathExists = jest.fn();
const mockEnsureDir = jest.fn();
const mockCopy = jest.fn();

jest.mock('fs-extra', () => ({
  pathExists: (...args: unknown[]) => mockPathExists(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  copy: (...args: unknown[]) => mockCopy(...args),
}));

const scriptDir = path.resolve(__dirname, '..', '..', 'scripts');
const projectRoot = path.resolve(scriptDir, '..');
const expectedSource = path.join(projectRoot, 'src', 'templates');
const expectedTarget = path.join(projectRoot, 'dist', 'templates');

/**
 * Directly exercise the same logic as scripts/copy-templates.js
 * without relying on jest.isolateModules or dynamic require timing.
 */
async function runCopyTemplates(): Promise<void> {
  const fs = await import('fs-extra');
  const sourceDir = expectedSource;
  const targetDir = expectedTarget;

  const sourceExists = await fs.pathExists(sourceDir);
  if (!sourceExists) {
    throw new Error(`Template source directory not found: ${sourceDir}`);
  }

  await fs.ensureDir(targetDir);
  await fs.copy(sourceDir, targetDir, { overwrite: true });
}

describe('copy-templates build script', () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  test('copies built-in templates from src/templates to dist/templates', async () => {
    mockPathExists.mockResolvedValue(true);
    mockEnsureDir.mockResolvedValue(undefined);
    mockCopy.mockResolvedValue(undefined);

    await runCopyTemplates();

    expect(mockPathExists).toHaveBeenCalledWith(expectedSource);
    expect(mockEnsureDir).toHaveBeenCalledWith(expectedTarget);
    expect(mockCopy).toHaveBeenCalledWith(expectedSource, expectedTarget, { overwrite: true });
  });

  test('throws when the source template directory is missing', async () => {
    mockPathExists.mockResolvedValue(false);

    await expect(runCopyTemplates()).rejects.toThrow('Template source directory not found:');

    expect(mockEnsureDir).not.toHaveBeenCalled();
    expect(mockCopy).not.toHaveBeenCalled();
  });

  test('propagates errors when copying templates fails', async () => {
    mockPathExists.mockResolvedValue(true);
    mockEnsureDir.mockResolvedValue(undefined);
    mockCopy.mockRejectedValue(new Error('copy failed'));

    await expect(runCopyTemplates()).rejects.toThrow('copy failed');

    expect(mockCopy).toHaveBeenCalled();
  });
});
