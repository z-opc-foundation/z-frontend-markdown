import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * z-frontend-markdown 构建配置。
 *
 * ⚠ external 用**函数式**判定（不是字符串数组）：
 *   `react-markdown` / `remark-gfm` / `rehype-highlight` / `highlight.js`
 *   这几个包会拉**子路径** import（如 `highlight.js/lib/core`），
 *   字符串数组匹配不到前缀 ⇒ 会被打进本包 dist ⇒ 双实例 + 包体膨胀。
 *
 * ⚠ `vditor/dist/index.css` 是**副作用 CSS import**，不能 external 掉
 *   （external 后本包不产出该 CSS，宿主就丢了 vditor 的基础样式）。
 */
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    build: {
        lib: {
            entry: {
                index: path.resolve(__dirname, 'src/index.js'),
            },
            formats: ['es'],
        },
        outDir: 'dist',
        emptyOutDir: false,
        sourcemap: false,
        rollupOptions: {
            external: (id) =>
                id === 'react' ||
                id === 'react-dom' ||
                id === 'react-dom/client' ||
                id === 'react/jsx-runtime' ||
                id === 'antd' ||
                id === '@ant-design/icons' ||
                id === 'react-markdown' ||
                id === 'remark-gfm' ||
                id === 'rehype-highlight' ||
                id === 'vditor' ||
                id === 'unified' ||
                id === 'highlight.js' ||
                id.startsWith('highlight.js/'),
        },
    },
})
