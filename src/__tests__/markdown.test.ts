import * as fs from 'fs-extra';
import path from 'path';
import {
  findReadmeFile,
  readMarkdownFile,
  writeMarkdownFile,
  parseInstructions,
  Instruction,
} from '../utils/markdown';

jest.mock('fs-extra', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
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

    test('should propagate read errors', async () => {
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

    test('should propagate write errors', async () => {
      const error = new Error('Permission denied');
      const content = '# Test Markdown';
      (fs.writeFile as jest.Mock).mockRejectedValue(error);

      await expect(writeMarkdownFile('/test/file.md', content)).rejects.toThrow(
        'Permission denied',
      );
      expect(fs.writeFile).toHaveBeenCalledWith('/test/file.md', content, 'utf8');
    });
  });

  describe('parseInstructions', () => {
    test('should parse multiple qmims instructions from markdown content', () => {
      const content = `# Test Markdown

<!-- qmims: Instruction 1 -->

Some content

<!-- qmims: Instruction 2 -->
`;

      const result = parseInstructions(content);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual<Instruction>({
        instruction: 'Instruction 1',
        lineNumber: 3,
      });
      expect(result[1]).toEqual<Instruction>({
        instruction: 'Instruction 2',
        lineNumber: 7,
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
      expect(result[0]).toEqual<Instruction>({
        instruction: 'Instruction with targets',
        lineNumber: 3,
        targetStart: 5,
        targetEnd: 7,
      });
    });

    test('should assign target markers to each instruction independently', () => {
      const content = `# Test Markdown

<!-- qmims: First instruction -->
<!-- qmims-target-start -->
First target line
<!-- qmims-target-end -->

<!-- qmims: Second instruction -->
<!-- qmims-target-start -->
Second target line
<!-- qmims-target-end -->
`;

      const result = parseInstructions(content);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual<Instruction>({
        instruction: 'First instruction',
        lineNumber: 3,
        targetStart: 4,
        targetEnd: 5,
      });
      expect(result[1]).toEqual<Instruction>({
        instruction: 'Second instruction',
        lineNumber: 8,
        targetStart: 9,
        targetEnd: 10,
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
      expect(result[0]).toEqual<Instruction>({
        instruction: 'Actual instruction',
        lineNumber: 5,
      });
    });

    test('should ignore qmims comments with no instruction body', () => {
      const content = `# Test Markdown

<!-- qmims:    -->
<!-- qmims: Valid instruction -->
`;

      const result = parseInstructions(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual<Instruction>({
        instruction: 'Valid instruction',
        lineNumber: 4,
      });
    });

    test('should parse instruction text with surrounding whitespace trimmed', () => {
      const content = `# Test Markdown

<!--   qmims:    Add installation details here     -->
`;

      const result = parseInstructions(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual<Instruction>({
        instruction: 'Add installation details here',
        lineNumber: 3,
      });
    });

    test('should leave target markers undefined when none are found', () => {
      const content = `# Test Markdown

<!-- qmims: Add usage examples -->
`;

      const result = parseInstructions(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual<Instruction>({
        instruction: 'Add usage examples',
        lineNumber: 3,
      });
      expect(result[0].targetStart).toBeUndefined();
      expect(result[0].targetEnd).toBeUndefined();
    });
  });
});
