// src/indexerService.ts
import * as fs from "fs/promises";
import * as path from "path";
import glob from "fast-glob";
import { parseFile } from "./parser";
import {
  Definition,
  Reference,
  Location as IndexLocation,
  Range as IndexRange,
} from "./types";
import { setProgress, findProjectRoot, uriToPath } from "./utils";
import {
  Location as LspLocation,
  Range as LspRange,
  Position as LspPosition,
} from "vscode-languageserver";

export class IndexerService {
  // In-memory index (can be optimized or backed by disk)
  private definitions = new Map<string, Definition[]>(); // Key: symbol name
  private references = new Map<string, Reference[]>(); // Key: symbol name
  private filesIndexed = new Set<string>(); // Store paths relative to root
  private projectRoot: string | undefined;
  private isIndexing = false;

  // Map our internal 1-based Range to LSP 0-based Range
  private toLspRange(range: IndexRange): LspRange {
    return LspRange.create(
      LspPosition.create(range.start.line - 1, range.start.column - 1),
      LspPosition.create(range.end.line - 1, range.end.column - 1),
    );
  }

  // Map our internal Location (relative path) to LSP Location (URI)
  private toLspLocation(
    loc: IndexLocation,
    workspaceUri: string,
  ): LspLocation | undefined {
    if (!this.projectRoot) {
      console.warn("Cannot create LSP Location: Project root unknown.");
      return undefined;
    }
    try {
      // Resolve the relative path from the index to an absolute path
      const absolutePath = path.resolve(this.projectRoot, loc.file);
      // Convert the absolute path to a file URI
      // Ensure workspaceUri ends with '/' for correct joining if needed, or use a URI library
      // Example using path-based logic (might need refinement for edge cases/windows)
      let fileUri = `file://${absolutePath.replace(/\\/g, "/")}`; // Basic conversion
      if (
        process.platform === "win32" &&
        fileUri.startsWith("file://") &&
        !fileUri.startsWith("file:///")
      ) {
        fileUri = `file:///${absolutePath.replace(/\\/g, "/")}`; // Add third slash for windows drive path
      }

      return LspLocation.create(fileUri, this.toLspRange(loc.range));
    } catch (e) {
      console.error(`Error creating LSP Location for ${loc.file}:`, e);
      return undefined;
    }
  }

  async initialize(workspaceUri: string): Promise<void> {
    const workspacePath = uriToPath(workspaceUri);
    if (!workspacePath) {
      console.error("Cannot index: Invalid workspace URI", workspaceUri);
      return;
    }
    // Allow findProjectRoot to search upwards from the workspace path
    this.projectRoot = await findProjectRoot(workspacePath);
    console.log(
      `[IndexerService] Project root identified: ${this.projectRoot}`,
    );
    // Trigger initial full index
    await this.runFullIndex();
  }

  async runFullIndex(): Promise<void> {
    if (!this.projectRoot) {
      console.error(
        "[IndexerService] Cannot run full index: Project root not set.",
      );
      return;
    }
    if (this.isIndexing) {
      console.warn(
        "[IndexerService] Indexing already in progress. Skipping new full index request.",
      );
      return;
    }
    this.isIndexing = true;
    console.log(
      `[IndexerService] Starting full index for: ${this.projectRoot}`,
    );

    // Clear existing index data
    this.definitions.clear();
    this.references.clear();
    this.filesIndexed.clear();

    const startTime = Date.now();

    let files: string[] = [];

    try {
      files = await glob(["**/*.cls", "**/*.trigger", "**/*.apex"], {
        cwd: this.projectRoot,
        ignore: [
          "**/node_modules/**",
          "**/.sfdx/**",
          "**/.*/**",
          "**/coverage/**",
        ], // Standard ignores
        absolute: true,
        onlyFiles: true,
        dot: false, // Don't match dotfiles/dot-directories by default
      });
    } catch (globError: any) {
      console.error(
        `[IndexerService] Error finding files: ${globError.message || globError}`,
      );
      this.isIndexing = false;
      return;
    }
    if (files.length === 0) {
      console.log("[IndexerService] No Apex files found to index.");
      this.isIndexing = false;
      return;
    }

    console.log(`[IndexerService] Found ${files.length} files to index...`);

    // Consider using a pool library like 'piscina' for CPU-bound parsing on many files
    const progressToken = "indexing";
    try {
      let currentFile = 0;

      for (const file of files) {
        currentFile++;
        const progressPercentage = Math.floor(
          (currentFile / files.length) * 100,
        );
        setProgress(
          progressToken,
          "report",
          `Indexing ${currentFile}/${files.length}`,
          progressPercentage,
        );
        await this.indexFile(file);
      }
    } catch (error: any) {
      console.error(
        `[IndexerService] Error during indexing: ${error.message || error}`,
      );
    } finally {
      setProgress(progressToken, "report", "Indexing complete.");
      setTimeout(() => {
        setProgress(progressToken, "end");
      }, 3000);
    }

    const duration = Date.now() - startTime;
    console.log(`[IndexerService] Indexing complete in ${duration}ms.`);
    console.log(
      `[IndexerService] Indexed ${this.countSymbols(this.definitions)} definitions and ${this.countSymbols(this.references)} references across ${this.filesIndexed.size} files.`,
    );
    this.isIndexing = false;
  }

