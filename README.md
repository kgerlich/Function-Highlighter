# Function Highlighter

Highlights functions with distinct pastel colors across multiple programming languages, inspired by [Godbolt Compiler Explorer](https://godbolt.org/).

## Features

- **Multi-language support**: C, C++, Python, JavaScript, TypeScript (including TSX/JSX), Java, Rust, Go, Ruby, PHP, C#, and Bash
- Each function gets a unique color overlay from 10 rotating pastel colors
- **Gutter decorations**: Arrow (▶) on function declaration, vertical line along body, ball end (●) on last line
- **Function list sidebar**: Clickable tree view showing all functions in the current file
- Bright colors in minimap/scrollbar for easy navigation
- Automatically adapts to your theme (light/dark)
- Uses tree-sitter for accurate AST-based parsing

## Supported Languages

| Language | File Extensions | Function Types Detected |
|----------|----------------|------------------------|
| C | `.c` | Functions |
| C++ | `.cpp`, `.cc`, `.cxx` | Functions |
| Python | `.py` | Functions/Methods |
| JavaScript | `.js`, `.jsx` | Functions, arrow functions, methods |
| TypeScript | `.ts`, `.tsx` | Functions, arrow functions, methods |
| Java | `.java` | Methods, constructors |
| Rust | `.rs` | Functions |
| Go | `.go` | Functions, methods |
| Ruby | `.rb` | Methods |
| PHP | `.php` | Functions, methods |
| C# | `.cs` | Methods, constructors |
| Bash | `.sh` | Functions |

## Installation

### From Source

1. Clone this repository
2. Run `npm install`
3. Run `npm run compile`
4. Press F5 in VS Code to launch Extension Development Host

## Using the Function List Sidebar

1. Click the **Function Highlight** icon in the Activity Bar (left sidebar)
2. The Functions panel shows all functions in the current file
3. Each function displays:
   - Color-coded numbered icon (1-10) matching the gutter color
   - Function name
   - Line count (e.g., "25 lines")
4. Click any function to jump to its declaration
5. Use the refresh button (↻) to manually update the list

## Configuration

Search for "Function Highlight" in VS Code settings:

- `functionHighlight.enabled` - Enable/disable highlighting globally (default: `true`)
- `functionHighlight.disabledLanguages` - Array of language IDs to exclude from highlighting (default: `[]`)
  - Example: `["javascript", "python"]` to disable highlighting for JavaScript and Python files only
  - Available language IDs: `c`, `cpp`, `python`, `javascript`, `typescript`, `typescriptreact`, `javascriptreact`, `java`, `rust`, `go`, `ruby`, `php`, `csharp`, `bash`

All other settings (colors, line thresholds) are fixed for consistency.

## How It Works

The extension uses tree-sitter parsers to build an Abstract Syntax Tree (AST) of your code, accurately identifying function boundaries. Each function is highlighted with a semi-transparent color overlay that's visible both in the editor and the minimap.

## License

MIT
