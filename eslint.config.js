import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['out/**', '**/out/**', 'node_modules/**', 'coverage/**', 'dist/**', '.claude/worktrees/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Honor the `_`-prefix convention already used across the codebase to mark
    // intentionally-unused bindings (e.g. `_dir`, `_scope`, unused port-method args).
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: {
        window: 'readonly',
        document: 'readonly',
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
  },
  prettier,
);
