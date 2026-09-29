import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'playwright-report',
      'test-results',
      'src/partage/api/schema.d.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.flat.recommended.rules,
      ...jsxA11y.flatConfigs.strict.rules,
      // Aucun HTML brut injecté : c'est la première défense contre la XSS avec la CSP.
      'react/no-danger': 'error',
      'react/no-danger-with-children': 'error',
      // TanStack Router interrompt la navigation en lançant un objet redirect().
      '@typescript-eslint/only-throw-error': [
        'error',
        { allow: [{ from: 'package', package: '@tanstack/router-core', name: 'Redirect' }] },
      ],
      // Le jeton d'accès ne doit jamais toucher le stockage du navigateur (ADR backend 0002).
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Stockage persistant interdit pour les données sensibles.',
        },
        {
          name: 'sessionStorage',
          message: 'Stockage persistant interdit pour les données sensibles.',
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'Stockage persistant interdit.' },
        { object: 'window', property: 'sessionStorage', message: 'Stockage persistant interdit.' },
      ],
    },
  },
  {
    // Les tests vérifient justement que rien n'est écrit dans le stockage.
    files: ['src/**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // Le fichier de configuration ESLint n'est pas typé : les plugins n'exportent pas de types.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['*.config.{js,ts}', 'scripts/**', 'e2e/**', 'e2e-reel/**'],
    languageOptions: { globals: { ...globals.node } },
  },
)
