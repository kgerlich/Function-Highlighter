# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension that highlights functions with distinct pastel colors across multiple programming languages. It uses tree-sitter parsers for accurate AST-based function detection.

**Supported Languages:** C, C++, Python, JavaScript, TypeScript (including TSX/JSX), Java, Rust, Go, Ruby, PHP, C#, Bash

## Architecture

**Core Components:**
- `src/parser.ts`: Multi-language parser that dynamically loads tree-sitter grammars based on file type
  - `LANGUAGE_GRAMMAR_MAP`: Maps VS Code language IDs to tree-sitter grammar names
  - `FUNCTION_NODE_TYPES`: Defines which AST node types represent functions in each language
  - Language cache for performance
- `src/colorCalculator.ts`: Calculates background colors from a 10-color pastel palette with theme awareness
  - Separate palettes for light/dark themes
  - Slight brightness modulation based on function length
- `src/extension.ts`: Main extension that registers VS Code event handlers and applies text decorations
  - Async language loading before parsing
  - Per-document decoration cache
  - Gutter icon generation (SVG files)
  - Tree view registration and commands
- `src/functionTreeProvider.ts`: TreeDataProvider for function list sidebar
  - Implements VS Code TreeDataProvider interface
  - Creates color-coded tree items with numbered icons
  - Handles click-to-navigate functionality
- `grammars/`: Tree-sitter WASM grammar files for all supported languages
- `resources/`: Extension icons (Activity Bar icon)

**Key Design Decisions:**
- Uses tree-sitter for accurate AST-based parsing (not regex)
- Dynamic language detection and grammar loading at runtime
- Each function gets a distinct color from a 10-color rotating palette
- Brightness slightly increases with function length (subtle visual cue)
- Semi-transparent color overlays don't interfere with syntax highlighting
- Bright, opaque colors in minimap/scrollbar for easy navigation
- Gutter decorations: arrow on declaration, vertical line on body, ball end on last line
- Function list sidebar with Activity Bar integration
- Fixed configuration (only `enabled` and `disabledLanguages` settings)

## Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Test extension
# Press F5 in VS Code to launch Extension Development Host
```

## Adding New Languages

To add support for a new language:

1. Install the tree-sitter grammar: `npm install --save tree-sitter-<language>`
2. Copy the WASM file to `grammars/`: `cp node_modules/tree-sitter-<language>/tree-sitter-<language>.wasm grammars/`
3. Update `LANGUAGE_GRAMMAR_MAP` in `src/parser.ts` to map the VS Code language ID to the grammar name
4. Update `FUNCTION_NODE_TYPES` in `src/parser.ts` with the AST node types that represent functions in that language
5. Add activation event in `package.json`: `"onLanguage:<languageId>"`
6. Update `package.json` description and keywords
7. Update README.md supported languages table

## Tree-sitter Type Issues

The web-tree-sitter package doesn't have proper TypeScript definitions. The parser.ts file uses `require()` and `any` types to work around this. When modifying parser.ts:
- Import tree-sitter with: `const TreeSitter = require('web-tree-sitter');`
- Initialize with: `await TreeSitter.Parser.init()`
- Create parser with: `new TreeSitter.Parser()`
- Load language: `await TreeSitter.Language.load(wasmPath)`

## Configuration Settings

All settings are under the `functionHighlight` namespace:
- `enabled`: Toggle highlighting on/off globally (default: true)
- `disabledLanguages`: Array of language IDs to exclude from highlighting (default: [])
  - Example: `["javascript", "python"]` disables highlighting for those languages only
  - Available IDs: c, cpp, python, javascript, typescript, typescriptreact, javascriptreact, java, rust, go, ruby, php, csharp, bash

All other parameters (colors, line thresholds, border width) are fixed for consistency.
