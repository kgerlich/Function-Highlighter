import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FunctionInfo } from './parser';
import { ColorCalculator, ColorConfig } from './colorCalculator';

// Base tree item type
type TreeElement = ClassTreeItem | FunctionTreeItem;

// Tree item representing a class/namespace
export class ClassTreeItem extends vscode.TreeItem {
    constructor(
        public readonly className: string,
        public readonly functions: FunctionInfo[]
    ) {
        super(className, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'class';
        this.description = `${functions.length} ${functions.length === 1 ? 'function' : 'functions'}`;
    }
}

// Tree item representing a function
export class FunctionTreeItem extends vscode.TreeItem {
    constructor(
        public readonly functionInfo: FunctionInfo,
        public readonly index: number,
        public readonly color: string,
        public readonly iconPath: vscode.Uri,
        public readonly command?: vscode.Command
    ) {
        // Create a label with color indicator and function name
        // We'll style the background using the description field with ANSI-like formatting
        super(functionInfo.name, vscode.TreeItemCollapsibleState.None);

        // Set description with line count and add a visual color indicator
        this.description = `${functionInfo.lineCount} lines`;

        const fullName = functionInfo.className
            ? `${functionInfo.className}::${functionInfo.name}`
            : functionInfo.name;
        this.tooltip = `${fullName}\nLines: ${functionInfo.declarationLine + 1}-${functionInfo.endLine + 1}\nLength: ${functionInfo.lineCount} lines\nColor: ${color}`;
        this.contextValue = 'function';
    }
}

export class FunctionTreeProvider implements vscode.TreeDataProvider<TreeElement> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeElement | undefined | null | void> = new vscode.EventEmitter<TreeElement | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeElement | undefined | null | void> = this._onDidChangeTreeData.event;

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

    getTreeItem(element: TreeElement): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeElement): Thenable<TreeElement[]> {
        if (!this.currentDocument || this.functions.length === 0) {
            return Promise.resolve([]);
        }

        // If element is a ClassTreeItem, return its functions
        if (element instanceof ClassTreeItem) {
            return Promise.resolve(this.createFunctionItems(element.functions));
        }

        // If element is a FunctionTreeItem, it has no children
        if (element instanceof FunctionTreeItem) {
            return Promise.resolve([]);
        }

        // Root level: group functions by class/namespace
        return Promise.resolve(this.createRootItems());
    }

    private createRootItems(): TreeElement[] {
        // Group functions by class name
        const grouped = new Map<string, FunctionInfo[]>();
        const globalFunctions: FunctionInfo[] = [];

        this.functions.forEach(func => {
            if (func.className) {
                if (!grouped.has(func.className)) {
                    grouped.set(func.className, []);
                }
                grouped.get(func.className)!.push(func);
            } else {
                globalFunctions.push(func);
            }
        });

        const items: TreeElement[] = [];

        // Add class/namespace groups first
        grouped.forEach((functions, className) => {
            items.push(new ClassTreeItem(className, functions));
        });

        // Add global functions
        items.push(...this.createFunctionItems(globalFunctions));

        return items;
    }

    private createFunctionItems(functions: FunctionInfo[]): FunctionTreeItem[] {
        const isDarkTheme = this.isDarkColorTheme();
        const colorConfig: ColorConfig = {
            baseColor: '#ffff00',
            minLines: 5,
            maxLines: 100
        };

        return functions.map(func => {
            // Find the original index in the full functions array
            const index = this.functions.indexOf(func);

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
    }

    private isDarkColorTheme(): boolean {
        const theme = vscode.window.activeColorTheme;
        return theme.kind === vscode.ColorThemeKind.Dark ||
               theme.kind === vscode.ColorThemeKind.HighContrast;
    }

    private createFunctionIcon(color: string, index: number): vscode.Uri {
        // Create an icon with colored background and function number
        // The icon shows a colored rectangle background (like in the editor) with the number
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="16" viewBox="0 0 80 16">
            <rect x="0" y="0" width="80" height="16" fill="${color}" opacity="0.3" />
            <circle cx="8" cy="8" r="6" fill="${color}" stroke="${color}" stroke-width="1" />
            <text x="8" y="11" font-family="Arial" font-size="8" font-weight="bold" fill="white" text-anchor="middle">${(index % 10) + 1}</text>
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
