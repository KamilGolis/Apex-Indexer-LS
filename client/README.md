# Apex Indexer VSCode Extension

This extension provides language support for Salesforce Apex using the Apex-Indexer-LS language server.

## Features

- **Go to Definition**: Navigate to the definition of classes, methods, and variables
- **Find References**: Find all references to a symbol across your project
- **Symbol Indexing**: Automatically indexes your Apex codebase for fast navigation
- **Error Reporting**: Syntax and semantic error detection

## Requirements

- Visual Studio Code 1.75.0 or higher
- An Apex/Salesforce project with `sfdx-project.json` file

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/KamilGolis/Apex-Indexer-LS.git
   cd Apex-Indexer-LS
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Install the extension:
   ```bash
   cd client
   code --install-extension apex-indexer-vscode-0.1.0.vsix
   ```

   Or install from VSCode:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
   - Type "Extensions: Install from VSIX"
   - Select the `.vsix` file from the `client` directory

## Usage

Once installed, the extension will automatically activate when you open Apex files (`.cls`, `.trigger`).

### Keyboard Shortcuts

- **Go to Definition**: `F12` or right-click → "Go to Definition"
- **Find References**: `Shift+F12` or right-click → "Find All References"

## Extension Settings

This extension contributes the following settings:

- `apexIndexer.trace.server`: Enable/disable tracing of communication between VS Code and the language server

## Known Issues

Please report issues at: https://github.com/KamilGolis/Apex-Indexer-LS/issues

## Release Notes

### 0.1.0

Initial release of Apex Indexer VSCode Extension

- Go to Definition support
- Find References support
- Automatic indexing of Apex files

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