  // Helper to count unique symbols (optional)
  private countSymbols(map: Map<string, any[]>): number {
    return map.size;
  }

  async indexFile(absolutePath: string): Promise<void> {
    if (!this.projectRoot) {
      console.warn(
        `[IndexerService] Cannot index file: Project root unknown. File: ${absolutePath}`,
      );
      return;
    }
    const relativePath = path.relative(this.projectRoot, absolutePath);

    // Clear old data for this specific file before adding new data
    this.removeDataForFile(relativePath);

    try {
      const { definitions: newDefs, references: newRefs } = await parseFile(
        absolutePath,
        this.projectRoot,
      );

      // Add new definitions to the map
      newDefs.forEach((def) => {
        const existing = this.definitions.get(def.name) || [];
        // Avoid duplicates if parser somehow double-reports
        if (
          !existing.some(
            (e) =>
              e.file === def.file &&
              e.range.start.line === def.range.start.line &&
              e.range.start.column === def.range.start.column,
          )
        ) {
          this.definitions.set(def.name, [...existing, def]);
        }
      });

      // Add new references to the map
      newRefs.forEach((ref) => {
        const existing = this.references.get(ref.name) || [];
        if (
          !existing.some(
            (e) =>
              e.file === ref.file &&
              e.range.start.line === ref.range.start.line &&
              e.range.start.column === ref.range.start.column,
          )
        ) {
          this.references.set(ref.name, [...existing, ref]);
        }
      });

      this.filesIndexed.add(relativePath);
    } catch (error: any) {
      console.error(
        `[IndexerService] Failed to index file ${relativePath}: ${error.message || error}`,
      );
    }
  }

  // Helper to clear data before re-indexing a file
  private removeDataForFile(relativePath: string): void {
    let changed = false;

    this.definitions.forEach((defs, key) => {
      const initialLength = defs.length;
      const filtered = defs.filter((d) => d.file !== relativePath);
      if (filtered.length < initialLength) changed = true;
      if (filtered.length === 0) {
        this.definitions.delete(key);
      } else if (filtered.length < initialLength) {
        this.definitions.set(key, filtered);
      }
    });

    this.references.forEach((refs, key) => {
      const initialLength = refs.length;
      const filtered = refs.filter((r) => r.file !== relativePath);
      if (filtered.length < initialLength) changed = true;
      if (filtered.length === 0) {
        this.references.delete(key);
      } else if (filtered.length < initialLength) {
        this.references.set(key, filtered);
      }
    });

    this.filesIndexed.delete(relativePath);
  }

  findDefinitions(symbol: string, workspaceUri: string): LspLocation[] {
    const defs = this.definitions.get(symbol) || [];
    const locations: LspLocation[] = [];
    defs.forEach((d) => {
      const lspLoc = this.toLspLocation(d, workspaceUri);
      if (lspLoc) locations.push(lspLoc);
    });
    return locations;
  }

  findReferences(symbol: string, workspaceUri: string): LspLocation[] {
    const refs = this.references.get(symbol) || [];
    const locations: LspLocation[] = [];
    refs.forEach((r) => {
      const lspLoc = this.toLspLocation(r, workspaceUri);
      if (lspLoc) locations.push(lspLoc);
    });
    return locations;
  }

  // Methods to handle file changes
  async handleFileSave(uri: string): Promise<void> {
    const filePath = uriToPath(uri);
    const progressToken = "reindexing";

    if (filePath && this.projectRoot && filePath.startsWith(this.projectRoot)) {
      // Check if it's a file type we care about
      if (/\.(cls|trigger|apex)$/.test(filePath)) {
        console.log(
          `[IndexerService] File saved, re-indexing: ${path.relative(this.projectRoot, filePath)}`,
        );
        setProgress(progressToken, "begin", `Re-indexing file: ${filePath}`);
        // Simple approach: re-index the saved file asynchronously
        this.indexFile(filePath)
          .catch((e) => console.error(`Error re-indexing ${filePath}:`, e))
          .finally(() => {
            setTimeout(() => {
              setProgress(progressToken, "end");
            }, 3000);
          });
      }
    }
  }
}
