import path from 'path';
import chalk from 'chalk';
import { Arguments, Argv } from 'yargs';
import { listTemplates, getTemplate, getTemplateContent, addTemplate, removeTemplate } from '../utils/templates';
import { Logger } from '../utils/logger';

export interface TemplatesOptions {
  _: (string | number)[];
  $0: string;
  templateName?: string;
  templatePath?: string;
  verbose?: boolean;
  action?: string;
}

export const command = 'templates';
export const desc = 'Manage README templates';

export const builder = (yargs: Argv): Argv<TemplatesOptions> => {
  return yargs
    .command(
      'list',
      'List available templates',
      (yargs) => yargs
        .option('verbose', {
          describe: 'Show verbose output',
          type: 'boolean',
          default: false,
        }),
      (argv) => handler({ ...argv, action: 'list' }),
    )
    .command(
      'add <templateName> <templatePath>',
      'Add a custom template',
      (yargs) => {
        return yargs
          .positional('templateName', {
            describe: 'Name for the template',
            type: 'string',
            demandOption: true,
          })
          .positional('templatePath', {
            describe: 'Path to the template file',
            type: 'string',
            demandOption: true,
          })
          .option('verbose', {
            describe: 'Show verbose output',
            type: 'boolean',
            default: false,
          });
      },
      (argv) => handler({ ...argv, action: 'add' }),
    )
    .command(
      'remove <templateName>',
      'Remove a custom template',
      (yargs) => {
        return yargs
          .positional('templateName', {
            describe: 'Name of the template to remove',
            type: 'string',
            demandOption: true,
          })
          .option('verbose', {
            describe: 'Show verbose output',
            type: 'boolean',
            default: false,
          });
      },
      (argv) => handler({ ...argv, action: 'remove' }),
    )
    .command(
      'show <templateName>',
      'Show a template',
      (yargs) => {
        return yargs
          .positional('templateName', {
            describe: 'Name of the template to show',
            type: 'string',
            demandOption: true,
          })
          .option('verbose', {
            describe: 'Show verbose output',
            type: 'boolean',
            default: false,
          });
      },
      (argv) => handler({ ...argv, action: 'show' }),
    )
    .demandCommand(1, 'You must specify a command')
    .help();
};

export const handler = async (argv: Arguments<TemplatesOptions>): Promise<void> => {
  const { action, templateName, templatePath, verbose = false } = argv;
  const logger = new Logger(verbose);

  try {
    switch (action) {
      case 'list': {
        const templates = listTemplates();
        
        logger.info(chalk.bold('\nAvailable Templates:'));
        
        logger.info(chalk.cyan('\nBuilt-in Templates:'));
        templates
          .filter(t => t.isBuiltIn)
          .forEach(t => logger.info(`  - ${t.name}`));
        
        logger.info(chalk.cyan('\nCustom Templates:'));
        const customTemplates = templates.filter(t => !t.isBuiltIn);
        if (customTemplates.length === 0) {
          logger.info('  No custom templates found');
        } else {
          customTemplates.forEach(t => logger.info(`  - ${t.name}`));
        }
        
        logger.info('\nUse: qmims generate --mode template:TEMPLATE_NAME');
        break;
      }
      case 'add': {
        if (!templateName || !templatePath) {
          logger.error('Template name and path are required');
          process.exit(1);
        }
        
        const absoluteTemplatePath = path.resolve(templatePath);
        addTemplate(templateName, absoluteTemplatePath);
        logger.success(`Added template '${templateName}' from ${absoluteTemplatePath}`);
        break;
      }
      case 'remove': {
        if (!templateName) {
          logger.error('Template name is required');
          process.exit(1);
        }
        
        removeTemplate(templateName);
        logger.success(`Removed template '${templateName}'`);
        break;
      }
      case 'show': {
        if (!templateName) {
          logger.error('Template name is required');
          process.exit(1);
        }
        
        const template = getTemplate(templateName);
        if (!template) {
          logger.error(`Template '${templateName}' not found`);
          process.exit(1);
        }
        
        const content = await getTemplateContent(templateName);
        logger.info(chalk.bold(`\nTemplate: ${templateName}`));
        logger.info(chalk.cyan(`Type: ${template.isBuiltIn ? 'Built-in' : 'Custom'}`));
        if (!template.isBuiltIn) {
          logger.info(chalk.cyan(`Path: ${template.path}`));
        }
        logger.info(chalk.cyan('\nContent:'));
        logger.info(content);
        break;
      }
      default: {
        logger.error(`Unknown command: ${command}`);
        process.exit(1);
      }
    }
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};