
/**
 * Handles the standard 'textDocument/references' request.
 * Finds references for a given symbol using the indexer.
 */
connection.onRequest(
  "textDocument/references",
  (params: ReferenceParams): LspLocation[] | null => {
    const progressToken = "standardRequest";

    connection.console.log(
      `[Server] Received standard request: references for '${params.context.includeDeclaration}'`,
    );

    setProgress(
      progressToken,
      "begin",
      `Finding references for '${params.context.includeDeclaration}'...`,
    );

    if (!rootUri || !params.context.includeDeclaration) {
      console.warn(
        "[Server] Cannot process referencesForSymbol: Missing rootUri or symbol.",
      );

      return null;
    }

    try {
      // Directly use the symbol passed from the client
      // This is synchronous if index is in memory
      const results = indexer.findReferences(params.context.includeDeclaration, rootUri);
      connection.console.log(
        `[Server] Found ${results.length} references for '${params.context.includeDeclaration}'.`,
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
