const TreeSitter = require('web-tree-sitter');
import * as path from 'path';

export interface FunctionInfo {
    name: string;
    startLine: number;
    endLine: number;
    lineCount: number;
}

type Parser = any;
type SyntaxNode = any;
type Language = any;

export class CppParser {
    private parser: Parser | null = null;
    private language: Language | null = null;

    async initialize(): Promise<void> {
        await TreeSitter.Parser.init();
        this.parser = new TreeSitter.Parser();

        // Load C/C++ grammar
        const langPath = path.join(__dirname, '../grammars/tree-sitter-cpp.wasm');
        this.language = await TreeSitter.Language.load(langPath);
        this.parser.setLanguage(this.language);
    }

    parseFunctions(sourceCode: string): FunctionInfo[] {
        if (!this.parser || !this.language) {
            throw new Error('Parser not initialized');
        }

        const tree = this.parser.parse(sourceCode);
        const functions: FunctionInfo[] = [];

        const findFunctions = (node: SyntaxNode) => {
            // Look for function_definition nodes
            if (node.type === 'function_definition') {
                const nameNode = this.findFunctionName(node);
                const bodyNode = node.childForFieldName('body');

                if (bodyNode && nameNode) {
                    const startLine = bodyNode.startPosition.row;
                    const endLine = bodyNode.endPosition.row;
                    const lineCount = endLine - startLine + 1;

                    functions.push({
                        name: nameNode.text,
                        startLine,
                        endLine,
                        lineCount
                    });
                }
            }

            // Recurse through children
            for (const child of node.children) {
                findFunctions(child);
            }
        };

        findFunctions(tree.rootNode);
        return functions;
    }

    private findFunctionName(node: SyntaxNode): SyntaxNode | null {
        const declarator = node.childForFieldName('declarator');
        if (!declarator) return null;

        // Handle different declarator types
        let current = declarator;
        while (current) {
            if (current.type === 'function_declarator') {
                const identifier = current.childForFieldName('declarator');
                if (identifier) {
                    if (identifier.type === 'identifier') {
                        return identifier;
                    }
                    current = identifier;
                } else {
                    break;
                }
            } else if (current.type === 'identifier') {
                return current;
            } else if (current.type === 'pointer_declarator' ||
                       current.type === 'reference_declarator') {
                current = current.childForFieldName('declarator') || current.children[1];
            } else {
                break;
            }
        }
        return null;
    }
}
