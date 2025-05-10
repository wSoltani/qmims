import { parseInstructions, extractTargetContent, Instruction } from '../utils/markdown';
import fs from 'fs-extra';
import path from 'path';

// Mock fs-extra
jest.mock('fs-extra', () => ({
  readdir: jest.fn().mockResolvedValue(['README.md']),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  existsSync: jest.fn(),
}));

describe('Markdown Utilities', () => {
  describe('parseInstructions', () => {
    test('should parse basic instructions', () => {
      const content = `# Test Document
      
<!-- qmims: This is an instruction -->

Some content here.

<!-- qmims: This is another instruction -->
`;
      
      const instructions = parseInstructions(content);
      
      expect(instructions).toHaveLength(2);
      expect(instructions[0].instruction).toBe('This is an instruction');
      expect(instructions[1].instruction).toBe('This is another instruction');
    });

    test('should handle instructions with target markers', () => {
      const content = `# Test Document
      
<!-- qmims: Summarize this content -->
<!-- qmims-target-start -->
This is the content to summarize.
It has multiple lines.
<!-- qmims-target-end -->

Some other content.
`;
      
      const instructions = parseInstructions(content);
      
      expect(instructions).toHaveLength(1);
      expect(instructions[0].instruction).toBe('Summarize this content');
      expect(instructions[0].targetStart).toBe(4);
      expect(instructions[0].targetEnd).toBe(6);
    });

    test('should return empty array for content without instructions', () => {
      const content = `# Test Document
      
No instructions here.
`;
      
      const instructions = parseInstructions(content);
      
      expect(instructions).toHaveLength(0);
    });

    test('should handle empty or undefined content', () => {
      expect(parseInstructions('')).toEqual([]);
      expect(parseInstructions(undefined as unknown as string)).toEqual([]);
    });
  });

  describe('extractTargetContent', () => {
    test('should extract content between target markers', () => {
      const content = `# Test Document
      
<!-- qmims: Summarize this content -->
<!-- qmims-target-start -->
This is the content to summarize.
It has multiple lines.
<!-- qmims-target-end -->

Some other content.
`;
      
      const instruction: Instruction = {
        instruction: 'Summarize this content',
        lineNumber: 3,
        targetStart: 4,
        targetEnd: 6,
      };
      
      const targetContent = extractTargetContent(content, instruction);
      
      expect(targetContent).toBe('This is the content to summarize.\nIt has multiple lines.');
    });

    test('should extract next paragraph when no target markers', () => {
      const content = `# Test Document
      
<!-- qmims: Summarize this content -->

This is the content to summarize.
It has multiple lines.

Some other content.
`;
      
      const instruction: Instruction = {
        instruction: 'Summarize this content',
        lineNumber: 3,
      };
      
      const targetContent = extractTargetContent(content, instruction);
      
      // Should extract the next paragraph after the instruction
      expect(targetContent).toContain('This is the content to summarize.');
      expect(targetContent).toContain('It has multiple lines.');
    });

    test('should extract content without instruction parameter', () => {
      const content = `# Test Document
      
<!-- qmims: Summarize this content -->
<!-- qmims-target-start -->
This is the content to summarize.
It has multiple lines.
<!-- qmims-target-end -->

Some other content.
`;
      
      const targetContent = extractTargetContent(content);
      
      expect(targetContent).toBe('This is the content to summarize.\nIt has multiple lines.');
    });

    test('should return null for content without target markers', () => {
      const content = `# Test Document
      
No target markers here.
`;
      
      const targetContent = extractTargetContent(content);
      
      expect(targetContent).toBeNull();
    });
  });

  describe('findReadmeFile', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should find README.md file in directory', async () => {
      const mockDirectory = '/test/dir';
      const expectedPath = path.join(mockDirectory, 'README.md');
      
      // Mock fs.readdir to return README.md
      (fs.readdir as jest.Mock).mockResolvedValue(['README.md', 'other.txt']);
      
      const result = await require('../utils/markdown').findReadmeFile(mockDirectory);
      
      expect(result).toBe(expectedPath);
      expect(fs.readdir).toHaveBeenCalledWith(mockDirectory);
    });

    test('should return null if README.md does not exist', async () => {
      const mockDirectory = '/test/dir';
      
      // Mock fs.readdir to return no README.md
      (fs.readdir as jest.Mock).mockResolvedValue(['other.txt', 'index.js']);
      
      const result = await require('../utils/markdown').findReadmeFile(mockDirectory);
      
      expect(result).toBeNull();
      expect(fs.readdir).toHaveBeenCalledWith(mockDirectory);
    });
  });

  describe('readMarkdownFile and writeMarkdownFile', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('readMarkdownFile should read file content', async () => {
      const mockPath = '/test/file.md';
      const mockContent = '# Test Content';
      
      (fs.readFile as jest.Mock).mockResolvedValue(mockContent);
      
      const result = await require('../utils/markdown').readMarkdownFile(mockPath);
      
      expect(result).toBe(mockContent);
      expect(fs.readFile).toHaveBeenCalledWith(mockPath, 'utf8');
    });

    test('writeMarkdownFile should write content to file', async () => {
      const mockPath = '/test/file.md';
      const mockContent = '# Test Content';
      
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      
      await require('../utils/markdown').writeMarkdownFile(mockPath, mockContent);
      
      expect(fs.writeFile).toHaveBeenCalledWith(mockPath, mockContent, 'utf8');
    });
  });
});