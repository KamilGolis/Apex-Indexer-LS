# VSCode Extension Development Guide

This guide explains how to develop, test, and package the Apex Indexer VSCode extension.

## Prerequisites

- Node.js 18.x or higher
- Visual Studio Code
- Git

## Setup

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/KamilGolis/Apex-Indexer-LS.git
   cd Apex-Indexer-LS
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

## Development Workflow

### Building

- **Build everything**: `npm run build`
- **Build server only**: `npm run build:server`
- **Build client only**: `npm run build:client`
- **Watch mode (server)**: `npm run watch`
- **Watch mode (client)**: `cd client && npm run watch`

### Testing the Extension

1. **Using VSCode Debugger** (Recommended):
   - Open the project in VSCode
   - Press `F5` or go to Run > Start Debugging
   - Select "Launch Extension" from the debug configurations
   - A new VSCode Extension Development Host window will open
   - Open the `examples` folder in the Extension Development Host
   - Open an `.cls` file and test the features:
     - Press `F12` on a symbol to go to its definition
     - Press `Shift+F12` to find all references

2. **Manual Installation**:
   ```bash
   # First, package the extension
   cd client
   npm install -g @vscode/vsce
   vsce package
   
   # Then install it
   code --install-extension apex-indexer-vscode-0.1.0.vsix
   ```

### Project Structure

```
Apex-Indexer-LS/
├── src/                    # LSP server source code
│   ├── server.ts          # Main server entry point
│   ├── indexerService.ts  # Symbol indexing logic
│   ├── parser.ts          # Tree-sitter parser
│   └── ...
├── dist/                   # Compiled server (generated)
├── client/                 # VSCode extension
│   ├── src/
│   │   └── extension.ts   # Extension activation code
│   ├── out/               # Compiled extension (generated)
│   ├── package.json       # Extension manifest
│   └── README.md          # Extension documentation
├── examples/              # Example Apex files for testing
├── .vscode/               # VSCode debug/task configurations
└── package.json           # Root package file
```

## Testing Features

### Go to Definition

1. Open `examples/ContactService.cls`
2. Place cursor on `AccountService` (line 5)
3. Press `F12`
4. Should jump to `AccountService.cls`

### Find References

1. Open `examples/AccountService.cls`
2. Place cursor on `getAccountById` method name
3. Press `Shift+F12`
4. Should show reference in `ContactService.cls`

## Packaging for Distribution

1. Install vsce if not already installed:
   ```bash
   npm install -g @vscode/vsce
   ```

2. Package the extension:
   ```bash
   cd client
   vsce package
   ```

3. This creates `apex-indexer-vscode-0.1.0.vsix` file

4. Distribute the `.vsix` file or publish to VSCode Marketplace:
   ```bash
   vsce publish
   ```

## Troubleshooting

### Extension doesn't activate

- Check if you have `sfdx-project.json` in your workspace
- Check VSCode Output panel > "Apex Indexer Language Server"
- Enable trace logging: Set `"apexIndexer.trace.server": "verbose"` in settings

### Server errors

- Check the server is built: `ls dist/server.js`
- Rebuild if needed: `npm run build:server`
- Check console output in Extension Development Host

### Features not working

- Verify the LSP server is running (check Output panel)
- Ensure files have `.cls` or `.trigger` extension
- Check that symbols are properly indexed (server logs)

## Contributing

When making changes:

1. Make changes to source files in `src/` or `client/src/`
2. Build: `npm run build`
3. Test using debugger (F5)
4. Commit changes
5. Submit pull request

## Additional Resources

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [Tree-sitter](https://tree-sitter.github.io/)
