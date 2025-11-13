import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // The server is implemented in the parent directory
  const serverModule = context.asAbsolutePath(
    path.join('..', 'dist', 'server.js')
  );
  
  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    }
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for apex documents
    documentSelector: [
      { scheme: 'file', language: 'apex' },
      { scheme: 'file', pattern: '**/*.cls' },
      { scheme: 'file', pattern: '**/*.trigger' }
    ],
    synchronize: {
      // Notify the server about file changes to '.apex' files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/*.{cls,trigger}')
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'apexIndexer',
    'Apex Indexer Language Server',
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
