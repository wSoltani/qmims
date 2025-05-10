import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { config } from './config';

// Define the structure for template metadata
export interface Template {
  name: string;
  path: string;
  isBuiltIn: boolean;
}

// Define built-in templates
const BUILT_IN_TEMPLATES: Template[] = [
  {
    name: 'basic',
    path: path.join(__dirname, '..', 'templates', 'basic.md'),
    isBuiltIn: true,
  },
  {
    name: 'detailed',
    path: path.join(__dirname, '..', 'templates', 'detailed.md'),
    isBuiltIn: true,
  },
  {
    name: 'minimal',
    path: path.join(__dirname, '..', 'templates', 'minimal.md'),
    isBuiltIn: true,
  },
  {
    name: 'library',
    path: path.join(__dirname, '..', 'templates', 'library.md'),
    isBuiltIn: true,
  },
  {
    name: 'service',
    path: path.join(__dirname, '..', 'templates', 'service.md'),
    isBuiltIn: true,
  },
];

// Get the path where custom templates are stored
const getCustomTemplatesPath = (): string => {
  const platform = process.platform;
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'qmims', 'templates');
  } else {
    return path.join(os.homedir(), '.config', 'qmims', 'templates');
  }
};

// Ensure the custom templates directory exists
const ensureCustomTemplatesDir = (): string => {
  const templatesDir = getCustomTemplatesPath();
  fs.ensureDirSync(templatesDir);
  return templatesDir;
};

// Get custom templates from the config
const getCustomTemplates = (): Template[] => {
  const customTemplates = (config.get('customTemplates') as Record<string, string>) || {};
  return Object.entries(customTemplates).map(([name, templatePath]) => ({
    name,
    path: templatePath,
    isBuiltIn: false,
  }));
};

// List all available templates (built-in and custom)
export const listTemplates = (): Template[] => {
  return [...BUILT_IN_TEMPLATES, ...getCustomTemplates()];
};

// Get a specific template by name
export const getTemplate = (name: string): Template | undefined => {
  return listTemplates().find((template) => template.name === name);
};

// Add a new custom template
export const addTemplate = async (name: string, sourcePath: string): Promise<void> => {
  // Validate the template name
  if (getTemplate(name)) {
    throw new Error(`Template with name '${name}' already exists`);
  }

  // Validate the source file exists
  if (!(await fs.pathExists(sourcePath))) {
    throw new Error(`Template source file '${sourcePath}' does not exist`);
  }

  // Get current custom templates
  const customTemplates = (config.get('customTemplates') as Record<string, string>) || {};

  // Store the template path in the config
  customTemplates[name] = sourcePath;
  config.set('customTemplates', customTemplates);
};

// Remove a custom template
export const removeTemplate = (name: string): void => {
  // Check if the template exists and is not built-in
  const template = getTemplate(name);
  if (!template) {
    throw new Error(`Template '${name}' does not exist`);
  }

  if (template.isBuiltIn) {
    throw new Error(`Cannot remove built-in template '${name}'`);
  }

  // Get current custom templates
  const customTemplates = (config.get('customTemplates') as Record<string, string>) || {};

  // Remove the template
  delete customTemplates[name];
  config.set('customTemplates', customTemplates);
};

// Get the content of a template
export const getTemplateContent = async (name: string): Promise<string> => {
  const template = getTemplate(name);
  if (!template) {
    throw new Error(`Template '${name}' does not exist`);
  }

  try {
    return await fs.readFile(template.path, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read template '${name}': ${error}`);
  }
};

// Initialize templates directory and built-in templates
export const initializeTemplates = async (): Promise<void> => {
  // Ensure custom templates directory exists
  ensureCustomTemplatesDir();

  // Verify that built-in templates are accessible
  for (const template of BUILT_IN_TEMPLATES) {
    await fs.pathExists(template.path);
  }
};
