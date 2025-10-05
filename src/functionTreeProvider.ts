import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FunctionInfo } from './parser';
import { ColorCalculator, ColorConfig } from './colorCalculator';

export class FunctionTreeItem extends vscode.TreeItem {
    constructor(
        public readonly functionInfo: FunctionInfo,
        public readonly index: number,
        public readonly color: string,
        public readonly iconPath: vscode.Uri,
        public readonly command?: vscode.Command
    ) {
        super(functionInfo.name, vscode.TreeItemCollapsibleState.None);

        this.description = `${functionInfo.lineCount} lines`;
        this.tooltip = `${functionInfo.name}\nLines: ${functionInfo.declarationLine + 1}-${functionInfo.endLine + 1}\nLength: ${functionInfo.lineCount} lines`;
        this.contextValue = 'function';
    }
}

export class FunctionTreeProvider implements vscode.TreeDataProvider<FunctionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FunctionTreeItem | undefined | null | void> = new vscode.EventEmitter<FunctionTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FunctionTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private functions: FunctionInfo[] = [];
    private currentDocument: vscode.TextDocument | undefined;
    private colorCalculator: ColorCalculator;
    private extensionContext: vscode.ExtensionContext;

    constructor(
        colorCalculator: ColorCalculator,
        extensionContext: vscode.ExtensionContext
    ) {
        this.colorCalculator = colorCalculator;
        this.extensionContext = extensionContext;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    updateFunctions(functions: FunctionInfo[], document: vscode.TextDocument): void {
        this.functions = functions;
        this.currentDocument = document;
        this.refresh();
    }

    clear(): void {
        this.functions = [];
        this.currentDocument = undefined;
        this.refresh();
    }

    getTreeItem(element: FunctionTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FunctionTreeItem): Thenable<FunctionTreeItem[]> {
        if (element) {
            // No nested items
            return Promise.resolve([]);
        }

        if (!this.currentDocument || this.functions.length === 0) {
            return Promise.resolve([]);
        }

        // Create tree items for each function
        const isDarkTheme = this.isDarkColorTheme();
        const colorConfig: ColorConfig = {
            baseColor: '#ffff00',
            minLines: 5,
            maxLines: 100
        };

        const items = this.functions.map((func, index) => {
            const borderColor = this.colorCalculator.getBorderColor(
                index,
                func.lineCount,
                colorConfig,
                isDarkTheme
            );

            // Create icon for this function (colored circle)
            const iconPath = this.createFunctionIcon(borderColor, index);

            // Create command to jump to function
            const command: vscode.Command = {
                command: 'functionHighlight.goToFunction',
                title: 'Go to Function',
                arguments: [func, this.currentDocument]
            };

            return new FunctionTreeItem(func, index, borderColor, iconPath, command);
        });

        return Promise.resolve(items);
    }

    private isDarkColorTheme(): boolean {
        const theme = vscode.window.activeColorTheme;
        return theme.kind === vscode.ColorThemeKind.Dark ||
               theme.kind === vscode.ColorThemeKind.HighContrast;
    }

    private createFunctionIcon(color: string, index: number): vscode.Uri {
        // Create a colored circle icon with the function number
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" fill="${color}" stroke="${color}" stroke-width="1" />
            <text x="10" y="14" font-family="Arial" font-size="10" font-weight="bold" fill="white" text-anchor="middle">${(index % 10) + 1}</text>
        </svg>`;

        const fileName = `func-icon-${color.substring(1)}-${index}.svg`;
        const filePath = path.join(this.extensionContext.extensionPath, '.icons', fileName);

        // Ensure .icons directory exists
        const iconsDir = path.join(this.extensionContext.extensionPath, '.icons');
        if (!fs.existsSync(iconsDir)) {
            fs.mkdirSync(iconsDir, { recursive: true });
        }

        // Write SVG file
        fs.writeFileSync(filePath, svgContent);

        return vscode.Uri.file(filePath);
    }
}
