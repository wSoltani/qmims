import chalk from 'chalk';
import prompts from 'prompts';
import { Arguments, Argv } from 'yargs';
import { config, deleteConfig, getConfig, listConfig, QmimsConfig, setConfig } from '../utils/config';
import { Logger } from '../utils/logger';

export interface ConfigOptions {
  _: (string | number)[];
  $0: string;
  key?: string;
  value?: string;
  verbose?: boolean;
  setup?: boolean;
  action?: string;
}

export const command = 'config';
export const desc = 'Manage qmims configuration';

export const builder = (yargs: Argv): Argv<ConfigOptions> => {
  return yargs
    .command(
      'list',
      'List all configuration values',
      (yargs) => yargs
        .option('verbose', {
          describe: 'Show verbose output',
          type: 'boolean',
          default: false,
        }),
      (argv) => handler({ ...argv, action: 'list' }),
    )
    .command(
      'get <key>',
      'Get a configuration value',
      (yargs) => {
        return yargs
          .positional('key', {
            describe: 'Configuration key (e.g., "user.name")',
            type: 'string',
            demandOption: true,
          })
          .option('verbose', {
            describe: 'Show verbose output',
            type: 'boolean',
            default: false,
          });
      },
      (argv) => handler({ ...argv, action: 'get' }),
    )
    .command(
      'set <key> <value>',
      'Set a configuration value',
      (yargs) => {
        return yargs
          .positional('key', {
            describe: 'Configuration key (e.g., "user.name")',
            type: 'string',
            demandOption: true,
          })
          .positional('value', {
            describe: 'Configuration value',
            type: 'string',
            demandOption: true,
          })
          .option('verbose', {
            describe: 'Show verbose output',
            type: 'boolean',
            default: false,
          });
      },
      (argv) => handler({ ...argv, action: 'set' }),
    )
    .command(
      'delete <key>',
      'Delete a configuration value',
      (yargs) => {
        return yargs
          .positional('key', {
            describe: 'Configuration key (e.g., "user.name")',
            type: 'string',
            demandOption: true,
          })
          .option('verbose', {
            describe: 'Show verbose output',
            type: 'boolean',
            default: false,
          });
      },
      (argv) => handler({ ...argv, action: 'delete' }),
    )
    .command(
      'setup',
      'Interactive setup wizard for configuration',
      (yargs) => yargs
        .option('verbose', {
          describe: 'Show verbose output',
          type: 'boolean',
          default: false,
        }),
      (argv) => handler({ ...argv, action: 'setup' }),
    )
    .demandCommand(1, 'You must specify an action')
    .help();
};

export const handler = async (argv: Arguments<ConfigOptions>): Promise<void> => {
  const { action, verbose = false } = argv;
  const logger = new Logger(verbose);

  switch (action) {
    case 'list':
      await handleListConfig(logger);
      break;
    case 'get':
      await handleGetConfig(argv.key as string, logger);
      break;
    case 'set':
      await handleSetConfig(argv.key as string, argv.value as string, logger);
      break;
    case 'delete':
      await handleDeleteConfig(argv.key as string, logger);
      break;
    case 'setup':
      await handleSetupConfig(logger);
      break;
    default:
      logger.error(`Unknown action: ${action}`);
      process.exit(1);
  }
};

/**
 * Handle the 'list' action to display all configuration values
 */
async function handleListConfig(logger: Logger): Promise<void> {
  const configValues = listConfig();

  if (!configValues || Object.keys(configValues).length === 0) {
    logger.info('No configuration values found');
    logger.info('Run "qmims config setup" to set up your configuration');
    return;
  }

  logger.info(chalk.bold('\nConfiguration Values:'));
  
  // Display user section
  logger.info(chalk.cyan('\nUser:'));
  if (configValues.user && Object.keys(configValues.user).length > 0) {
    Object.entries(configValues.user).forEach(([key, value]) => {
      logger.info(`  ${key}: ${chalk.green(value)}`);
    });
  } else {
    logger.info('  No user values configured');
  }

  // Display defaults section
  logger.info(chalk.cyan('\nDefaults:'));
  if (configValues.defaults) {
    Object.entries(configValues.defaults).forEach(([key, value]) => {
      logger.info(`  ${key}: ${chalk.green(value)}`);
    });
  }

  // Display q section
  logger.info(chalk.cyan('\nAmazon Q:'));
  if (configValues.q) {
    Object.entries(configValues.q).forEach(([key, value]) => {
      logger.info(`  ${key}: ${chalk.green(value)}`);
    });
  }

  // Display git section
  logger.info(chalk.cyan('\nGit:'));
  if (configValues.git && configValues.git.autoCommit) {
    logger.info(`  autoCommit.enabled: ${chalk.green(configValues.git.autoCommit.enabled)}`);
    logger.info(`  autoCommit.messageFormat: ${chalk.green(configValues.git.autoCommit.messageFormat)}`);
  }

  logger.info('\nTo modify configuration, use:');
  logger.info('  qmims config set <key> <value>');
  logger.info('  qmims config setup (for interactive setup)');
}

/**
 * Handle the 'get' action to display a specific configuration value
 */
async function handleGetConfig(key: string, logger: Logger): Promise<void> {
  try {
    const value = getConfig(key);
    if (value === undefined) {
      logger.error(`Configuration key '${key}' not found`);
      return;
    }
    
    const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
    logger.info(`${key}: ${chalk.green(displayValue)}`);
  } catch (error) {
    logger.error(`Error getting configuration: ${(error as Error).message}`);
  }
}

/**
 * Handle the 'set' action to update a specific configuration value
 */
