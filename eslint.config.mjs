import globals from 'globals';
import eslint from '@eslint/js';
import tslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tslint.config(eslint.configs.recommended, tslint.configs.recommended, eslintConfigPrettier, {
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
});
