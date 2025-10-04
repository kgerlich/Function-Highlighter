# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension for C/C++ that highlights functions with background colors based on their length. Longer functions get brighter backgrounds to identify code that might need refactoring.

## Architecture

**Core Components:**
- `src/parser.ts`: Uses tree-sitter AST parser to detect C/C++ function boundaries
- `src/colorCalculator.ts`: Calculates background colors based on function line count with WCAG contrast checking
- `src/extension.ts`: Main extension that registers VS Code event handlers and applies text decorations
- `grammars/tree-sitter-cpp.wasm`: Tree-sitter C++ grammar for AST parsing

**Key Design Decisions:**
- Uses tree-sitter for accurate AST-based parsing (not regex)
- Color brightness scales with function length (configurable min/max thresholds)
- Implements WCAG AA contrast checking (3.5:1 ratio) to ensure text readability
- Decorations update on document changes and theme changes
- Uses semi-transparent backgrounds (alpha 0.03-0.20) to avoid overwhelming the editor

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

## Tree-sitter Type Issues

The web-tree-sitter package doesn't have proper TypeScript definitions. The parser.ts file uses `require()` and `any` types to work around this. When modifying parser.ts:
- Import tree-sitter with: `const TreeSitter = require('web-tree-sitter');`
- Initialize with: `await TreeSitter.init()`
- Create parser with: `new TreeSitter.Parser()`

## Configuration Settings

All settings are under the `functionHighlight` namespace:
- `enabled`: Toggle highlighting on/off
- `baseColor`: Hex color for highlighting (default: #ffff00 yellow)
- `minLines`/`maxLines`: Line count thresholds for brightness scaling
- `borderWidth`: Function boundary line thickness in pixels
