# qmims - AI-Powered README Generation & Editing

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Documentation](https://img.shields.io/badge/docs-qmims.vercel.app-blue.svg)](https://qmims.vercel.app/docs/introduction)

**qmims** (Q, Make It Make Sense!) is a command-line tool that leverages Amazon Q Developer CLI to automatically generate, update, and refine README.md files for your projects. It helps you create clear, comprehensive, and contextually relevant documentation with minimal effort.

> 📚 **[Visit our comprehensive documentation](https://qmims.vercel.app/docs/introduction)** for detailed guides, examples, and best practices.

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

> 🔍 **[Explore all features](https://qmims.vercel.app/docs/generation-modes)** including generation modes, templates, and embedded instructions.

## Installation

> ⚡ **[Quick installation guide](https://qmims.vercel.app/docs/installation)** available in our docs.

### Prerequisites

Before installing qmims, ensure you have:

1. **Node.js**: Version 18.x or later

   ```bash
   node --version
   ```

2. **Amazon Q Developer CLI**: Must be installed and authenticated
   - [Install Amazon Q Developer CLI](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-installing.html)
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

> 📖 **[Full command reference](https://qmims.vercel.app/docs/command-reference)** with examples and tutorials.

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

> 🔧 **[Generate command documentation](https://qmims.vercel.app/docs/command-reference/generate)** for all available options and examples.

### Edit an Existing README

```bash
# Edit README.md in current directory
qmims edit

# Edit a specific file
qmims edit path/to/README.md
```

> ✏️ **[Edit command documentation](https://qmims.vercel.app/docs/command-reference/edit)** for detailed usage information.

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

> 💡 **[Embedded instructions guide](https://qmims.vercel.app/docs/embedded-instructions)** for advanced usage techniques.

### Manage Configuration

```bash
# List all configuration settings
qmims config list

# Get a specific setting
qmims config get defaults.mode

# Set a configuration value
qmims config set defaults.templateName detailed
```

> ⚙️ **[Config command documentation](https://qmims.vercel.app/docs/command-reference/config)** for all configuration options.

### Manage Templates

```bash
# List all templates
qmims templates list

# Add a custom template
qmims templates add my-template path/to/template.md

# Remove a custom template
qmims templates remove my-template
```

> 📝 **[Templates command documentation](https://qmims.vercel.app/docs/command-reference/templates)** and **[Working with templates guide](https://qmims.vercel.app/docs/templates)**.

## Operational Modes

> 🧩 **[Detailed generation modes guide](https://qmims.vercel.app/docs/generation-modes)** available in our documentation.

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

> 🛠️ **[Advanced usage guide](https://qmims.vercel.app/docs/advanced-usage)** for power users.

## Configuration

Configuration settings are stored in:

- **Linux/macOS**: `~/.config/qmims/config.json` or `~/.qmimsrc`
- **Windows**: `%APPDATA%\qmims\config.json` or `%USERPROFILE%\.qmimsrc`

Common configuration keys:

- `defaults.mode`: Default generation mode
- `defaults.templateName`: Default template name
- `q.autoApproveEdits`: Automatically approve edits (use with caution)

> 🔧 **[Configuration system documentation](https://qmims.vercel.app/docs/configuration)** for all available options.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

> 👥 **[Best practices](https://qmims.vercel.app/docs/best-practices)** to help you get the most out of qmims.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- **Amazon Web Services**: For providing the Amazon Q Developer CLI
- **Node.js Community**: For the robust runtime and ecosystem

> 🔧 **[Troubleshooting guide](https://qmims.vercel.app/docs/troubleshooting)** if you encounter any issues.

## Made with ❤️

This project was created with passion and dedication to simplify documentation workflows for developers. We hope it makes your README creation process more enjoyable and efficient!

> 🌟 **[Visit our documentation](https://qmims.vercel.app/docs/introduction)** for the latest updates, guides, and troubleshooting resources.
