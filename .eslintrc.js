module.exports = {
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    env: {
        node: true,
        es6: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2017,
        sourceType: 'module',
    },
    plugins: [
        '@typescript-eslint/eslint-plugin',
    ],
    rules: {
        '@typescript-eslint/member-naming': ['error', {
            'private': '^_',
            'protected': '^_',
        }],
        '@typescript-eslint/camelcase': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/member-delimiter-style': ['error', {
            multiline: {
                delimiter: 'none',
            },
            singleline: {
                delimiter: 'comma',
            },
        }],
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-constant-condition': 'off',
        'prefer-const': 'off',
        'require-atomic-updates': 'off',
        'no-debugger': 'off',
    },
    ignorePatterns: [
        'private/**/*',
        'docs/**/*',
        'dist/**/*',
    ],
}
