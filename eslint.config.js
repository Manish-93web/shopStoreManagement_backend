import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
    // src/scripts/** holds one-off admin/seed scripts run manually via `tsx`/`node`,
    // never imported by app.ts — not application source, so not linted as such.
    { ignores: ['dist/**', 'node_modules/**', 'uploads/**', 'src/scripts/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off',
        },
    },
    prettierConfig
);
