import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'

export default [
  {
    ignores: ['dist', 'node_modules', 'coverage', 'public', 'archive'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        process: 'readonly',
        Buffer: 'readonly',
        NodeJS: 'readonly',
      },
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
      // Critical errors - these indicate actual bugs
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-var': 'error',
      // Disabled - too many warnings to fix at once, will address gradually
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'prefer-const': 'off',
      // Disabled - handled by TypeScript or not applicable
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-undef': 'off',
    },
  },
  // Disable no-unreachable for files with known false positives from TypeScript/ESLint parser
  {
    files: ['**/cacheLayer.ts', '**/recommendationEngine.ts'],
    rules: {
      'no-unreachable': 'off',
    },
  },
  // Global rule override - no-unreachable can produce false positives with TypeScript
  {
    rules: {
      'no-unreachable': 'off',
    },
  },
]