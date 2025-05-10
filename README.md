# qmims - AI-Powered README Generation & Editing

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

**qmims** (Q, Make It Make Sense!) is a command-line tool that leverages Amazon Q Developer CLI to automatically generate, update, and refine README.md files for your projects. It helps you create clear, comprehensive, and contextually relevant documentation with minimal effort.

## Features

- **AI-Powered Content Generation**: Uses Amazon Q to analyze your codebase and generate relevant README content
- **Multiple Generation Modes**:
  - **Auto**: Fully automatic README generation based on project analysis
  - **Template**: Use built-in or custom templates to structure your README
  - **Instruct**: Embedded instruction-driven processing for precise control
- **Direct File Editing**: Amazon Q can make targeted modifications to your README files
- **Custom Templates**: Create and manage your own README templates
- **Configuration Management**: Customize default behaviors and settings
- **Interactive Permissions**: Review and approve AI-suggested changes before they're applied

## Installation

### Prerequisites

Before installing qmims, ensure you have:

1. **Node.js**: Version 18.x or later

   ```bash
   node --version
   ```

2. **Amazon Q Developer CLI**: Must be installed and authenticated
   - [Install Amazon Q Developer CLI](https://aws.amazon.com/q/developer/get-started/cli/)
   - Authenticate with:
     ```bash
     q login
     ```
   - Verify installation:
     ```bash
     q chat "What is Amazon Q Developer?"
     ```

### Install qmims

```bash
npm install -g qmims
```

Verify installation:

```bash
qmims --version
```

## Usage

### Generate a README

```bash
# Generate README in auto mode (default)
qmims generate

# Use a specific template
qmims generate --mode template:basic

# List available templates
qmims generate --mode template --list-available-templates

# Generate with custom output file
qmims generate --output DOCS.md

# Generate for a specific project directory
qmims generate /path/to/project
```

### Edit an Existing README

```bash
# Edit README.md in current directory
qmims edit

# Edit a specific file
qmims edit path/to/README.md
```

### Using Embedded Instructions

Add instructions directly in your Markdown files:

```markdown
# Project Title

<!-- qmims: Generate a concise project overview (1-2 paragraphs) based on the project's primary purpose. -->

## Installation

<!-- qmims: Provide installation instructions using the detected package manager. -->
```

Then run:

```bash
qmims edit
```

### Manage Configuration

```bash
# List all configuration settings
qmims config list

# Get a specific setting
qmims config get defaults.mode

# Set a configuration value
qmims config set defaults.templateName detailed
```

### Manage Templates

```bash
# List all templates
qmims templates list

# Add a custom template
qmims templates add my-template path/to/template.md

# Remove a custom template
qmims templates remove my-template
```

## Operational Modes

### Auto Mode

Fully automatic generation that analyzes your project and creates a comprehensive README:

```bash
qmims generate --mode auto
```

### Template Mode

Uses predefined templates to structure your README:

```bash
qmims generate --mode template:basic
```

Built-in templates include:

- `basic`: Simple README with essential sections
- `detailed`: Comprehensive README with extended sections
- `minimal`: Minimal project overview
- `library`: Focused on API documentation
- `service`: Tailored for web services/APIs

### Instruct Mode

Uses embedded instructions in your Markdown files:

```bash
qmims edit
# or
qmims generate --mode instruct
```

## Advanced Options

- `--force`, `-f`: Overwrite existing files without prompting
- `--yes`, `-y`: Automatically approve all permission requests
- `--dry-run`: Show what would be done without making changes
- `--verbose`: Show detailed output for debugging

## Configuration

Configuration settings are stored in:

- **Linux/macOS**: `~/.config/qmims/config.json` or `~/.qmimsrc`
- **Windows**: `%APPDATA%\qmims\config.json` or `%USERPROFILE%\.qmimsrc`

Common configuration keys:

- `defaults.mode`: Default generation mode
- `defaults.templateName`: Default template name
- `q.autoApproveEdits`: Automatically approve edits (use with caution)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- **Amazon Web Services**: For providing the Amazon Q Developer CLI
- **Node.js Community**: For the robust runtime and ecosystem

## Made with ❤️

This project was created with passion and dedication to simplify documentation workflows for developers. We hope it makes your README creation process more enjoyable and efficient!
