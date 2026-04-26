import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import prompts from 'prompts';
import { Arguments, Argv } from 'yargs';
import { config } from '../utils/config';
import { checkKiroCli, getKiroCliGuidance, KiroChatProcess } from '../utils/kiro-cli';
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
    dryRun = false,
    verbose = false,
  } = argv;

  const yes =
    typeof argv.yes === 'boolean' ? argv.yes : config.get<boolean>('q.autoApproveEdits') || false;

  const logger = new Logger(verbose);
  const absoluteProjectPath = path.resolve(projectPath);

  if (!fs.existsSync(absoluteProjectPath)) {
    logger.error(`Project directory '${absoluteProjectPath}' does not exist`);
    process.exit(1);
    return;
  }

  if (listAvailableTemplates) {
    if (!mode.startsWith('template')) {
      logger.warn('Note: --list-available-templates is only relevant with --mode template');
    }

    logger.info(chalk.bold('\nAvailable Templates:'));
    const templates = listTemplates();

    logger.info(chalk.cyan('\nBuilt-in Templates:'));
    templates
      .filter((template) => template.isBuiltIn)
      .forEach((template) => logger.info(`  - ${template.name}`));

    logger.info(chalk.cyan('\nCustom Templates:'));
    const customTemplates = templates.filter((template) => !template.isBuiltIn);
    if (customTemplates.length === 0) {
      logger.info('  No custom templates found');
    } else {
      customTemplates.forEach((template) => logger.info(`  - ${template.name}`));
    }

    logger.info('\nUse: qmims generate --mode template:TEMPLATE_NAME');
    return;
  }

  if (!dryRun) {
    const kiroCliStatus = await checkKiroCli(verbose);
    if (kiroCliStatus !== 'ready') {
      logger.error(getKiroCliGuidance(kiroCliStatus));
      process.exit(1);
      return;
    }
  }

  const [modeType, modeValue] = mode.includes(':') ? mode.split(':', 2) : [mode, undefined];

  if (!['auto', 'template', 'instruct'].includes(modeType)) {
    logger.error(`Invalid mode '${modeType}'. Must be 'auto', 'template', or 'instruct'`);
    process.exit(1);
    return;
  }

  const outputFilePath = path.join(absoluteProjectPath, output);
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

  if (dryRun) {
    logger.info(chalk.cyan('\n--- DRY RUN MODE - No changes will be made ---'));
    logger.info(`Project directory: ${chalk.bold(absoluteProjectPath)}`);
    logger.info(`Output file: ${chalk.bold(outputFilePath)}`);
    logger.info(`Mode: ${chalk.bold(modeType)}${modeValue ? `:${modeValue}` : ''}`);
    logger.info(`File exists: ${chalk.bold(fileExists ? 'Yes' : 'No')}`);
    logger.info(`Auto-approve enabled: ${chalk.bold(yes ? 'Yes' : 'No')}`);

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

    if (fileExists && !force && !yes) {
      logger.info('- Would prompt to overwrite existing file');
    }

    logger.info(
      `- Would ${fileExists ? 'overwrite' : 'create'} file: ${chalk.bold(outputFilePath)}`,
    );
    logger.info('- Would start Kiro CLI chat session');
    logger.info(
      '- Would run Kiro with trust-all-tools enabled (required for non-interactive mode)',
    );

    if (modeType === 'auto') {
      logger.info('- Would ask Kiro to analyze the project and generate README content');
    } else if (modeType === 'template') {
      logger.info(`- Would use ${modeValue || 'default'} template to structure README`);
      logger.info('- Would ask Kiro to fill in the template sections');
    } else if (modeType === 'instruct') {
      if (modeValue) {
        logger.info(
          `- Would read embedded instructions from: ${chalk.bold(path.resolve(modeValue))}`,
        );
        logger.info('- Would combine all parsed qmims instructions into one structured prompt');
      } else {
        logger.info(
          `- Would read embedded instructions from the output file: ${chalk.bold(outputFilePath)}`,
        );
        logger.info('- Would combine all parsed qmims instructions into one structured prompt');
      }
    }

    logger.info(chalk.cyan('\n--- End of dry run ---'));
    return;
  }

  try {
    if (modeType === 'auto') {
      await generateAuto(absoluteProjectPath, outputFilePath, { yes, verbose, logger });
    } else if (modeType === 'template') {
      await generateTemplate(absoluteProjectPath, outputFilePath, modeValue, {
        yes,
        verbose,
        logger,
      });
    } else {
      await generateInstruct(absoluteProjectPath, outputFilePath, modeValue, {
        yes,
        verbose,
        logger,
      });
    }

    logger.success('\nThank you for using qmims!');
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

async function generateAuto(
  projectPath: string,
  outputPath: string,
  options: { yes: boolean; verbose: boolean; logger: Logger },
): Promise<void> {
  const { logger } = options;
  logger.info(chalk.cyan('Generating README in auto mode...'));

  const initialContent = '# Project README\n\n<!-- Generated by qmims -->\n';
  await writeMarkdownFile(outputPath, initialContent);

  const prompt = [
    `Please analyze the project in the current working directory and generate a comprehensive Markdown README.`,
    `Write the complete final README content to ${outputPath}.`,
    `Include sections for project overview, installation, usage, and any other relevant information supported by the project structure and code.`,
    `Use the file system tools needed to save the complete README content.`,
  ].join(' ');

  await runKiroPrompt(
    projectPath,
    prompt,
    {
      yes: options.yes,
      verbose: options.verbose,
    },
    {
      logger,
      progressMessage: '\nKiro is generating your README. This may take a few minutes.',
      successMessage: '\nSuccessfully generated README.md',
      failurePrefix: 'Error generating README',
      interruptMessage: '\nGeneration interrupted by user',
    },
  );
}

async function generateTemplate(
  projectPath: string,
  outputPath: string,
  templateName: string | undefined,
  options: { yes: boolean; verbose: boolean; logger: Logger },
): Promise<void> {
  const { logger } = options;

  if (options.verbose) {
    logger.debug('Starting generateTemplate function');
  }

  const defaultTemplateName = config.get<string>('defaults.templateName') || 'basic';
  const finalTemplateName = templateName || defaultTemplateName;

  logger.info(chalk.cyan(`Generating README using template: ${finalTemplateName}...`));

  const template = getTemplate(finalTemplateName);
  if (!template) {
    throw new Error(`Template '${finalTemplateName}' not found`);
  }

  if (options.verbose) {
    logger.debug(`Found template: ${template.name}`);
  }

  const templateContent = await getTemplateContent(finalTemplateName);
  await writeMarkdownFile(outputPath, templateContent);

  const prompt = [
    `A README template has already been written to ${outputPath}.`,
    `Please analyze the project in the current working directory, fill in every relevant section of that template, and preserve the template structure.`,
    `Write the complete final README content back to ${outputPath}.`,
    `Use the file system tools needed to save the full file.`,
  ].join(' ');

  await runKiroPrompt(
    projectPath,
    prompt,
    {
      yes: options.yes,
      verbose: options.verbose,
    },
    {
      logger,
      progressMessage: '\nKiro is filling in your template. This may take a few minutes.',
      successMessage: '\nTemplate filling completed successfully.',
      failurePrefix: 'Error filling template',
      interruptMessage: '\nGeneration interrupted by user',
    },
  );
}

async function generateInstruct(
  projectPath: string,
  outputPath: string,
  instructFile: string | undefined,
  options: { yes: boolean; verbose: boolean; logger: Logger },
): Promise<void> {
  const { logger } = options;

  let instructFilePath: string;
  if (instructFile) {
    instructFilePath = path.resolve(instructFile);
    if (!fs.existsSync(instructFilePath)) {
      throw new Error(`Instruction file '${instructFile}' not found`);
    }
  } else {
    instructFilePath = outputPath;
  }

  logger.info(
    chalk.cyan(`Generating README using instructions from: ${path.basename(instructFilePath)}...`),
  );

  const fileContent = await readMarkdownFile(instructFilePath);
  const instructions = parseInstructions(fileContent);

  if (instructions.length === 0) {
    throw new Error(
      `No embedded instructions found in '${path.basename(instructFilePath)}'. Add instructions using <!-- qmims: ... --> syntax.`,
    );
  }

  logger.info(`Found ${instructions.length} instruction${instructions.length === 1 ? '' : 's'}:`);
  instructions.forEach((instruction, index) => {
    logger.info(
      `  ${index + 1}. ${instruction.instruction.substring(0, 100)}${instruction.instruction.length > 100 ? '...' : ''}`,
    );
  });

  if (!fs.existsSync(outputPath) || instructFilePath !== outputPath) {
    const initialContent = '# Project README\n\n<!-- Generated by qmims -->\n';
    await writeMarkdownFile(outputPath, initialContent);
  }

  const structuredInstructions = instructions
    .map((instruction, index) => {
      const locationParts = [`line ${instruction.lineNumber}`];
      if (
        typeof instruction.targetStart === 'number' &&
        typeof instruction.targetEnd === 'number'
      ) {
        locationParts.push(`target lines ${instruction.targetStart}-${instruction.targetEnd}`);
      }

      return [
        `${index + 1}. ${instruction.instruction}`,
        `   Source location: ${locationParts.join(', ')}`,
      ].join('\n');
    })
    .join('\n');

  const prompt = [
    `Update the Markdown README at ${outputPath}.`,
    `Use ALL of the embedded qmims instructions discovered from ${instructFilePath}.`,
    `Every instruction below must materially influence the final result.`,
    `If any instructions overlap, reconcile them into one coherent final README rather than ignoring any of them.`,
    `Read the existing file content before editing, then write the complete final file back to ${outputPath}.`,
    `Use the file system tools needed to save the full file.`,
    ``,
    `Instructions:`,
    structuredInstructions,
  ].join('\n');

  await runKiroPrompt(
    projectPath,
    prompt,
    {
      yes: options.yes,
      verbose: options.verbose,
    },
    {
      logger,
      progressMessage: '\nKiro is processing your instructions. This may take a few minutes.',
      successMessage: '\nInstruction processing completed successfully.',
      failurePrefix: 'Error processing instructions',
      interruptMessage: '\nProcessing interrupted by user',
    },
  );
}

async function runKiroPrompt(
  cwd: string,
  prompt: string,
  options: { yes: boolean; verbose: boolean },
  messages: {
    logger: Logger;
    progressMessage: string;
    successMessage: string;
    failurePrefix: string;
    interruptMessage: string;
  },
): Promise<void> {
  const { logger } = messages;

  const kiroChat = new KiroChatProcess(
    {
      cwd,
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
          logger.error(`Kiro CLI process exited with code ${code}`);
        }
      },
    },
  );

  kiroChat.start();
  kiroChat.sendMessage(prompt);

  logger.info(chalk.yellow(messages.progressMessage));
  logger.info(chalk.yellow('Press Ctrl+C to cancel at any time.'));

  const sigintHandler = () => {
    logger.warn(messages.interruptMessage);
    kiroChat.terminate();
    process.exit(0);
  };

  process.once('SIGINT', sigintHandler);

  try {
    await kiroChat.stop();
    logger.success(messages.successMessage);
  } catch (error) {
    logger.error(
      `${messages.failurePrefix}: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  } finally {
    process.removeListener('SIGINT', sigintHandler);
  }
}
