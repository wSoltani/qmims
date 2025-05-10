#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as generateCommand from './commands/generate';
import * as editCommand from './commands/edit';
import * as configCommand from './commands/config';
import * as templatesCommand from './commands/templates';
import { initializeTemplates } from './utils/templates';
import { Logger, LogLevel } from './utils/logger';

// Package.json info for version
const packageJson = require('../package.json');

async function main() {
  // Create a logger that will show info messages by default
  const logger = new Logger(false, LogLevel.INFO);

  // Use debug level for startup logs so they only show in verbose mode
  logger.debug('QMIMS CLI starting...');

  try {
    // Initialize templates
    logger.debug('Initializing templates...');
    await initializeTemplates();
    logger.debug('Templates initialized');

    // Create CLI parser
    logger.debug('Creating CLI parser...');
    const cli = yargs(hideBin(process.argv))
      .scriptName('qmims')
      .usage('$0 <command> [options]')
      .version(packageJson.version)
      .alias('v', 'version')
      .alias('h', 'help')
      .option('verbose', {
        alias: 'V',
        type: 'boolean',
        description: 'Run with verbose logging',
        default: false,
      })
      .command(generateCommand)
      .command(editCommand)
      .command(configCommand)
      .command(templatesCommand)
      .demandCommand(1, 'You must specify a command')
      .epilogue('For more information, visit https://github.com/wsoltani/qmims')
      .wrap(yargs.terminalWidth())
      .middleware((argv) => {
        // Update logger verbosity based on command line flag
        if (argv.verbose) {
          logger.setVerbose(true);
          logger.debug('Verbose mode enabled');
        }
        // Don't return anything to satisfy the middleware type
      })
      .strict();

    // Parse arguments
    logger.debug('Parsing arguments...');
    await cli.parse();
    logger.debug('Arguments parsed');
  } catch (error) {
    logger.error(`${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Check if this is being run directly
if (require.main === module) {
  main();
}

// Export for testing
export { main };
