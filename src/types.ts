import { TextDocumentIdentifier, Position as LspPosition, Location as LspLocation } from 'vscode-languageserver'; // Import LSP types

// --- Internal Index Types ---

export interface Position { // 1-based internal position
  line: number;
  column: number;
}

export interface Range { // 1-based internal range
  start: Position;
  end: Position;
}

export interface Location { // Internal Location using relative path
  file: string; // Relative path from project root
  range: Range;
}

export type DefinitionKind = 'class' | 'interface' | 'enum' | 'method' | 'property' | 'constructor' | 'trigger' | 'unknown';

export interface Definition extends Location {
  name: string;
  kind: DefinitionKind;
}

export interface Reference extends Location {
  name: string; // The name of the symbol being referenced
}

export interface IndexData { // For potential disk caching, not used directly by LSP currently
  definitions: Definition[];
  references: Reference[];
}

export interface ReferenceParams {
    textDocument: TextDocumentIdentifier; // The document in which the symbol is located
    position: LspPosition;                // The position of the symbol in the document
    context: { includeDeclaration: boolean }; // Context for the reference request
}

// --- Custom LSP Parameter Types ---

export interface SymbolLocationParams {
    textDocument: TextDocumentIdentifier; // URI of the document
    position: LspPosition;                 // Original cursor position (0-based)
    symbol: string;                     // The symbol name identified by the client
}
