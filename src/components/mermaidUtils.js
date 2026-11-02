/** Mermaid 围栏语言与源码规范化（含 sequenceDiagram） */

/** 支持的 mermaid 围栏语言别名（小写）。 */
const SEQUENCE_LANGS = new Set(['sequencediagram', 'sequence'])

export const MERMAID_FLOW_TEMPLATE =
    '\n```mermaid\nflowchart TD\n  A[开始] --> B[结束]\n```\n'

export const MERMAID_SEQUENCE_TEMPLATE =
    '\n```mermaid\nsequenceDiagram\n  participant A as 用户\n  participant B as 系统\n  A->>B: 请求\n  B-->>A: 响应\n```\n'

/** 也支持 ```sequenceDiagram 围栏写法 */
export const MERMAID_SEQUENCE_FENCE_TEMPLATE =
    '\n```sequenceDiagram\n  participant A as 用户\n  participant B as 系统\n  A->>B: 请求\n  B-->>A: 响应\n```\n'

export function isMermaidCodeBlock(className) {
    if (!className) return false
    return /\blanguage-(mermaid|sequencediagram|sequence)\b/i.test(className)
}

export function normalizeMermaidSource(source, lang) {
    const text = String(source ?? '').replace(/\r\n/g, '\n').trim()
    if (!text) return text
    const l = String(lang || '').replace(/^language-/i, '').toLowerCase()
    if (SEQUENCE_LANGS.has(l)) {
        if (!/^sequenceDiagram\b/i.test(text)) {
            return `sequenceDiagram\n${text}`
        }
    }
    return text
}

export function mermaidSourceFromCode(className, text) {
    const langMatch = String(className ?? '').match(/\blanguage-([\w-]+)/i)
    return normalizeMermaidSource(text, langMatch?.[1])
}
