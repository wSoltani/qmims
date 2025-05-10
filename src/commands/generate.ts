import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import prompts from 'prompts';
import { Arguments, Argv } from 'yargs';
import { config } from '../utils/config';
import { checkQCli, getQCliInstallInstructions, QChatProcess } from '../utils/q-cli';
import { parseInstructions, readMarkdownFile, writeMarkdownFile } from '../utils/markdown';
import { getTemplate, getTemplateContent, listTemplates } from '../utils/templates';
import { Logger } from '../utils/logger';

export interface GenerateOptions {
  _: (string | number)[];
  $0: string;
  path?: string;
  output?: string;
  mode?: string;
  force?: boolean;
  listAvailableTemplates?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

export const command = 'generate [path]';
export const desc = 'Generate a README.md file for a project';

export const builder = (yargs: Argv): Argv<GenerateOptions> => {
  return yargs
    .positional('path', {
      describe: 'Path to the project directory',
      type: 'string',
      default: '.',
    })
    .option('output', {
      alias: 'o',
      describe: 'Output file name',
      type: 'string',
      default: config.get('defaults.outputFileName'),
    })
    .option('mode', {
      alias: 'm',
      describe: 'Generation mode: auto, template[:name], or instruct[:file]',
      type: 'string',
      default: config.get('defaults.mode'),
    })
    .option('force', {
      alias: 'f',
      describe: 'Force overwrite if file exists',
      type: 'boolean',
      default: false,
    })
    .option('list-available-templates', {
      describe: 'List available templates',
      type: 'boolean',
      default: false,
    })
    .option('yes', {
      alias: 'y',
      describe: 'Automatically approve all permission requests',
      type: 'boolean',
      default: config.get('q.autoApproveEdits'),
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

export const handler = async (argv: Arguments<GenerateOptions>): Promise<void> => {
  const {
    path: projectPath = '.',
    output = 'README.md',
    mode = 'auto',
    force = false,
    listAvailableTemplates = false,
    yes = false,
    dryRun = false,
    verbose = false,
  } = argv;

  const logger = new Logger(verbose);

  // Resolve the absolute project path
  const absoluteProjectPath = path.resolve(projectPath);

  // Check if the project directory exists
  if (!fs.existsSync(absoluteProjectPath)) {
    logger.error(`Project directory '${absoluteProjectPath}' does not exist`);
    process.exit(1);
  }

  // If --list-available-templates is specified, list templates and exit
  if (listAvailableTemplates) {
    if (!mode.startsWith('template')) {
      logger.warn('Note: --list-available-templates is only relevant with --mode template');
    }

    logger.info(chalk.bold('\nAvailable Templates:'));
    const templates = listTemplates();

    logger.info(chalk.cyan('\nBuilt-in Templates:'));
    templates.filter((t) => t.isBuiltIn).forEach((t) => logger.info(`  - ${t.name}`));

    logger.info(chalk.cyan('\nCustom Templates:'));
    const customTemplates = templates.filter((t) => !t.isBuiltIn);
    if (customTemplates.length === 0) {
      logger.info('  No custom templates found');
    } else {
      customTemplates.forEach((t) => logger.info(`  - ${t.name}`));
    }

    logger.info('\nUse: qmims generate --mode template:TEMPLATE_NAME');
    return;
  }

  // Check if Amazon Q CLI is installed and authenticated
  if (!dryRun) {
    const qCliAvailable = await checkQCli();
    if (!qCliAvailable) {
      logger.error(getQCliInstallInstructions());
      process.exit(1);
    }
  }

  // Parse the mode option
  let [modeType, modeValue] = mode.includes(':') ? mode.split(':') : [mode, undefined];

  if (!['auto', 'template', 'instruct'].includes(modeType)) {
    logger.error(`Invalid mode '${modeType}'. Must be 'auto', 'template', or 'instruct'`);
    process.exit(1);
  }

  // Determine the output file path
  const outputFilePath = path.join(absoluteProjectPath, output);

  // Check if the output file already exists
  const fileExists = fs.existsSync(outputFilePath);
  if (fileExists && !force && !dryRun && !yes) {
    const response = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `File '${output}' already exists. Overwrite?`,
      initial: false,
    });

    if (!response.overwrite) {
      logger.warn('Generation cancelled');
      return;
    }
  } else if (fileExists && !force && !dryRun && yes) {
    logger.info(`File '${output}' already exists. Overwriting automatically due to --yes flag.`);
  }

  // Handle dry run mode
  if (dryRun) {
    logger.info(chalk.cyan('\n--- DRY RUN MODE - No changes will be made ---'));
    logger.info(`Project directory: ${chalk.bold(absoluteProjectPath)}`);
    logger.info(`Output file: ${chalk.bold(outputFilePath)}`);
    logger.info(`Mode: ${chalk.bold(modeType)}${modeValue ? `:${modeValue}` : ''}`);
    logger.info(`File exists: ${chalk.bold(fileExists ? 'Yes' : 'No')}`);

    if (modeType === 'template' && modeValue) {
      const template = getTemplate(modeValue);
      if (template) {
        logger.info(
          `Template: ${chalk.bold(template.name)} (${template.isBuiltIn ? 'built-in' : 'custom'})`,
        );
      } else {
        logger.error(`Template '${modeValue}' not found`);
      }
    }

    logger.info(chalk.cyan('\nActions that would be taken:'));

    if (fileExists && !force) {
      logger.info('- Would prompt to overwrite existing file');
    }

    logger.info(
      `- Would ${fileExists ? 'overwrite' : 'create'} file: ${chalk.bold(outputFilePath)}`,
    );
    logger.info('- Would start Amazon Q chat session');

    if (modeType === 'auto') {
      logger.info('- Would ask Amazon Q to analyze project and generate README');
    } else if (modeType === 'template') {
      logger.info(`- Would use ${modeValue || 'default'} template to structure README`);
      logger.info('- Would ask Amazon Q to fill in template sections');
    } else if (modeType === 'instruct') {
      if (modeValue) {
        logger.info(`- Would process instructions in ${modeValue}`);
      } else {
        logger.info('- Would create README with default instruction');
      }
    }

    logger.info(chalk.cyan('\n--- End of dry run ---'));
    return;
  }

  // Handle different generation modes
  try {
    if (modeType === 'auto') {
      await generateAuto(absoluteProjectPath, outputFilePath, { yes, verbose, logger });
    } else if (modeType === 'template') {
      await generateTemplate(absoluteProjectPath, outputFilePath, modeValue, {
        yes,
        verbose,
        logger,
      });
    } else if (modeType === 'instruct') {
      await generateInstruct(absoluteProjectPath, outputFilePath, modeValue, {
        yes,
        verbose,
        logger,
      });
    }

    logger.success(`\nThank you for using qmims!`);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

/**
 * Generate README in auto mode
 */
async function generateAuto(
  projectPath: string,
  outputPath: string,
  options: { yes: boolean; verbose: boolean; logger: Logger },
): Promise<void> {
  const { logger } = options;
  logger.info(chalk.cyan('Generating README in auto mode...'));

  // Create initial README content
  const initialContent = '# Project README\n\n<!-- Generated by qmims -->\n';
  await writeMarkdownFile(outputPath, initialContent);

  // Set up Q Chat process
  let qChatOutput = '';

  const qChat = new QChatProcess(
    {
      cwd: projectPath,
      verbose: options.verbose,
      autoApprove: options.yes,
    },
    {
      onOutput: (text) => {
        if (options.verbose) {
          logger.debug(text);
        }
        qChatOutput += text;
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

  // Start Q Chat process
  if (options.verbose) {
    logger.debug('Starting Q Chat process');
  }
  qChat.start();

  // Send prompt to generate README with completion marker
  qChat.sendMessage(
    'Please analyze this project and generate a comprehensive README.md file. Include sections for project overview, installation, usage, and any other relevant information based on the project structure and code.',
  );

  // Wait for Q to finish or user to terminate
  logger.info(chalk.yellow('\nAmazon Q is generating your README. This may take a few minutes.'));
  logger.info(chalk.yellow('Press Ctrl+C to cancel at any time.'));

  // Set up a single SIGINT handler for the entire process
  const sigintHandler = () => {
    logger.warn('\nGeneration interrupted by user');
    qChat.terminate();
    process.exit(0);
  };

  // Use once to ensure the handler is only added once
  process.once('SIGINT', sigintHandler);

  try {
    // Execute the command and wait for it to complete
    await qChat.stop();
    logger.success('\nSuccessfully generated README.md');
  } catch (error) {
    logger.error(
      `Error generating README: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Generate README using a template
 */
async function generateTemplate(
  projectPath: string,
  outputPath: string,
  templateName: string | undefined,
  options: { yes: boolean; verbose: boolean; logger: Logger },
): Promise<void> {
  const { logger } = options;

  // Log function start if in verbose mode
  if (options.verbose) {
    logger.debug('Starting generateTemplate function');
  }

  const defaultTemplateName = config.get('defaults.templateName') || 'basic';
  const finalTemplateName = templateName || defaultTemplateName;

  logger.info(chalk.cyan(`Generating README using template: ${finalTemplateName}...`));

  // Get the template
  const template = getTemplate(finalTemplateName);
  if (!template) {
    throw new Error(`Template '${finalTemplateName}' not found`);
  }

  if (options.verbose) {
    logger.debug(`Found template: ${template.name}`);
  }

  // Get template content
  const templateContent = await getTemplateContent(finalTemplateName);

  // Write template content to output file
  await writeMarkdownFile(outputPath, templateContent);

  // Set up Q Chat process
  const qChat = new QChatProcess(
    {
      cwd: projectPath,
      verbose: options.verbose,
      autoApprove: options.yes,
    },
    {
      onOutput: (text) => {
        if (options.verbose) {
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

  // Start Q Chat process
  qChat.start();

  // Send prompt to fill in template with completion marker
  qChat.sendMessage(
    "I've created a README.md file with a template structure. Please analyze this project and fill in the content for each section in the template. The template includes comments with instructions for each section.",
  );

  // Wait for Q to finish or user to terminate
  logger.info(chalk.yellow('\nAmazon Q is filling in your template. This may take a few minutes.'));
  logger.info(chalk.yellow('Press Ctrl+C to cancel at any time.'));

  // Set up a single SIGINT handler for the entire process
  const sigintHandler = () => {
    logger.warn('\nGeneration interrupted by user');
    qChat.terminate();
    process.exit(0);
  };

  // Use once to ensure the handler is only added once
  process.once('SIGINT', sigintHandler);

  try {
    // Execute the command and wait for it to complete
    await qChat.stop();
    logger.success('\nTemplate filling completed successfully.');
  } catch (error) {
    logger.error(
      `Error filling template: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Generate README using instruct mode
 */
async function generateInstruct(
  projectPath: string,
  outputPath: string,
  instructFile: string | undefined,
  options: { yes: boolean; verbose: boolean; logger: Logger },
): Promise<void> {
  const { logger } = options;

  // Determine the instruction file path
  let instructFilePath: string;
  if (instructFile) {
    instructFilePath = path.resolve(instructFile);
    if (!fs.existsSync(instructFilePath)) {
      throw new Error(`Instruction file '${instructFile}' not found`);
    }
  } else {
    // Use the README.md itself as the instruction file
    instructFilePath = outputPath;
  }

  logger.info(
    chalk.cyan(`Generating README using instructions from: ${path.basename(instructFilePath)}...`),
  );

  // Read the instruction file
  const fileContent = await readMarkdownFile(instructFilePath);

  // Parse instructions from the file
  const instructions = parseInstructions(fileContent);

  if (instructions.length === 0) {
    throw new Error(
      `No embedded instructions found in '${path.basename(instructFilePath)}'. Add instructions using <!-- qmims: ... --> syntax.`,
    );
  }

  logger.info(`Found ${instructions.length} instruction${instructions.length === 1 ? '' : 's'}:`);
  instructions.forEach((instr, index) => {
    logger.info(
      `  ${index + 1}. ${instr.instruction.substring(0, 100)}${instr.instruction.length > 100 ? '...' : ''}`,
    );
  });

  // Create initial README content if it doesn't exist
  if (!fs.existsSync(outputPath) || instructFilePath !== outputPath) {
    const initialContent = '# Project README\n\n<!-- Generated by qmims -->\n';
    await writeMarkdownFile(outputPath, initialContent);
  }

  // Set up Q Chat process
  const qChat = new QChatProcess(
    {
      cwd: projectPath,
      verbose: options.verbose,
      autoApprove: options.yes,
    },
    {
      onOutput: (text) => {
        if (options.verbose) {
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

  // Start Q Chat process
  qChat.start();

  // Send prompt to process instructions with completion marker
  qChat.sendMessage(
    `I have a README.md file that I'd like you to edit based on the following instructions: ${instructions[0].instruction}.`,
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
    logger.success('\nInstruction processing completed successfully.');
  } catch (error) {
    logger.error(
      `Error processing instructions: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
