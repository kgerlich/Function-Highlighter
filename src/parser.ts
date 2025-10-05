const TreeSitter = require('web-tree-sitter');
import * as path from 'path';

export interface FunctionInfo {
    name: string;
    startLine: number;
    endLine: number;
    lineCount: number;
    declarationLine: number; // Line where the function is declared
}

type Parser = any;
type SyntaxNode = any;
type Language = any;

// Mapping from VS Code language IDs to tree-sitter grammar names
const LANGUAGE_GRAMMAR_MAP: { [key: string]: string } = {
    'c': 'c',
    'cpp': 'cpp',
    'python': 'python',
    'javascript': 'javascript',
    'typescript': 'typescript',
    'typescriptreact': 'tsx',
    'javascriptreact': 'javascript',
    'java': 'java',
    'rust': 'rust',
    'go': 'go',
    'ruby': 'ruby',
    'php': 'php',
    'csharp': 'c_sharp',
    'bash': 'bash',
    'json': 'json',
    'yaml': 'yaml',
    'css': 'css'
};

// Node types that represent function definitions across different languages
const FUNCTION_NODE_TYPES: { [key: string]: string[] } = {
    'c': ['function_definition'],
    'cpp': ['function_definition'],
    'python': ['function_definition'],
    'javascript': ['function_declaration', 'function', 'method_definition', 'arrow_function'],
    'typescript': ['function_declaration', 'function', 'method_definition', 'arrow_function'],
    'tsx': ['function_declaration', 'function', 'method_definition', 'arrow_function'],
    'java': ['method_declaration', 'constructor_declaration'],
    'rust': ['function_item'],
    'go': ['function_declaration', 'method_declaration'],
    'ruby': ['method', 'singleton_method'],
    'php': ['function_definition', 'method_declaration'],
    'c_sharp': ['method_declaration', 'constructor_declaration'],
    'bash': ['function_definition'],
    'json': [],
    'yaml': [],
    'css': []
};

export class CppParser {
    private parser: Parser | null = null;
    private languageCache: Map<string, Language> = new Map();
    private currentLanguageId: string | null = null;

    async initialize(): Promise<void> {
        await TreeSitter.Parser.init();
        this.parser = new TreeSitter.Parser();
    }

    async setLanguage(languageId: string): Promise<boolean> {
        const grammarName = LANGUAGE_GRAMMAR_MAP[languageId];
        if (!grammarName) {
            return false;
        }

        // Check if we already have this language loaded
        if (this.languageCache.has(grammarName)) {
            const language = this.languageCache.get(grammarName)!;
            this.parser!.setLanguage(language);
            this.currentLanguageId = languageId;
            return true;
        }

        // Try to load the language grammar
        try {
            const langPath = path.join(__dirname, `../grammars/tree-sitter-${grammarName}.wasm`);
            const language = await TreeSitter.Language.load(langPath);
            this.languageCache.set(grammarName, language);
            this.parser!.setLanguage(language);
            this.currentLanguageId = languageId;
            return true;
        } catch (error) {
            console.error(`Failed to load grammar for ${languageId}:`, error);
            return false;
        }
    }

    parseFunctions(sourceCode: string): FunctionInfo[] {
        if (!this.parser || !this.currentLanguageId) {
            throw new Error('Parser not initialized');
        }

        const tree = this.parser.parse(sourceCode);
        const functions: FunctionInfo[] = [];

        // Get the grammar name for looking up function node types
        const grammarName = LANGUAGE_GRAMMAR_MAP[this.currentLanguageId];
        const functionNodeTypes = FUNCTION_NODE_TYPES[grammarName] || [];

        const findFunctions = (node: SyntaxNode) => {
            // Check if this node is a function definition for the current language
            if (functionNodeTypes.includes(node.type)) {
                const nameNode = this.findFunctionName(node, grammarName);
                const bodyNode = this.getFunctionBody(node, grammarName);

                if (bodyNode && nameNode) {
                    const startLine = bodyNode.startPosition.row;
                    const endLine = bodyNode.endPosition.row;
                    const lineCount = endLine - startLine + 1;
                    // The declaration line is where the function node starts
                    const declarationLine = node.startPosition.row;

                    functions.push({
                        name: nameNode.text,
                        startLine,
                        endLine,
                        lineCount,
                        declarationLine
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

    private getFunctionBody(node: SyntaxNode, grammarName: string): SyntaxNode | null {
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
            return bodyNode;
        }

        // For some languages, we might need to look for specific child types
        if (grammarName === 'javascript' || grammarName === 'typescript' || grammarName === 'tsx') {
            // Arrow functions might have expression bodies
            for (const child of node.children) {
                if (child.type === 'statement_block' || child.type === 'expression') {
                    return child;
                }
            }
        }

        // Fallback: use the entire node
        return node;
    }

    private findFunctionName(node: SyntaxNode, grammarName: string): SyntaxNode | null {
        // Try to get the name field first (works for many languages)
        const nameNode = node.childForFieldName('name');
        if (nameNode && nameNode.type === 'identifier') {
            return nameNode;
        }

        // Language-specific handling
        if (grammarName === 'c' || grammarName === 'cpp') {
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
        } else if (grammarName === 'python' || grammarName === 'ruby') {
            // Python and Ruby use 'name' field
            return node.childForFieldName('name');
        } else if (grammarName === 'javascript' || grammarName === 'typescript' || grammarName === 'tsx') {
            // JavaScript/TypeScript can have various name locations
            const name = node.childForFieldName('name');
            if (name) return name;

            // For arrow functions, might be in parent assignment
            for (const child of node.children) {
                if (child.type === 'identifier') {
                    return child;
                }
            }
        } else if (grammarName === 'java' || grammarName === 'c_sharp') {
            // Java and C# use 'name' field
            return node.childForFieldName('name');
        } else if (grammarName === 'rust') {
            // Rust uses 'name' field
            return node.childForFieldName('name');
        } else if (grammarName === 'go') {
            // Go uses 'name' field
            return node.childForFieldName('name');
        }

        // Fallback: search for first identifier
        for (const child of node.children) {
            if (child.type === 'identifier') {
                return child;
            }
        }

        return null;
    }
}
