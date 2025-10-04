import * as vscode from 'vscode';
import { CppParser, FunctionInfo } from './parser';
import { ColorCalculator, ColorConfig } from './colorCalculator';

let parser: CppParser;
let colorCalculator: ColorCalculator;
let decorationCache: Map<string, vscode.TextEditorDecorationType[]> = new Map();

export async function activate(context: vscode.ExtensionContext) {
    console.log('Function Highlight extension is now active');
    vscode.window.showInformationMessage('Function Highlight extension activated!');

    // Initialize parser and color calculator
    parser = new CppParser();
    colorCalculator = new ColorCalculator();

    try {
        console.log('Initializing parser...');
        await parser.initialize();
        console.log('Parser initialized successfully');
    } catch (error) {
        const errorMsg = `Failed to initialize C/C++ parser: ${error}`;
        console.error(errorMsg);
        vscode.window.showErrorMessage(errorMsg);
        return;
    }

    // Update decorations when active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                updateDecorations(editor);
            }
        })
    );

    // Update decorations when document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor;
            if (editor && event.document === editor.document) {
                updateDecorations(editor);
            }
        })
    );

    // Update decorations when configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('functionHighlight')) {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    // Clear old decorations
                    clearDecorations(editor.document.uri.toString());
                    updateDecorations(editor);
                }
            }
        })
    );

    // Initial decoration
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor);
    }
}

function clearDecorations(documentUri: string) {
    const decorations = decorationCache.get(documentUri);
    if (decorations) {
        decorations.forEach(decoration => decoration.dispose());
        decorationCache.delete(documentUri);
    }
}

function updateDecorations(editor: vscode.TextEditor) {
    console.log('updateDecorations called');
    const config = vscode.workspace.getConfiguration('functionHighlight');
    const enabled = config.get<boolean>('enabled', true);

    if (!enabled) {
        console.log('Extension disabled');
        clearDecorations(editor.document.uri.toString());
        return;
    }

    const document = editor.document;
    const languageId = document.languageId;
    console.log(`Document language: ${languageId}`);

    // Only process C/C++ files
    if (languageId !== 'c' && languageId !== 'cpp') {
        console.log('Not a C/C++ file, skipping');
        return;
    }

    // Clear previous decorations for this document
    clearDecorations(document.uri.toString());

    try {
        // Parse functions
        console.log('Parsing functions...');
        const sourceCode = document.getText();
        const functions = parser.parseFunctions(sourceCode);
        console.log(`Found ${functions.length} functions:`, functions);

        if (functions.length === 0) {
            console.log('No functions found');
            return;
        }

        // Get configuration
        const colorConfig: ColorConfig = {
            baseColor: config.get<string>('baseColor', '#ffff00'),
            minLines: config.get<number>('minLines', 5),
            maxLines: config.get<number>('maxLines', 100)
        };
        const borderWidth = config.get<number>('borderWidth', 4);

        // Detect theme type
        const isDarkTheme = isDarkColorTheme();

        // Create decorations for each function
        const newDecorations: vscode.TextEditorDecorationType[] = [];

        functions.forEach((func, index) => {
            const backgroundColor = colorCalculator.calculateColor(
                index,
                func.lineCount,
                colorConfig,
                isDarkTheme
            );
            const borderColor = colorCalculator.getBorderColor(
                index,
                func.lineCount,
                colorConfig,
                isDarkTheme
            );

            // Add alpha channel for transparency (50% opacity)
            const transparentColor = borderColor + '80'; // 80 = 50% in hex
            // Full opacity for minimap/overview ruler
            const brightMinimapColor = borderColor + 'FF'; // FF = 100% in hex

            console.log(`Function ${index + 1}. ${func.name} (${func.lineCount} lines): border=${transparentColor}, minimap=${brightMinimapColor}`);

            // Create border decorations using left and right borders
            // Very wide left/right borders create a full-width color overlay with transparency
            const borderType = vscode.window.createTextEditorDecorationType({
                isWholeLine: true,
                borderWidth: `0 ${borderWidth}px 0 ${borderWidth}px`, // top right bottom left
                borderStyle: 'solid',
                borderColor: transparentColor,
                overviewRulerColor: brightMinimapColor, // Bright, fully opaque in minimap
                overviewRulerLane: vscode.OverviewRulerLane.Full,
            });

            newDecorations.push(borderType);

            // Apply border to entire function range
            const range = new vscode.Range(
                new vscode.Position(func.startLine, 0),
                new vscode.Position(func.endLine, Number.MAX_SAFE_INTEGER)
            );

            console.log(`Applying border decoration to lines ${func.startLine}-${func.endLine}`);
            editor.setDecorations(borderType, [range]);
        });

        // Store decorations for cleanup
        decorationCache.set(document.uri.toString(), newDecorations);

    } catch (error) {
        console.error('Error updating decorations:', error);
    }
}

function isDarkColorTheme(): boolean {
    const theme = vscode.window.activeColorTheme;
    return theme.kind === vscode.ColorThemeKind.Dark ||
           theme.kind === vscode.ColorThemeKind.HighContrast;
}

export function deactivate() {
    // Clean up all decorations
    decorationCache.forEach(decorations => {
        decorations.forEach(decoration => decoration.dispose());
    });
    decorationCache.clear();
}
