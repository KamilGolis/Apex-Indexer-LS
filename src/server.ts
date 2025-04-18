#!/usr/bin/env node

import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification, // Keep if planning to use settings
  TextDocumentSyncKind,
  InitializeResult,
  Location as LspLocation,
  DidSaveTextDocumentParams,
  TextDocumentIdentifier,
  Position as LspPosition,
  TextDocuments, // Import manager class from the main server package
} from "vscode-languageserver/node";

// Import the TextDocument TYPE from its specific package
import { TextDocument } from "vscode-languageserver-textdocument";

import { IndexerService } from "./indexerService";
import { uriToPath, setProgress } from "./utils";
import { SymbolLocationParams } from "./types"; // Import the custom param type

// Create a connection for the server.
export const connection = createConnection(ProposedFeatures.all);

// Create a text document manager.
// Pass the TextDocument type definition from the correct package to the manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Indexing service instance
const indexer = new IndexerService();

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

let rootUri: string | null = null; // Store the primary workspace URI

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );

  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  // Store the root URI - prefer workspaceFolders
  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    rootUri = params.workspaceFolders[0].uri;
    console.log(`[Server] Using workspace folder URI: ${rootUri}`);
  } else if (params.rootUri) {
    rootUri = params.rootUri; // Fallback for older clients
    console.log(`[Server] Using legacy rootUri: ${rootUri}`);
  } else {
    console.error(
      "[Server] No workspace root URI provided by client. Indexing disabled.",
    );
  }

  // Initialize the indexer asynchronously IF we found a root
  if (rootUri) {
    const initStartTime = Date.now();
    // Don't await here, let initialization happen in the background
    indexer
      .initialize(rootUri)
      .then(() => {
        console.log(
          `[Server] Indexer initialized in ${Date.now() - initStartTime}ms.`,
        );
        connection.console.info("Apex Indexer ready."); // Inform client if possible/needed
      })
      .catch((err) => {
        connection.console.error(
          `[Server] Error during initial indexing: ${err}`,
        );
      });
  }

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental, // Notify on changes
      // ** IMPORTANT: DO NOT advertise standard providers for definition/references **
      // We use custom methods triggered by client keymaps.
      // definitionProvider: false,
      // referencesProvider: false,

      // Add other capabilities later if needed (hover, completion, etc.)
    },
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  console.log("[Server] onInitialize complete.");
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined,
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log(
        "[Server] Workspace folder change event received.",
      );
      // TODO: Handle workspace folder changes (e.g., find new root, re-initialize indexer)
    });
  }
  console.log("[Server] Apex LSP Server Initialized (using custom methods).");
});

// --- Custom Method Handlers ---

// Handler for Definition Request
connection.onRequest(
  "$/apexIndexer/definitionForSymbol",
  (params: SymbolLocationParams): LspLocation[] | null => {
    // Can return Promise<...> if async needed here
    const progressToken = "request";

    connection.console.log(
      `[Server] Received custom request: definitionForSymbol for '${params.symbol}'`,
    );

    setProgress(
      progressToken,
      "begin",
      `Finding definitions for '${params.symbol}'...`,
    );

    if (!rootUri || !params.symbol) {
      console.warn(
        "[Server] Cannot process definitionForSymbol: Missing rootUri or symbol.",
      );

      return null;
    }

    try {
      // Directly use the symbol passed from the client
      // This is synchronous if index is in memory
      const results = indexer.findDefinitions(params.symbol, rootUri);
      connection.console.log(
        `[Server] Found ${results.length} definitions for '${params.symbol}'.`,
      );
      return results; // Return LSP Location array
    } catch (error: any) {
      connection.console.error(
        `[Server] Error finding definitions via custom method: ${error.message || error}`,
      );
      return null;
    } finally {
      setTimeout(() => {
        setProgress(progressToken, "end");
      }, 1000);
    }
  },
);

// Handler for References Request
connection.onRequest(
  "$/apexIndexer/referencesForSymbol",
  (params: SymbolLocationParams): LspLocation[] | null => {
    // Can return Promise<...> if async needed here
    const progressToken = "request";

    connection.console.log(
      `[Server] Received custom request: referencesForSymbol for '${params.symbol}'`,
    );

    setProgress(
      progressToken,
      "begin",
      `Finding references for '${params.symbol}'...`,
    );

    if (!rootUri || !params.symbol) {
      console.warn(
        "[Server] Cannot process referencesForSymbol: Missing rootUri or symbol.",
      );

      return null;
    }

    try {
      // Directly use the symbol passed from the client
      // This is synchronous if index is in memory
      const results = indexer.findReferences(params.symbol, rootUri);
      connection.console.log(
        `[Server] Found ${results.length} references for '${params.symbol}'.`,
      );
      return results; // Return LSP Location array
    } catch (error: any) {
      connection.console.error(
        `[Server] Error finding references via custom method: ${error.message || error}`,
      );
      return null;
    } finally {
      setTimeout(() => {
        setProgress(progressToken, "end");
      }, 1000);
    }
  },
);

// --- Document Synchronization ---

// Manage open text documents
documents.listen(connection);

// Re-index when a relevant file is saved
connection.onDidSaveTextDocument((params: DidSaveTextDocumentParams) => {
  connection.console.log(`[Server] File saved: ${params.textDocument.uri}`);
  if (rootUri) {
    // Let the indexer handle checking the file type and path
    indexer
      .handleFileSave(params.textDocument.uri)
      .catch((e) => console.error(`Error handling file save:`, e));
  }
});

// --- Start Listening ---
connection.listen();
console.log("[Server] Apex LSP Server connection listener started.");
