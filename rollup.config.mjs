import typescript from '@rollup/plugin-typescript';

const formats = {
    esm: {
        format: 'esm',
        dir: 'dist/esm'
    },
    cjs: {
        format: 'cjs',
        dir: 'dist/cjs'
    }
};

export default {
    input: 'src/index.ts',
    output: formats[process.env.FORMAT],
    plugins: [
        typescript({
            outputToFilesystem: true,
            compilerOptions: {
                module: process.env.FORMAT === 'esm' ? 'ESNext' : 'CommonJS'
            }
        })
    ],
    external: []
};
