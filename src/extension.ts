import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CppParser, FunctionInfo } from './parser';
import { ColorCalculator, ColorConfig } from './colorCalculator';
import { FunctionTreeProvider } from './functionTreeProvider';

let parser: CppParser;
let colorCalculator: ColorCalculator;
let decorationCache: Map<string, vscode.TextEditorDecorationType[]> = new Map();
let extensionContext: vscode.ExtensionContext;
let functionTreeProvider: FunctionTreeProvider;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Function Highlight extension is now active');
    vscode.window.showInformationMessage('Function Highlight extension activated!');

    // Store context for later use
    extensionContext = context;

    // Initialize parser and color calculator
    parser = new CppParser();
    colorCalculator = new ColorCalculator();
    functionTreeProvider = new FunctionTreeProvider(colorCalculator, context);

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

    // Register tree view
    const treeView = vscode.window.createTreeView('functionHighlight.functionsView', {
        treeDataProvider: functionTreeProvider,
        showCollapseAll: false
    });
    context.subscriptions.push(treeView);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('functionHighlight.goToFunction',
            (functionInfo: FunctionInfo, document: vscode.TextDocument) => {
                goToFunction(functionInfo, document);
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('functionHighlight.refreshFunctions', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                updateDecorations(editor);
            }
        })
    );

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

function goToFunction(functionInfo: FunctionInfo, document: vscode.TextDocument): void {
    // Open the document and reveal the function declaration line
    vscode.window.showTextDocument(document).then(editor => {
        const position = new vscode.Position(functionInfo.declarationLine, 0);
        const range = new vscode.Range(position, position);

        // Reveal and select the line
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(position, position);
    });
}

function clearDecorations(documentUri: string) {
    const decorations = decorationCache.get(documentUri);
    if (decorations) {
        decorations.forEach(decoration => decoration.dispose());
        decorationCache.delete(documentUri);
    }
}

