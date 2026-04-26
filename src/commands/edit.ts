import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { Arguments, Argv } from 'yargs';
import { checkKiroCli, getKiroCliGuidance, KiroChatProcess } from '../utils/kiro-cli';
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

  const requestedFilePath = path.resolve(file);
  let targetFilePath = requestedFilePath;
  let projectPath = path.dirname(requestedFilePath);

  if (!fs.existsSync(requestedFilePath)) {
    const readmePath = await findReadmeFile(projectPath);

    if (!readmePath) {
      logger.error(
        `File '${requestedFilePath}' does not exist and no README.md was found in the directory.`,
      );
      process.exit(1);
      return;
    }

    targetFilePath = path.resolve(readmePath);
    projectPath = path.dirname(targetFilePath);

    logger.info(
      `Requested file not found. Using discovered README fallback: ${chalk.bold(targetFilePath)}`,
    );
  }

  if (dryRun) {
    logger.info(chalk.cyan('\n--- DRY RUN MODE - No changes will be made ---'));
    logger.info(`Requested file: ${chalk.bold(requestedFilePath)}`);
    logger.info(`File to edit: ${chalk.bold(targetFilePath)}`);

    logger.info(chalk.cyan('\nActions that would be taken:'));
    logger.info('- Would start Kiro CLI chat session');
    logger.info(`- Would add ${path.basename(targetFilePath)} to context`);
    logger.info('- Would prompt for permission before making changes (unless --yes is specified)');

    logger.info(chalk.cyan('\n--- End of dry run ---'));
    return;
  }

  const kiroCliStatus = await checkKiroCli(verbose);
  if (kiroCliStatus !== 'ready') {
    logger.error(getKiroCliGuidance(kiroCliStatus));
    process.exit(1);
    return;
  }

  const kiroChat = new KiroChatProcess(
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
          logger.error(`Kiro CLI process exited with code ${code}`);
        }
      },
    },
  );

  kiroChat.start();

  kiroChat.sendMessage(
    `I need you to edit the Markdown file at ${targetFilePath}. First, read the existing file. Then, find any embedded instructions in HTML comments that start with <!-- qmims: -->. Create an updated version of that file that includes all requested changes and write it back to ${targetFilePath} using the fs_write tool. You MUST use fs_write to save the complete file content.`,
  );

  logger.info(chalk.yellow('\nKiro is processing your instructions. This may take a few minutes.'));
  logger.info(chalk.yellow('Press Ctrl+C to cancel at any time.'));

  const sigintHandler = (): void => {
    logger.warn('\nProcessing interrupted by user');
    kiroChat.terminate();
    cleanupSigintHandler();
    process.exit(0);
  };

  const cleanupSigintHandler = (): void => {
    process.removeListener('SIGINT', sigintHandler);
  };

  process.once('SIGINT', sigintHandler);

  try {
    await kiroChat.stop();
    logger.success('\nInstructions processed successfully.');
  } catch (error) {
    logger.error(
      `Error processing instructions: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
    return;
  } finally {
    cleanupSigintHandler();
  }
};
