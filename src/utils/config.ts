import Conf from 'conf';
import os from 'os';
import path from 'path';

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
  git: {
    autoCommit: {
      enabled: boolean;
      messageFormat: string;
    };
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
  git: {
    autoCommit: {
      enabled: false,
      messageFormat: 'docs: Update {fileName} via qmims ({mode})',
    },
  },
};

// Determine the configuration file location based on OS
const getConfigPath = (): string => {
  const platform = process.platform;
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'qmims');
  } else {
    return path.join(os.homedir(), '.config', 'qmims');
  }
};

// Create and export the configuration instance
export const config = new Conf({
  projectName: 'qmims',
  configName: 'config',
  cwd: getConfigPath(),
  defaults: defaultConfig,
  // Ensure the config is initialized with default values
  schema: {
    user: { type: 'object' },
    defaults: { type: 'object' },
    q: { type: 'object' },
    git: { type: 'object' },
  },
}) as any;

// Initialize the config with default values if it's empty
if (Object.keys(config.store).length === 0) {
  config.store = defaultConfig;
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
  // Ensure we're returning the actual configuration
  // Add some default values if the store is empty
  const store = config.store as QmimsConfig;

  if (!store || Object.keys(store).length === 0) {
    return defaultConfig;
  }

  return store;
};
