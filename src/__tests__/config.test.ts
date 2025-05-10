import { config, getConfig, setConfig, deleteConfig, listConfig } from '../utils/config';

// Mock the conf module
jest.mock('conf', () => {
  // Create a more sophisticated mock store that handles nested properties
  const mockStore: Record<string, any> = {
    user: {},
    defaults: {
      mode: 'auto',
      outputFileName: 'README.md',
    },
    q: {
      autoApproveEdits: false,
    },
    git: {
      autoCommit: {
        enabled: false,
        messageFormat: 'docs: Update {fileName} via qmims ({mode})',
      },
    },
  };
  
  return jest.fn().mockImplementation(() => {
    return {
      get: jest.fn((key) => {
        if (!key) return mockStore;
        
        // Handle nested keys (e.g., 'user.name')
        const parts = key.split('.');
        let current = mockStore;
        
        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            return undefined;
          }
        }
        
        return current;
      }),
      set: jest.fn((key, value) => {
        // Handle nested keys (e.g., 'user.name')
        const parts = key.split('.');
        let current = mockStore;
        
        // Navigate to the parent object
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!(part in current)) {
            current[part] = {};
          }
          current = current[part];
        }
        
        // Set the value on the parent object
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
      }),
      delete: jest.fn((key) => {
        // Handle nested keys (e.g., 'user.name')
        const parts = key.split('.');
        let current = mockStore;
        
        // Navigate to the parent object
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!(part in current)) {
            return; // Key doesn't exist, nothing to delete
          }
          current = current[part];
        }
        
        // Delete the property from the parent object
        const lastPart = parts[parts.length - 1];
        delete current[lastPart];
      }),
      store: mockStore,
      path: '/mock/config/path.json',
    };
  });
});

// Mock os and path modules
jest.mock('os', () => ({
  homedir: jest.fn().mockReturnValue('/home/user'),
  platform: jest.fn().mockReturnValue('linux'),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

describe('Config Utilities', () => {
  beforeEach(() => {
    // Clear the mock store before each test
    Object.keys(config.store).forEach((key) => {
      deleteConfig(key);
    });
  });

  test('setConfig should store a value', () => {
    setConfig('test.key', 'test-value');
    expect(getConfig('test.key')).toBe('test-value');
  });

  test('getConfig should retrieve a stored value', () => {
    setConfig('test.key', 'test-value');
    expect(getConfig('test.key')).toBe('test-value');
  });

  test('getConfig should return undefined for non-existent keys', () => {
    expect(getConfig('non.existent.key')).toBeUndefined();
  });

  test('deleteConfig should remove a stored value', () => {
    setConfig('test.key', 'test-value');
    expect(getConfig('test.key')).toBe('test-value');

    deleteConfig('test.key');
    expect(getConfig('test.key')).toBeUndefined();
  });

  test('listConfig should return all config values', () => {
    // Set values in the existing structure
    setConfig('user.name', 'Test User');
    setConfig('user.email', 'test@example.com');

    const configList = listConfig();
    expect(configList).toHaveProperty('user');
    expect(configList.user).toHaveProperty('name', 'Test User');
    expect(configList.user).toHaveProperty('email', 'test@example.com');
  });

  test('listConfig should return default config when store is empty', () => {
    // Clear the store
    Object.keys(config.store).forEach((key) => {
      deleteConfig(key);
    });

    const configList = listConfig();

    // Should have default structure
    expect(configList).toHaveProperty('user');
    expect(configList).toHaveProperty('defaults');
    expect(configList).toHaveProperty('q');
    expect(configList).toHaveProperty('git');

    // Check specific default values
    expect(configList.defaults.mode).toBe('auto');
    expect(configList.defaults.outputFileName).toBe('README.md');
    expect(configList.q.autoApproveEdits).toBe(false);
  });

  test('setConfig should handle nested objects', () => {
    setConfig('user', { name: 'Test User', email: 'test@example.com' });

    const user = getConfig<{ name: string; email: string }>('user');
    expect(user).toEqual({ name: 'Test User', email: 'test@example.com' });
  });

  test('setConfig should update existing values', () => {
    setConfig('test.key', 'initial-value');
    expect(getConfig('test.key')).toBe('initial-value');

    setConfig('test.key', 'updated-value');
    expect(getConfig('test.key')).toBe('updated-value');
  });

  test('config should have a valid path', () => {
    expect(config.path).toBeDefined();
    expect(typeof config.path).toBe('string');
  });
});
