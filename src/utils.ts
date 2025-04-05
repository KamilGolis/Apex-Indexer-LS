// src/utils.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import ts from 'tree-sitter';
import { Position, Range } from './types'; // Import internal types
import { connection } from './server'; // Import connection from server

// Helper to get text of a Tree-sitter node
export function getNodeText(node: ts.SyntaxNode, sourceCode: string): string {
  return sourceCode.substring(node.startIndex, node.endIndex);
}

// Helper to convert Tree-sitter point to our 1-based internal Position
export function pointToPosition(point: ts.Point): Position {
  return { line: point.row + 1, column: point.column + 1 };
}

// Helper to get internal 1-based Range from a Tree-sitter node
export function getNodeRange(node: ts.SyntaxNode): Range {
    return {
        start: pointToPosition(node.startPosition),
        end: pointToPosition(node.endPosition),
    };
}

// Basic function to find project root (adapt as needed)
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

// Helper to convert file URI (file:///...) to a system path
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

export async function setProgress(token: string, kind: string, message: string = "", percentage: number = 100) {
  connection.sendNotification('$/progress', {
    token,
    value: {
      kind,
      message,
      percentage,
    }
  });
}
