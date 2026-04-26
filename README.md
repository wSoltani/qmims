# qmims - AI-Powered README Generation & Editing

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Documentation](https://img.shields.io/badge/docs-qmims.vercel.app-blue.svg)](https://qmims.vercel.app/docs/introduction)

**qmims** (Q, Make It Make Sense!) is a command-line tool that uses **Kiro CLI** to generate, update, and refine `README.md` files for your projects. It helps you create clear, comprehensive, and context-aware documentation with minimal effort.

> **Note on the name:** `qmims` was originally built for **Amazon Q CLI** — hence **Q**, Make It Make Sense! Amazon has since rebranded Q Developer CLI to **Kiro CLI**, and `qmims` has been fully migrated to work with Kiro.

> 📚 **[Visit the documentation site](https://qmims.vercel.app/docs/introduction)** for guides, examples, and best practices.

## Features

- **AI-powered README generation** with Kiro CLI
- **Multiple generation modes**:
  - **Auto**: Analyze the project and generate a README automatically
  - **Template**: Start from a built-in or custom template
  - **Instruct**: Use embedded instructions inside Markdown files
- **Direct README editing** using embedded `qmims` instructions
- **Custom templates** for reusable README structures
- **Configuration management** for defaults and workflow preferences
- **Optional auto-approval flow** for Kiro tool permissions

## Installation

> ⚡ **[Quick installation guide](https://qmims.vercel.app/docs/installation)** is also available in the docs.

### Prerequisites

Before installing `qmims`, make sure you have:

1. **Node.js**: version 18 or later

   ```bash
   node --version
   ```

2. **Kiro CLI**: installed and authenticated

   Install Kiro CLI using the [official instructions](https://kiro.dev/docs/cli/installation/) for your platform.

   > **Windows users:** Kiro CLI requires **Windows 11**. Run the install command in **PowerShell** or **Windows Terminal**, not Command Prompt.

   Authenticate with:

   ```bash
   kiro-cli login
   ```

   Verify installation and auth status:

   ```bash
   kiro-cli whoami
   ```

   For headless or CI usage, you can authenticate with:

   ```bash
   export KIRO_API_KEY=your_api_key_here
   ```

   On Windows PowerShell:

   ```powershell
   $env:KIRO_API_KEY = "your_api_key_here"
   ```

   If you run into issues, check:

   ```bash
   kiro-cli doctor
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

> 📖 **[Full command reference](https://qmims.vercel.app/docs/command-reference)** includes examples and walkthroughs.

### Generate a README

```bash
# Generate README in auto mode
qmims generate

# Use a specific template
qmims generate --mode template:basic

# List available templates
qmims generate --mode template --list-available-templates

# Generate with a custom output file
qmims generate --output DOCS.md

# Generate for a specific project directory
qmims generate /path/to/project
```

### Edit an Existing README

```bash
# Edit README.md in the current directory
qmims edit

# Edit a specific Markdown file
qmims edit path/to/README.md
```

### Use Embedded Instructions

Add instructions directly inside a Markdown file:

```markdown
# Project Title

<!-- qmims: Generate a concise project overview based on the repository's main purpose. -->

## Installation

<!-- qmims: Provide installation steps using the detected package manager and runtime requirements. -->
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

## Generation Modes

### Auto Mode

Automatically analyzes your project and generates a README:

```bash
qmims generate --mode auto
```

### Template Mode

Uses a predefined template to structure the README:

```bash
qmims generate --mode template:basic
```

Built-in templates include:

- `basic`
- `detailed`
- `minimal`
- `library`
- `service`

### Instruct Mode

Uses embedded instructions from a Markdown file:

```bash
qmims generate --mode instruct
```

Or specify a file:

```bash
qmims generate --mode instruct:path/to/README.md
```

## Advanced Options

- `--force`, `-f`: overwrite existing files without prompting
- `--yes`, `-y`: automatically approve Kiro tool permission requests
- `--dry-run`: show what would happen without making changes
- `--verbose`: print detailed diagnostic output

## Configuration

Configuration is stored in the standard `qmims` config location for your platform.

Common configuration keys include:

- `defaults.mode`
- `defaults.outputFileName`
- `defaults.templateName`
- `q.autoApproveEdits`

## Kiro Workflow Notes

`qmims` uses Kiro in non-interactive chat mode under the hood. Typical environment setup looks like this:

```bash
kiro-cli login
kiro-cli whoami
qmims generate
```

For headless environments:

```bash
export KIRO_API_KEY=your_api_key_here
qmims generate
```

If Kiro is unavailable or authentication is missing, validate your setup with:

```bash
kiro-cli whoami
kiro-cli doctor
```

## Contributing

Contributions are welcome. Feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See `LICENSE` for details.

## Acknowledgements

- **Kiro** for the CLI-powered AI workflow
- **Node.js community** for the runtime and ecosystem

## Made with ❤️

`qmims` was created to make project documentation easier to generate and maintain. If it saves you time, that means it's doing its job.