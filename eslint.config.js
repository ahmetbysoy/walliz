import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import boundaries from 'eslint-plugin-boundaries'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'node_modules',
      'coverage',
      'playwright-report',
      'test-results',
      'stats.html',
      'scripts/gen-icons.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      boundaries,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.app.json',
        },
      },
      'boundaries/elements': [
        { type: 'market-feed', pattern: 'src/features/market-feed/**' },
        { type: 'orderbook', pattern: 'src/features/orderbook/**' },
        { type: 'chart', pattern: 'src/features/chart/**' },
        { type: 'pyramid', pattern: 'src/features/pyramid/**' },
        { type: 'prediction', pattern: 'src/features/prediction/**' },
        { type: 'learning-memory', pattern: 'src/features/learning-memory/**' },
        { type: 'preferences', pattern: 'src/features/preferences/**' },
        { type: 'entities', pattern: 'src/entities/**' },
        { type: 'shared', pattern: 'src/shared/**' },
        { type: 'app', pattern: 'src/app/**' },
      ],
    },
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        self: 'readonly',
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // ---- Feature-sliced sınırları ----
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message:
            '${file.type} → ${dependency.type} import edemez (feature-sliced: features yalnızca entities + shared görür)',
          rules: [
            { from: 'market-feed', allow: ['entities', 'shared'] },
            { from: 'orderbook', allow: ['entities', 'shared'] },
            { from: 'chart', allow: ['entities', 'shared'] },
            { from: 'pyramid', allow: ['entities', 'shared'] },
            { from: 'prediction', allow: ['entities', 'shared'] },
            { from: 'learning-memory', allow: ['entities', 'shared'] },
            { from: 'preferences', allow: ['entities', 'shared'] },
            { from: 'entities', allow: ['shared'] },
            { from: 'shared', allow: ['entities'] },
            {
              from: 'app',
              allow: [
                'market-feed',
                'orderbook',
                'chart',
                'pyramid',
                'prediction',
                'learning-memory',
                'preferences',
                'entities',
                'shared',
              ],
            },
          ],
        },
      ],
      'boundaries/no-unknown': 'error',
    },
  },
  prettier,
)