async function updateDecorations(editor: vscode.TextEditor) {
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

    // Check if this language is disabled
    const disabledLanguages = config.get<string[]>('disabledLanguages', []);
    if (disabledLanguages.includes(languageId)) {
        console.log(`Language ${languageId} is disabled in settings, skipping`);
        clearDecorations(document.uri.toString());
        return;
    }

    // Try to set the language for the parser
    const languageSupported = await parser.setLanguage(languageId);
    if (!languageSupported) {
        console.log(`Language ${languageId} not supported, skipping`);
        clearDecorations(document.uri.toString());
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

        // Update tree view with parsed functions
        if (functions.length === 0) {
            console.log('No functions found');
            functionTreeProvider.clear();
            return;
        }

        functionTreeProvider.updateFunctions(functions, document);

        // Use fixed defaults
        const colorConfig: ColorConfig = {
            baseColor: '#ffff00',
            minLines: 5,
            maxLines: 100
        };
        const borderWidth = 5000;

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

            // Create SVG files for gutter icons
            const arrowSvgPath = createGutterArrowIcon(borderColor);
            const lineSvgPath = createGutterLineIcon(borderColor);
            const lineEndSvgPath = createGutterLineEndIcon(borderColor);

            // Create gutter line decoration for function body (vertical line in gutter)
            const gutterLineType = vscode.window.createTextEditorDecorationType({
                gutterIconPath: lineSvgPath,
                gutterIconSize: 'auto',
                light: {
                    gutterIconPath: lineSvgPath,
                },
                dark: {
                    gutterIconPath: lineSvgPath,
                },
                overviewRulerColor: brightMinimapColor,
                overviewRulerLane: vscode.OverviewRulerLane.Left,
            });

            // Create gutter line end decoration for last line (vertical line with ball)
            const gutterLineEndType = vscode.window.createTextEditorDecorationType({
                gutterIconPath: lineEndSvgPath,
                gutterIconSize: 'auto',
                light: {
                    gutterIconPath: lineEndSvgPath,
                },
                dark: {
                    gutterIconPath: lineEndSvgPath,
                },
                overviewRulerColor: brightMinimapColor,
                overviewRulerLane: vscode.OverviewRulerLane.Left,
            });

            // Create gutter arrow decoration for function start (arrow in gutter)
            const gutterArrowType = vscode.window.createTextEditorDecorationType({
                gutterIconPath: arrowSvgPath,
                gutterIconSize: 'auto',
                light: {
                    gutterIconPath: arrowSvgPath,
                },
                dark: {
                    gutterIconPath: arrowSvgPath,
                },
                overviewRulerColor: brightMinimapColor,
                overviewRulerLane: vscode.OverviewRulerLane.Left,
            });

            console.log(`Creating gutter decorations for ${func.name}:`);
            console.log(`  - Border color: ${borderColor}`);
            console.log(`  - Bright color: ${brightMinimapColor}`);
            console.log(`  - Arrow icon: ${arrowSvgPath}`);
            console.log(`  - Line icon: ${lineSvgPath}`);
            console.log(`  - Line end icon: ${lineEndSvgPath}`);

            newDecorations.push(borderType, gutterLineType, gutterLineEndType, gutterArrowType);

            // Apply border to entire function range
            const functionRange = new vscode.Range(
                new vscode.Position(func.startLine, 0),
                new vscode.Position(func.endLine, Number.MAX_SAFE_INTEGER)
            );

            // Apply gutter line to function body (excluding declaration and last line)
            const bodyRanges: vscode.Range[] = [];
            for (let line = func.declarationLine + 1; line < func.endLine; line++) {
                bodyRanges.push(new vscode.Range(
                    new vscode.Position(line, 0),
                    new vscode.Position(line, Number.MAX_SAFE_INTEGER)
                ));
            }

            // Apply arrow only to the function declaration line
            const arrowRange = new vscode.Range(
                new vscode.Position(func.declarationLine, 0),
                new vscode.Position(func.declarationLine, Number.MAX_SAFE_INTEGER)
            );

            // Apply line end (with ball) to the last line of the function
            const lineEndRange = new vscode.Range(
                new vscode.Position(func.endLine, 0),
                new vscode.Position(func.endLine, Number.MAX_SAFE_INTEGER)
            );

            console.log(`Applying decorations for ${func.name}:`);
            console.log(`  - Declaration line: ${func.declarationLine} (arrow)`);
            console.log(`  - Body lines: ${func.declarationLine + 1}-${func.endLine - 1} (line)`);
            console.log(`  - End line: ${func.endLine} (line with ball)`);
            console.log(`  - Gutter line ranges: ${bodyRanges.length} lines`);

            editor.setDecorations(borderType, [functionRange]);
            editor.setDecorations(gutterLineType, bodyRanges);
            editor.setDecorations(gutterLineEndType, [lineEndRange]);
            editor.setDecorations(gutterArrowType, [arrowRange]);
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

function createGutterArrowIcon(color: string): vscode.Uri {
    // Create a larger, more visible arrow icon
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
        <polygon points="4,2 16,10 4,18" fill="${color}" stroke="${color}" stroke-width="1" />
    </svg>`;

    const fileName = `arrow-${color.substring(1)}.svg`;
    const filePath = path.join(extensionContext.extensionPath, '.icons', fileName);

    // Ensure .icons directory exists
    const iconsDir = path.join(extensionContext.extensionPath, '.icons');
    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Write SVG file
    fs.writeFileSync(filePath, svgContent);

    console.log(`Created arrow icon at: ${filePath}`);

    return vscode.Uri.file(filePath);
}

function createGutterLineIcon(color: string): vscode.Uri {
    // Create a bold vertical line icon
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
        <rect x="8" y="0" width="4" height="20" fill="${color}" />
    </svg>`;

    const fileName = `line-${color.substring(1)}.svg`;
    const filePath = path.join(extensionContext.extensionPath, '.icons', fileName);

    // Ensure .icons directory exists
    const iconsDir = path.join(extensionContext.extensionPath, '.icons');
    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Write SVG file
    fs.writeFileSync(filePath, svgContent);

    console.log(`Created line icon at: ${filePath}`);

    return vscode.Uri.file(filePath);
}

function createGutterLineEndIcon(color: string): vscode.Uri {
    // Create a vertical line with a ball/dot at the bottom
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
        <rect x="8" y="0" width="4" height="14" fill="${color}" />
        <circle cx="10" cy="16" r="4" fill="${color}" />
    </svg>`;

    const fileName = `line-end-${color.substring(1)}.svg`;
    const filePath = path.join(extensionContext.extensionPath, '.icons', fileName);

    // Ensure .icons directory exists
    const iconsDir = path.join(extensionContext.extensionPath, '.icons');
    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Write SVG file
    fs.writeFileSync(filePath, svgContent);

    console.log(`Created line-end icon at: ${filePath}`);

    return vscode.Uri.file(filePath);
}

export function deactivate() {
    // Clean up all decorations
    decorationCache.forEach(decorations => {
        decorations.forEach(decoration => decoration.dispose());
    });
    decorationCache.clear();

    // Clean up icon files
    const iconsDir = path.join(extensionContext.extensionPath, '.icons');
    if (fs.existsSync(iconsDir)) {
        fs.rmSync(iconsDir, { recursive: true, force: true });
    }
}