async function handleSetConfig(key: string, value: string, logger: Logger): Promise<void> {
  try {
    // Convert string values to appropriate types
    let parsedValue: any = value;
    if (value.toLowerCase() === 'true') {
      parsedValue = true;
    } else if (value.toLowerCase() === 'false') {
      parsedValue = false;
    } else if (!isNaN(Number(value)) && value.trim() !== '') {
      parsedValue = Number(value);
    }

    setConfig(key, parsedValue);
    logger.success(`Configuration updated: ${key} = ${chalk.green(parsedValue)}`);
  } catch (error) {
    logger.error(`Error setting configuration: ${(error as Error).message}`);
  }
}

/**
 * Handle the 'delete' action to remove a specific configuration value
 */
async function handleDeleteConfig(key: string, logger: Logger): Promise<void> {
  try {
    deleteConfig(key);
    logger.success(`Configuration deleted: ${key}`);
  } catch (error) {
    logger.error(`Error deleting configuration: ${(error as Error).message}`);
  }
}

/**
 * Handle the 'setup' action to run the interactive setup wizard
 */
async function handleSetupConfig(logger: Logger): Promise<void> {
  logger.info(chalk.bold('\nQMIMS Configuration Setup'));
  logger.info('This wizard will help you set up your qmims configuration');
  logger.info('Press Ctrl+C at any time to cancel');

  try {
    await setupInteractive(logger);
    logger.success('\nConfiguration setup complete!');
    logger.info('Run "qmims config list" to see your configuration');
  } catch (error) {
    if ((error as Error).message === 'canceled') {
      logger.warn('\nSetup canceled');
    } else {
      logger.error(`Error during setup: ${(error as Error).message}`);
    }
  }
}

/**
 * Run the interactive setup wizard to configure qmims
 */
async function setupInteractive(logger: Logger): Promise<void> {
  // Get current config to use as defaults
  const currentConfig = listConfig();
  
  // Setup sections
  await setupUserSection(currentConfig, logger);
  await setupDefaultsSection(currentConfig, logger);
  await setupQSection(currentConfig, logger);
  await setupGitSection(currentConfig, logger);
}

/**
 * Setup the user section of the configuration
 */
async function setupUserSection(currentConfig: QmimsConfig, logger: Logger): Promise<void> {
  logger.info(chalk.cyan('\nUser Information'));

  const userResponses = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Your name:',
      initial: currentConfig.user.name || '',
    },
    {
      type: 'text',
      name: 'email',
      message: 'Your email:',
      initial: currentConfig.user.email || '',
    },
  ], { onCancel: () => { throw new Error('canceled'); } });

  if (userResponses.name) {
    setConfig('user.name', userResponses.name);
  }
  
  if (userResponses.email) {
    setConfig('user.email', userResponses.email);
  }
}

/**
 * Setup the defaults section of the configuration
 */
async function setupDefaultsSection(currentConfig: QmimsConfig, logger: Logger): Promise<void> {
  logger.info(chalk.cyan('\nDefault Settings'));

  const defaultsResponses = await prompts([
    {
      type: 'select',
      name: 'mode',
      message: 'Default generation mode:',
      choices: [
        { title: 'Auto (analyze project and generate README)', value: 'auto' },
        { title: 'Template (use a template to structure README)', value: 'template' },
        { title: 'Instruct (use custom instructions)', value: 'instruct' },
      ],
      initial: currentConfig.defaults.mode === 'auto' ? 0 : 
               currentConfig.defaults.mode === 'template' ? 1 : 2,
    },
    {
      type: 'text',
      name: 'outputFileName',
      message: 'Default output filename:',
      initial: currentConfig.defaults.outputFileName || 'README.md',
    },
  ], { onCancel: () => { throw new Error('canceled'); } });

  if (defaultsResponses.mode) {
    setConfig('defaults.mode', defaultsResponses.mode);
  }
  
  if (defaultsResponses.outputFileName) {
    setConfig('defaults.outputFileName', defaultsResponses.outputFileName);
  }
}

/**
 * Setup the Amazon Q section of the configuration
 */
async function setupQSection(currentConfig: QmimsConfig, logger: Logger): Promise<void> {
  logger.info(chalk.cyan('\nAmazon Q Settings'));

  const qResponses = await prompts([
    {
      type: 'confirm',
      name: 'autoApproveEdits',
      message: 'Automatically approve Amazon Q edits?',
      initial: currentConfig.q.autoApproveEdits || false,
    },
  ], { onCancel: () => { throw new Error('canceled'); } });

  setConfig('q.autoApproveEdits', qResponses.autoApproveEdits);
}

/**
 * Setup the git section of the configuration
 */
async function setupGitSection(currentConfig: QmimsConfig, logger: Logger): Promise<void> {
  logger.info(chalk.cyan('\nGit Integration'));

  const gitEnabled = await prompts({
    type: 'confirm',
    name: 'enabled',
    message: 'Enable automatic git commits for README changes?',
    initial: currentConfig.git.autoCommit?.enabled || false,
  }, { onCancel: () => { throw new Error('canceled'); } });

  setConfig('git.autoCommit.enabled', gitEnabled.enabled);

  if (gitEnabled.enabled) {
    const gitFormat = await prompts({
      type: 'text',
      name: 'messageFormat',
      message: 'Git commit message format:',
      initial: currentConfig.git.autoCommit?.messageFormat || 'docs: Update {fileName} via qmims ({mode})',
      hint: 'Use {fileName} and {mode} as placeholders',
    }, { onCancel: () => { throw new Error('canceled'); } });

    setConfig('git.autoCommit.messageFormat', gitFormat.messageFormat);
  }
}
