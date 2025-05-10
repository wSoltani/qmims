import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { Arguments, Argv } from 'yargs';
import { checkQCli, QChatProcess } from '../utils/q-cli';
import { findReadmeFile } from '../utils/markdown';
import { Logger } from '../utils/logger';

export interface EditOptions {
  _: (string | number)[];
  $0: string;
  file?: string;
  yes?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

export const command = 'edit [file]';
export const desc = 'Edit a README.md file using embedded instructions';

export const builder = (yargs: Argv): Argv<EditOptions> => {
  return yargs
    .positional('file', {
      describe: 'Path to the Markdown file to edit',
      type: 'string',
      default: 'README.md',
    })
    .option('yes', {
      alias: 'y',
      describe: 'Automatically approve all permission requests',
      type: 'boolean',
      default: false,
    })
    .option('dry-run', {
      describe: 'Show what would be done without making changes',
      type: 'boolean',
      default: false,
    })
    .option('verbose', {
      describe: 'Show verbose output',
      type: 'boolean',
      default: false,
    });
};

export const handler = async (argv: Arguments<EditOptions>): Promise<void> => {
  const { file = 'README.md', yes = false, dryRun = false, verbose = false } = argv;

  const logger = new Logger(verbose);

  // Resolve the absolute file path
  const absoluteFilePath = path.resolve(file);
  const projectPath = path.dirname(absoluteFilePath);

  // Check if the file exists
  if (!fs.existsSync(absoluteFilePath)) {
    // Try to find a README.md file in the current directory
    const readmePath = await findReadmeFile(projectPath);
    if (!readmePath) {
      logger.error(
        `File '${absoluteFilePath}' does not exist and no README.md was found in the directory.`,
      );
      process.exit(1);
    }
  }

  // Handle dry run mode
  if (dryRun) {
    logger.info(chalk.cyan('\n--- DRY RUN MODE - No changes will be made ---'));
    logger.info(`File to edit: ${chalk.bold(absoluteFilePath)}`);

    logger.info(chalk.cyan('\nActions that would be taken:'));
    logger.info('- Would start Amazon Q chat session');
    logger.info(`- Would add ${path.basename(absoluteFilePath)} to context`);
    logger.info('- Would prompt for permission before making changes (unless --yes is specified)');

    logger.info(chalk.cyan('\n--- End of dry run ---'));
    return;
  }

  // Check if Amazon Q CLI is installed and authenticated
  const qCliAvailable = await checkQCli();
  if (!qCliAvailable) {
    logger.error('Amazon Q Developer CLI is not available or not authenticated.');
    process.exit(1);
  }

  // Set up Q Chat process
  const qChat = new QChatProcess(
    {
      cwd: projectPath,
      verbose,
      autoApprove: yes,
    },
    {
      onOutput: (text) => {
        if (verbose) {
          logger.debug(text);
        }
      },
      onError: (error) => {
        logger.error(error.message);
      },
      onExit: (code) => {
        if (code !== 0 && code !== null) {
          logger.error(`Amazon Q process exited with code ${code}`);
        }
      },
    },
  );

  // Start Q Chat
  qChat.start();

  // Send prompt to process instructions with completion marker
  qChat.sendMessage(
    `I need you to generate a new README.md file for ${absoluteFilePath}. First, read the existing file. Then, find any embedded instructions in HTML comments that start with <!-- qmims: -->. Create a completely new version of the README that includes all the requested changes and write it to ${absoluteFilePath} using the fs_write tool. You MUST use fs_write to save the complete file content.`,
  );

  // Wait for Q to finish or user to terminate
  logger.info(
    chalk.yellow('\nAmazon Q is processing your instructions. This may take a few minutes.'),
  );
  logger.info(chalk.yellow('Press Ctrl+C to cancel at any time.'));

  // Set up a single SIGINT handler for the entire process
  const sigintHandler = () => {
    logger.warn('\nProcessing interrupted by user');
    qChat.terminate();
    process.exit(0);
  };

  // Use once to ensure the handler is only added once
  process.once('SIGINT', sigintHandler);

  try {
    // Execute the command and wait for it to complete
    await qChat.stop();
    logger.success('\nInstructions processed successfully.');
  } catch (error) {
    logger.error(
      `Error processing instructions: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
};
