import fs from 'fs-extra';
import path from 'path';

/**
 * Find a README.md file in the given directory
 * @param dir Directory to search in
 * @returns Path to the README.md file, or null if not found
 */
export const findReadmeFile = async (dir: string): Promise<string | null> => {
  const files = await fs.readdir(dir);
  const readmeFile = files.find((file: string) => file.toLowerCase() === 'readme.md');
  return readmeFile ? path.join(dir, readmeFile) : null;
};

/**
 * Read a Markdown file
 * @param filePath Path to the Markdown file
 * @returns Content of the file
 */
export const readMarkdownFile = async (filePath: string): Promise<string> => {
  return fs.readFile(filePath, 'utf8');
};

/**
 * Write content to a Markdown file
 * @param filePath Path to the Markdown file
 * @param content Content to write
 */
export const writeMarkdownFile = async (filePath: string, content: string): Promise<void> => {
  return fs.writeFile(filePath, content, 'utf8');
};

/**
 * Interface for parsed instruction
 */
export interface Instruction {
  instruction: string;
  lineNumber: number;
  targetStart?: number;
  targetEnd?: number;
}

/**
 * Parse embedded instructions from Markdown content
 * @param content Markdown content
 * @returns Array of instructions with line numbers
 */
export const parseInstructions = (content: string): Instruction[] => {
  if (!content) {
    return [];
  }

  const lines = content.split('\n');
  const instructions: Instruction[] = [];
  const instructionRegex = /<!--\s*qmims:\s*(.*?)\s*-->/;

  lines.forEach((line, index) => {
    const match = line.match(instructionRegex);
    if (match && match[1]) {
      const instruction: Instruction = {
        instruction: match[1],
        lineNumber: index + 1,
      };

      let targetStart = -1;
      let targetEnd = -1;

      for (let i = index + 1; i < lines.length; i++) {
        if (lines[i].includes('<!-- qmims-target-start -->')) {
          targetStart = i + 1;
        } else if (lines[i].includes('<!-- qmims-target-end -->')) {
          targetEnd = i;
          break;
        }
      }

      if (targetStart !== -1 && targetEnd !== -1) {
        instruction.targetStart = targetStart;
        instruction.targetEnd = targetEnd;
      }

      instructions.push(instruction);
    }
  });

  return instructions;
};
