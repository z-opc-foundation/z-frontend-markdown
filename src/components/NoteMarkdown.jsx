import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import {MermaidBlock} from './MermaidBlock'
import {isMermaidCodeBlock} from './mermaidUtils'

/** 从 react-markdown 的 children 里递归抽出纯文本（代码块内容）。 */
function extractCodeText(children) {
    if (typeof children === 'string') return children.replace(/\n$/, '')
    if (Array.isArray(children)) {
        return children.map((c) => extractCodeText(c)).join('')
    }
    if (children && typeof children === 'object' && 'props' in children) {
        return extractCodeText(children.props?.children ?? '')
    }
    return String(children ?? '').replace(/\n$/, '')
}

export const noteMarkdownComponents = {
    pre({children}) {
        return <pre>{children}</pre>
    },
    code({className, children, ...props}) {
        const text = extractCodeText(children)
        // react-markdown v9+ 移除了 code 组件的 `inline` prop，
        // 改为用 className 是否含 language-* 区分块级/行内。
        if (isMermaidCodeBlock(className)) {
            const langMatch = className?.match(/\blanguage-([\w-]+)/i)
            return <MermaidBlock code={text} lang={langMatch?.[1]}/>
        }
        return (
            <code className={className} {...props}>
                {children}
            </code>
        )
    },
}

/**
 * rehype-highlight 的过滤器：mermaid 围栏**不能**被代码高亮器处理
 * （高亮器会把源码拆成 token，Mermaid 解析器就认不出了）。
 */
const rehypePlugins = [
    [
        rehypeHighlight,
        {
            filter: (node) => {
                const cls = node.properties?.className
                if (Array.isArray(cls)) {
                    return !cls.some((c) => c === 'language-mermaid' || /^language-sequence/i.test(c))
                }
                if (typeof cls === 'string') {
                    return !/\blanguage-(mermaid|sequencediagram|sequence)\b/i.test(cls)
                }
                return true
            },
        },
    ],
]

/**
 * Markdown 只读渲染器：GFM + 代码高亮 + Mermaid。
 *
 * 全仓 Markdown 渲染的**单一真源**（@yuku123/z-frontend-markdown）。
 */
export function NoteMarkdown({children, className}) {
    return (
        <div className={className}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins} components={noteMarkdownComponents}>
                {children}
            </ReactMarkdown>
        </div>
    )
}
