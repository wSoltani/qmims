import Conf from 'conf';
import os from 'os';
import path from 'path';

interface ConfigStore {
  get: <T>(key: string) => T;
  set: <T>(key: string, value: T) => void;
  delete: (key: string) => void;
  store: QmimsConfig;
  path: string;
}

export interface QmimsConfig {
  user: {
    name?: string;
    email?: string;
  };
  defaults: {
    mode: 'auto' | 'template' | 'instruct';
    templateName?: string;
    outputFileName: string;
  };
  q: {
    autoApproveEdits: boolean;
  };
}

const defaultConfig: QmimsConfig = {
  user: {},
  defaults: {
    mode: 'auto',
    outputFileName: 'README.md',
  },
  q: {
    autoApproveEdits: false,
  },
};

// Determine the configuration file location based on OS
const getConfigPath = (): string => {
  const platform = process.platform;
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'qmims');
  }

  return path.join(os.homedir(), '.config', 'qmims');
};

// Create and export the configuration instance
export const config = new Conf({
  projectName: 'qmims',
  configName: 'config',
  cwd: getConfigPath(),
  defaults: defaultConfig,
  schema: {
    user: { type: 'object' },
    defaults: { type: 'object' },
    q: { type: 'object' },
  },
}) as unknown as ConfigStore;

// Initialize the config with default values if it's empty
if (Object.keys(config.store).length === 0) {
  config.store = { ...defaultConfig };
}

// Helper functions for config management
export const getConfig = <T>(key: string): T => {
  return config.get(key) as T;
};

export const setConfig = <T>(key: string, value: T): void => {
  config.set(key, value);
};

export const deleteConfig = (key: string): void => {
  config.delete(key);
};

export const listConfig = (): QmimsConfig => {
  const store = config.store as QmimsConfig;

  if (!store || Object.keys(store).length === 0) {
    return {
      ...defaultConfig,
      user: { ...defaultConfig.user },
      defaults: { ...defaultConfig.defaults },
      q: { ...defaultConfig.q },
    };
  }

  return {
    ...defaultConfig,
    ...store,
    user: {
      ...defaultConfig.user,
      ...(store.user || {}),
    },
    defaults: {
      ...defaultConfig.defaults,
      ...(store.defaults || {}),
    },
    q: {
      ...defaultConfig.q,
      ...(store.q || {}),
    },
  };
};
