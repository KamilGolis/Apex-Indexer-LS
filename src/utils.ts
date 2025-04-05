// src/utils.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import ts from 'tree-sitter';
import { Position, Range as IndexRange, Location as IndexLocation } from './types'; // Import internal types with aliases
import { connection } from './server'; // Import connection from server
import {
  Range as LspRange,
  Position as LspPosition,
  Location as LspLocation,
} from "vscode-languageserver"; // Import LSP types

// --- Tree-sitter Helpers ---

// Helper to get text of a Tree-sitter node
export function getNodeText(node: ts.SyntaxNode, sourceCode: string): string {
  return sourceCode.substring(node.startIndex, node.endIndex);
}

/**
 * Converts a Tree-sitter Point (0-based row/column) to an internal Position (1-based line/column).
 * @param point - The Tree-sitter Point.
 * @returns The corresponding internal Position.
 */
export function pointToPosition(point: ts.Point): Position {
  return { line: point.row + 1, column: point.column + 1 };
}

/**
 * Calculates the internal 1-based Range for a given Tree-sitter node.
 * @param node - The Tree-sitter syntax node.
 * @returns The internal Range corresponding to the node's start and end positions.
 */
export function getNodeRange(node: ts.SyntaxNode): IndexRange { // Use IndexRange alias
    return {
        start: pointToPosition(node.startPosition),
        end: pointToPosition(node.endPosition),
    };
}

// --- Filesystem & URI Helpers ---

/**
 * Attempts to find the project root directory by searching upwards from a starting path
 * for marker files like 'sfdx-project.json' or a '.git' directory.
 * @param startPath - The absolute path to start searching from.
 * @returns A promise resolving to the absolute path of the found project root, or the start path as a fallback.
 */
export async function findProjectRoot(startPath: string): Promise<string> {
    let currentPath = path.resolve(startPath);
    while (currentPath !== path.parse(currentPath).root) {
        const markerPath = path.join(currentPath, 'sfdx-project.json');
        try {
            await fs.access(markerPath);
            return currentPath; // Found it
        } catch (e) {
            // Not found, go up
        }
        // Fallback to .git
        const gitMarker = path.join(currentPath, '.git');
         try {
            const stats = await fs.stat(gitMarker);
            if (stats.isDirectory()) {
                 return currentPath; // Found .git directory
            }
        } catch (e) {
            // Not found, go up
        }

        currentPath = path.dirname(currentPath);
    }
    // Fallback or throw error if not found
    console.warn(`Warning: Could not find 'sfdx-project.json' or '.git' upwards from ${startPath}. Using start path as root.`);
    return path.resolve(startPath);
}

/**
 * Converts a file URI (e.g., "file:///path/to/file") to an absolute system path.
 * Handles basic validation and uses `fileURLToPath`.
 * @param uri - The file URI string.
 * @returns The absolute file path, or undefined if the URI is invalid or not a file URI.
 */
export function uriToPath(uri: string): string | undefined {
    if (!uri.startsWith('file://')) {
        console.warn(`Cannot convert non-file URI to path: ${uri}`);
        return undefined;
    }
    try {
        return fileURLToPath(uri);
    } catch (e) {
        console.error(`Error converting URI ${uri} to path:`, e);
        return undefined;
    }
}

// --- LSP / Index Conversion Helpers ---

// Map internal 1-based Range to LSP 0-based Range
export function indexRangeToLspRange(range: IndexRange): LspRange {
    return LspRange.create(
        LspPosition.create(range.start.line - 1, range.start.column - 1),
        LspPosition.create(range.end.line - 1, range.end.column - 1),
    );
}

// Map internal Location (relative path) to LSP Location (URI)
export function indexLocationToLspLocation(
    loc: IndexLocation,
    projectRoot: string | undefined // Pass projectRoot explicitly
): LspLocation | undefined {
    if (!projectRoot) {
        console.warn("[Utils] Cannot create LSP Location: Project root unknown.");
        return undefined;
    }
    try {
        // Resolve the relative path from the index to an absolute path
        const absolutePath = path.resolve(projectRoot, loc.file);
        // Convert the absolute path to a file URI
        let fileUri = `file://${absolutePath.replace(/\\/g, "/")}`; // Basic conversion
        if (
            process.platform === "win32" &&
            fileUri.startsWith("file://") &&
            !fileUri.startsWith("file:///")
        ) {
            fileUri = `file:///${absolutePath.replace(/\\/g, "/")}`; // Add third slash for windows drive path
        }

        return LspLocation.create(fileUri, indexRangeToLspRange(loc.range)); // Use the other util function
    } catch (e) {
        console.error(`[Utils] Error creating LSP Location for ${loc.file}:`, e);
        return undefined;
    }
}


// --- LSP Progress Notification ---

/**
 * Sends a progress notification to the LSP client.
 * @param token - A unique token for the progress notification.
 * @param kind - The kind of progress ('begin', 'report', 'end').
 * @param message - An optional message to display.
 * @param percentage - An optional progress percentage (0-100).
 * @param delayMs - Optional delay in milliseconds before sending the notification.
 */
export async function setProgress(token: string, kind: string, message: string = "", percentage: number = 100, delayMs?: number) {
  const sendNotification = () => {
    connection.sendNotification('$/progress', {
      token,
      value: {
        kind,
        message,
        percentage,
      }
    });
  };

  if (delayMs && delayMs > 0) {
    setTimeout(sendNotification, delayMs);
  } else {
    sendNotification();
  }
}

/**
 * Extracts the symbol name at a given offset in a string.
 * @param text - The text to search in.
 * @param offset - The character offset to check.
 * @returns The symbol name at the offset, or null if not found.
 */
export function extractSymbolNameAtOffset(text: string, offset: number): string | null {
  const regex = /[a-zA-Z0-9_]+/g; // Match valid symbol names
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index <= offset && offset <= match.index + match[0].length) {
      return match[0]; // Return the symbol name at the offset
    }
  }

  return null; // No symbol found at the offset
}
