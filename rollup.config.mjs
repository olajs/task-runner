import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  // output: formats[process.env.FORMAT],
  output: [
    {
      file: 'dist/cjs/index.js',
      format: 'cjs',
      exports: 'named'
    },
    {
      file: 'dist/esm/index.mjs',
      format: 'es',
    }
  ],
  plugins: [
    typescript(),
  ],
};
