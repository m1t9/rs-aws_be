import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/*.js', '**/*.d.ts', 'node_modules/', '**/deploy/', '**/cdk.out/'],
  },
  {
    rules: {
      'indent': ['error', 2],
    },
  },
);
