# Linting & Code Quality

This document explains the linting and code formatting setup for the Trustware SDK.

## Overview

The project uses the following tools to maintain code quality:

- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **TypeScript** - Type checking
- **EditorConfig** - Basic editor configuration

## Available Scripts

### Linting

```bash
# Run ESLint (allows warnings)
npm run lint

# Run ESLint with zero warnings tolerance (for CI)
npm run lint:strict

# Run ESLint and auto-fix issues
npm run lint:fix
```

### Formatting

```bash
# Format all source files
npm run format

# Check if files are formatted correctly
npm run format:check
```

### Type Checking

```bash
# Run TypeScript type checker
npm run typecheck
```

### Full Validation

```bash
# Run all checks (typecheck + lint:strict + format:check)
npm run validate
```

## Configuration Files

### ESLint (`eslint.config.js`)

Uses the new flat config format with:
- TypeScript ESLint rules
- React and React Hooks rules
- Prettier integration

Key features:
- Relaxed rules for existing codebase
- TypeScript type-checked linting
- React hooks validation
- Import/export organization

### Prettier (`.prettierrc`)

Standard Prettier configuration:
- 2 space indentation
- Semicolons enabled
- Double quotes for strings
- 80 character line width
- LF line endings

### EditorConfig (`.editorconfig`)

Cross-editor configuration for:
- Character encoding (UTF-8)
- Line endings (LF)
- Indentation (2 spaces)
- Trailing whitespace handling

## IDE Setup

### VS Code

Install these extensions:
- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- EditorConfig (`editorconfig.editorconfig`)

Enable format on save in your user settings:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

### WebStorm / IntelliJ IDEA

1. Go to `Settings > Languages & Frameworks > JavaScript > Code Quality Tools > ESLint`
2. Enable "Automatic ESLint configuration"
3. Enable "Run eslint --fix on save"

For Prettier:
1. Go to `Settings > Languages & Frameworks > JavaScript > Prettier`
2. Set Prettier package path
3. Enable "On save" or "On Reformat Code action"

### Vim/Neovim

Use plugins like:
- `dense-analysis/ale` or `neovim/nvim-lspconfig` for ESLint
- `prettier/vim-prettier` for Prettier
- `editorconfig/editorconfig-vim` for EditorConfig

## CI/CD Integration

For continuous integration, use the strict validation:

```yaml
# GitHub Actions example
- name: Install dependencies
  run: npm ci

- name: Run validation
  run: npm run validate
```

This will:
1. Type check with TypeScript
2. Lint with zero warnings allowed
3. Verify code formatting

## Common Issues

### "Unexpected any" warnings

The codebase allows `any` types as warnings. To fix:
- Replace `any` with proper types when possible
- Use `unknown` and type guards for truly dynamic data
- Add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` for necessary cases

### React Hooks warnings

Common issues:
- `exhaustive-deps`: Add missing dependencies or use `useCallback`/`useMemo`
- `rules-of-hooks`: Only call hooks at the top level of components

### Formatting conflicts

If you see formatting issues:
1. Run `npm run format` to auto-fix
2. Ensure your editor is using the project's Prettier config
3. Check that EditorConfig is enabled in your editor

## Updating Rules

To modify linting rules:

1. Edit `eslint.config.js`
2. Run `npm run lint` to test
3. Use `npm run lint:fix` to auto-fix what's possible
4. Run `npm run validate` to ensure everything passes

## Pre-commit Hooks (Optional)

To automatically lint and format on commit, install `husky` and `lint-staged`:

```bash
npm install --save-dev husky lint-staged

# Initialize husky
npx husky init

# Add pre-commit hook
echo "npx lint-staged" > .husky/pre-commit
```

Add to `package.json`:
```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

## Resources

- [ESLint Documentation](https://eslint.org/)
- [TypeScript ESLint](https://typescript-eslint.io/)
- [Prettier Documentation](https://prettier.io/)
- [EditorConfig](https://editorconfig.org/)