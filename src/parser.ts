// src/parser.ts
import Parser from "tree-sitter";
// Use require for the grammar binding
// eslint-disable-next-line @typescript-eslint/no-var-requires
import TsSfApex from "tree-sitter-sfapex";
import * as fs from "fs/promises";
import * as path from "path";
import { Definition, Reference, DefinitionKind } from "./types";
import { getNodeText, getNodeRange } from "./utils";

// Initialize Parser
let parser: Parser;
let sfapexLanguage: Parser.Language; // Store the resolved language object

try {
  parser = new Parser();
  parser.setLanguage(TsSfApex.apex);
  console.log(
    "[Parser] Successfully loaded and set 'tree-sitter-sfapex' language.",
  );
  // --- END Robust Loading ---
} catch (error) {
  console.error(
    "Fatal Error: Could not load or set tree-sitter-sfapex grammar.",
    error,
  );
  console.error(
    "Ensure 'tree-sitter-sfapex' is correctly installed (check npm install logs for errors) and build tools (node-gyp prerequisites) are available.",
  );
  process.exit(1);
}

// --- Tree-sitter Queries ---
// ** WARNING: QUERIES STILL LIKELY NEED ADJUSTMENT FOR sfapex GRAMMAR **
const definitionQueries: Record<string, string> = {
  class: `(class_declaration name: (identifier) @name) @def`,
  interface: `(interface_declaration name: (identifier) @name) @def`,
  enum: `(enum_declaration name: (identifier) @name) @def`,
  method: `(method_declaration name: (identifier) @name) @def`,
  constructor: `(constructor_declaration name: (identifier) @name) @def`,
  property: `(field_declaration declarator: (variable_declarator name: (identifier) @name)) @def`,
  trigger: `(trigger_declaration name: (identifier) @name) @def`, // Added trigger example
};
const referenceQuery = `
  [
    (type_identifier) @ref_name
    (identifier) @maybe_ref_name
    ; Example specific query: (method_invocation name: (identifier) @ref_name)
  ]
`;
// --- END QUERIES ---

export async function parseFile(
  filePath: string,
  projectRoot: string,
): Promise<{ definitions: Definition[]; references: Reference[] }> {
  const definitions: Definition[] = [];
  const references: Reference[] = [];
  const relativePath = path.relative(projectRoot, filePath);

  try {
    const sourceCode = await fs.readFile(filePath, "utf8");
    if (!parser)
      throw new Error("Tree-sitter parser or sfapex language not initialized");

    // Use the language object that was validated during initialization
    const tree = parser.parse(sourceCode);
    const rootNode = tree.rootNode;

    // --- Find Definitions ---
    const foundDefRanges = new Set<string>();
    for (const [kind, queryString] of Object.entries(definitionQueries)) {
      try {
        const query = new Parser.Query(TsSfApex.apex, queryString);
        const matches = query.matches(rootNode);
        for (const match of matches) {
          const defNode = match.captures.find((c) => c.name === "def")?.node;
          const nameNode = match.captures.find((c) => c.name === "name")?.node;

          if (nameNode && defNode) {
            const range = getNodeRange(nameNode);
            definitions.push({
              name: getNodeText(nameNode, sourceCode),
              kind: kind as DefinitionKind,
              file: relativePath,
              range: range,
            });
            foundDefRanges.add(`${range.start.line}:${range.start.column}`);
          } else if (defNode && kind === "constructor") {
            const constructorNameNode = defNode.childForFieldName("name");
            if (constructorNameNode) {
              const range = getNodeRange(constructorNameNode);
              definitions.push({
                name: getNodeText(constructorNameNode, sourceCode),
                kind: "constructor",
                file: relativePath,
                range: range,
              });
              foundDefRanges.add(`${range.start.line}:${range.start.column}`);
            }
          }
        }
      } catch (queryError: any) {
        console.warn(
          `Warning: Failed to execute definition query (${kind}) for ${relativePath}: ${queryError.message || queryError}`,
        );
        console.warn(`Query was: ${queryString}`);
      }
    }

    // --- Find References ---
    try {
      const query = new Parser.Query(TsSfApex.apex, referenceQuery);
      const matches = query.matches(rootNode);
      for (const match of matches) {
        const refNode =
          match.captures.find((c) => c.name === "ref_name")?.node ??
          match.captures.find((c) => c.name === "maybe_ref_name")?.node;

        if (refNode) {
          const range = getNodeRange(refNode);
          const rangeKey = `${range.start.line}:${range.start.column}`;
          if (!foundDefRanges.has(rangeKey)) {
            // ** Still needs refinement based on sfapex structure **
            references.push({
              name: getNodeText(refNode, sourceCode),
              file: relativePath,
              range: range,
            });
          }
        }
      }
    } catch (queryError: any) {
      console.warn(
        `Warning: Failed to execute reference query for ${relativePath}: ${queryError.message || queryError}`,
      );
      console.warn(`Query was: ${referenceQuery}`);
    }
  } catch (error: any) {
    console.error(
      `Error parsing file ${relativePath}: ${error.message || error}`,
    );
  }

  return { definitions, references };
}
