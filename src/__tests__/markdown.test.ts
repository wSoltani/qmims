import * as fs from 'fs-extra';
import path from 'path';
import {
  findReadmeFile,
  readMarkdownFile,
  writeMarkdownFile,
  createReadmeFile,
  parseInstructions,
  extractTargetContent,
  Instruction
} from '../utils/markdown';

// Mock fs-extra and path modules
jest.mock('fs-extra', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
  ensureDir: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

describe('Markdown Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findReadmeFile', () => {
    test('should find README.md in directory', async () => {
      const mockFiles = ['file1.js', 'README.md', 'file2.js'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);
      (path.join as jest.Mock).mockReturnValue('/test/dir/README.md');

      const result = await findReadmeFile('/test/dir');
      
      expect(fs.readdir).toHaveBeenCalledWith('/test/dir');
      expect(path.join).toHaveBeenCalledWith('/test/dir', 'README.md');
      expect(result).toBe('/test/dir/README.md');
    });

    test('should find readme.md with different case', async () => {
      const mockFiles = ['file1.js', 'readme.md', 'file2.js'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);
      (path.join as jest.Mock).mockReturnValue('/test/dir/readme.md');

      const result = await findReadmeFile('/test/dir');
      
      expect(fs.readdir).toHaveBeenCalledWith('/test/dir');
      expect(path.join).toHaveBeenCalledWith('/test/dir', 'readme.md');
      expect(result).toBe('/test/dir/readme.md');
    });

    test('should return null if README.md not found', async () => {
      const mockFiles = ['file1.js', 'file2.js'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);

      const result = await findReadmeFile('/test/dir');
      
      expect(fs.readdir).toHaveBeenCalledWith('/test/dir');
      expect(result).toBeNull();
    });
  });

  describe('readMarkdownFile', () => {
    test('should read markdown file content', async () => {
      const mockContent = '# Test Markdown';
      (fs.readFile as jest.Mock).mockResolvedValue(mockContent);

      const result = await readMarkdownFile('/test/file.md');
      
      expect(fs.readFile).toHaveBeenCalledWith('/test/file.md', 'utf8');
      expect(result).toBe(mockContent);
    });

    test('should propagate errors', async () => {
      const error = new Error('File not found');
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      await expect(readMarkdownFile('/test/file.md')).rejects.toThrow('File not found');
      expect(fs.readFile).toHaveBeenCalledWith('/test/file.md', 'utf8');
    });
  });

  describe('writeMarkdownFile', () => {
    test('should write content to markdown file', async () => {
      const content = '# Test Markdown';
      
      await writeMarkdownFile('/test/file.md', content);
      
      expect(fs.writeFile).toHaveBeenCalledWith('/test/file.md', content, 'utf8');
    });

    test('should propagate errors', async () => {
      const error = new Error('Permission denied');
      const content = '# Test Markdown';
      (fs.writeFile as jest.Mock).mockRejectedValue(error);

      await expect(writeMarkdownFile('/test/file.md', content)).rejects.toThrow('Permission denied');
      expect(fs.writeFile).toHaveBeenCalledWith('/test/file.md', content, 'utf8');
    });
  });

  describe('createReadmeFile', () => {
    test('should create a default README.md file', async () => {
      (path.join as jest.Mock).mockReturnValue('/test/dir/README.md');
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await createReadmeFile('/test/dir');
      
      expect(path.join).toHaveBeenCalledWith('/test/dir', 'README.md');
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/dir/README.md',
        expect.stringContaining('# Project README'),
        'utf8'
      );
      expect(result).toBe('/test/dir/README.md');
    });
  });

  describe('parseInstructions', () => {
    test('should parse instructions from markdown content', () => {
      const content = `# Test Markdown

<!-- qmims: Instruction 1 -->

Some content

<!-- qmims: Instruction 2 -->
`;
      
      const result = parseInstructions(content);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        instruction: 'Instruction 1',
        lineNumber: 3
      });
      expect(result[1]).toEqual({
        instruction: 'Instruction 2',
        lineNumber: 7
      });
    });

    test('should parse instructions with target markers', () => {
      const content = `# Test Markdown

<!-- qmims: Instruction with targets -->

<!-- qmims-target-start -->
Target content line 1
Target content line 2
<!-- qmims-target-end -->
`;
      
      const result = parseInstructions(content);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        instruction: 'Instruction with targets',
        lineNumber: 3,
        targetStart: 5,
        targetEnd: 7
      });
    });

    test('should return empty array for empty content', () => {
      expect(parseInstructions('')).toEqual([]);
      expect(parseInstructions(null as unknown as string)).toEqual([]);
    });

    test('should ignore non-qmims comments', () => {
      const content = `# Test Markdown

<!-- This is a regular comment -->

<!-- qmims: Actual instruction -->
`;
      
      const result = parseInstructions(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].instruction).toBe('Actual instruction');
    });
  });

  describe('extractTargetContent', () => {
    test('should extract content using instruction with target markers', () => {
      const content = `# Test Markdown

<!-- qmims: Instruction -->

<!-- qmims-target-start -->
Target content line 1
Target content line 2
<!-- qmims-target-end -->
`;
      
      const instruction: Instruction = {
        instruction: 'Instruction',
        lineNumber: 3,
        targetStart: 5,
        targetEnd: 7
      };
      
      const result = extractTargetContent(content, instruction);
      
      expect(result).toBe('Target content line 1\nTarget content line 2');
    });

    test('should extract content using target markers in content', () => {
      const content = `# Test Markdown

<!-- qmims: Instruction -->

<!-- qmims-target-start -->
Target content line 1
Target content line 2
<!-- qmims-target-end -->
`;
      
      const result = extractTargetContent(content);
      
      expect(result).toBe('Target content line 1\nTarget content line 2');
    });

    test('should extract paragraph after instruction if no target markers', () => {
      const content = `# Test Markdown

<!-- qmims: Instruction -->
This is the paragraph
that follows the instruction.

This is a different paragraph.
`;
      
      const instruction: Instruction = {
        instruction: 'Instruction',
        lineNumber: 3
      };
      
      const result = extractTargetContent(content, instruction);
      
      expect(result).toBe('This is the paragraph\nthat follows the instruction.');
    });

    test('should return null for empty content', () => {
      expect(extractTargetContent('')).toBeNull();
      expect(extractTargetContent(null as unknown as string)).toBeNull();
    });

    test('should return null if no target markers or instruction found', () => {
      const content = `# Test Markdown

No instructions or target markers here.
`;
      
      expect(extractTargetContent(content)).toBeNull();
    });

    test('should return null if target markers are invalid', () => {
      const content = `# Test Markdown

<!-- qmims-target-end -->
Content in wrong order
<!-- qmims-target-start -->
`;
      
      expect(extractTargetContent(content)).toBeNull();
    });

    test('should handle instruction with invalid target markers', () => {
      const content = `# Test Markdown

<!-- qmims: Instruction -->

Some content.
`;
      
      const instruction: Instruction = {
        instruction: 'Instruction',
        lineNumber: 3,
        targetStart: 100, // Out of bounds
        targetEnd: 200    // Out of bounds
      };
      
      // Should fall back to paragraph extraction
      const result = extractTargetContent(content, instruction);
      
      expect(result).toBe('Some content.');
    });
  });
});
