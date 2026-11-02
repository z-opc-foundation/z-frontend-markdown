/**
 * Mermaid 运行时 —— 与 Vditor 一致，从 public/vditor 加载 mermaid，
 * 避免额外 npm 依赖与 unpkg 外网请求。
 */
import {normalizeMermaidSource} from './mermaidUtils'

let initPromise = null
let initialized = false

/**
 * vditor 静态资源基址。
 *
 * publicPath 是 umi 注入的全局；本项目已迁 vite，全仓无任何赋值点，
 * 运行时恒为 undefined ⇒ 实际就是 "/vditor"。用项目统一的类型收口写法，
 * 保留兜底语义（将来若再有注入点仍能生效）。
 */
function vditorCdnBase() {
    const p = (typeof window !== 'undefined' && window.publicPath) || '/'
    return `${String(p).replace(/\/$/, '')}/vditor`
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (window.mermaid) {
            resolve()
            return
        }
        const existing = document.querySelector(`script[src="${src}"]`)
        if (existing) {
            existing.addEventListener('load', () => resolve(), {once: true})
            existing.addEventListener('error', () => reject(new Error('mermaid load failed')), {once: true})
            return
        }
        const script = document.createElement('script')
        script.src = src
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('mermaid load failed'))
        document.head.appendChild(script)
    })
}

/** 确保 window.mermaid 就绪（幂等，并发调用共享同一个 initPromise）。 */
export function ensureMermaidReady() {
    if (initialized && window.mermaid) {
        return Promise.resolve()
    }
    if (!initPromise) {
        initPromise = loadScript(`${vditorCdnBase()}/dist/js/mermaid/mermaid.min.js?v=11.16.1`).then(() => {
            if (!window.mermaid) {
                throw new Error('mermaid unavailable')
            }
            window.mermaid.initialize({
                securityLevel: 'loose',
                startOnLoad: false,
                fontFamily: 'sans-serif',
                altFontFamily: 'sans-serif',
                flowchart: {htmlLabels: true, useMaxWidth: true},
                sequence: {
                    useMaxWidth: true,
                    diagramMarginX: 8,
                    diagramMarginY: 8,
                    boxMargin: 8,
                    showSequenceNumbers: true,
                },
            })
            initialized = true
        })
    }
    return initPromise
}

let renderSeq = 0

/** 渲染 mermaid 源码为 SVG 字符串。 */
export async function renderMermaidSvg(source, lang) {
    await ensureMermaidReady()
    const mermaid = window.mermaid
    if (!mermaid) {
        throw new Error('mermaid unavailable')
    }
    const id = `zmd-mermaid-${++renderSeq}`
    const normalized = normalizeMermaidSource(source, lang)
    const result = await mermaid.render(id, normalized)
    return result.svg
}

/** Vditor customRenders：渲染 sequenceDiagram 等围栏。 */
export async function renderVditorMermaidPanel(previewPanel, lang) {
    const codeEl = previewPanel?.firstElementChild ?? null
    if (!codeEl) return
    const source = codeEl.textContent || ''
    try {
        const svg = await renderMermaidSvg(source, lang)
        codeEl.innerHTML = svg
        codeEl.classList.add('language-mermaid')
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Mermaid 渲染失败'
        codeEl.innerHTML = `<pre class="vditor-mermaid-error">${msg}</pre>`
    }
}
