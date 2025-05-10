import { config, getConfig, setConfig, deleteConfig, listConfig } from '../utils/config';

// Mock the conf module
jest.mock('conf', () => {
  const mockStore: Record<string, any> = {};
  return jest.fn().mockImplementation(() => {
    return {
      get: jest.fn((key) => {
        if (key) {
          return mockStore[key];
        }
        return mockStore;
      }),
      set: jest.fn((key, value) => {
        mockStore[key] = value;
      }),
      delete: jest.fn((key) => {
        delete mockStore[key];
      }),
      store: mockStore,
    };
  });
});

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
    setConfig('test.key1', 'value1');
    setConfig('test.key2', 'value2');
    
    const configList = listConfig() as Record<string, any>;
    expect(configList['test.key1']).toBe('value1');
    expect(configList['test.key2']).toBe('value2');
  });

  test('setConfig should handle nested objects', () => {
    setConfig('user', { name: 'Test User', email: 'test@example.com' });
    
    const user = getConfig<{ name: string; email: string }>('user');
    expect(user).toEqual({ name: 'Test User', email: 'test@example.com' });
  });
});
