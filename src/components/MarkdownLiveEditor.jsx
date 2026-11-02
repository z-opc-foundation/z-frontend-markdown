import {
    BoldOutlined,
    CheckSquareOutlined,
    CodeOutlined,
    ConsoleSqlOutlined,
    ItalicOutlined,
    LinkOutlined,
    OrderedListOutlined,
    PictureOutlined,
    StrikethroughOutlined,
    TableOutlined,
    UnorderedListOutlined,
} from '@ant-design/icons'
import {Button, Empty, message, Tooltip} from 'antd'
import {forwardRef, useCallback, useEffect, useImperativeHandle, useRef} from 'react'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import styles from './index.module.css'
import {renderVditorMermaidPanel} from './mermaidRuntime'
import {MERMAID_FLOW_TEMPLATE, MERMAID_SEQUENCE_TEMPLATE} from './mermaidUtils'
import {NoteMarkdown} from './NoteMarkdown'

/** 编辑器模式：live = vditor 即时渲染，source = 纯文本 + 工具栏。 */
export const LIVE_EDITOR_MODES = ['live', 'source']

const LIVE_TOOLBAR = [
    'headings',
    'bold',
    'italic',
    'strike',
    '|',
    'quote',
    'list',
    'ordered-list',
    'check',
    '|',
    'code',
    'inline-code',
    'link',
    'upload',
    'table',
    'line',
    '|',
    'undo',
    'redo',
]

const MERMAID_TEMPLATE = MERMAID_FLOW_TEMPLATE

function resolveVditorCdn() {
    // publicPath 是 umi 注入的全局；本项目已迁 vite，全仓无任何赋值点，
    // 运行时恒为 undefined ⇒ 实际就是 "/vditor"。
    const p = (typeof window !== 'undefined' && window.publicPath) || '/'
    return `${String(p).replace(/\/$/, '')}/vditor`
}

function wrapSelection(value, start, end, before, after, placeholder) {
    const selected = value.slice(start, end) || placeholder
    const inserted = before + selected + after
    return {
        content: value.slice(0, start) + inserted + value.slice(end),
        selectFrom: start + before.length,
        selectTo: start + before.length + selected.length,
    }
}

function prefixLines(value, start, end, prefix) {
    const before = value.slice(0, start)
    const lineStart = before.lastIndexOf('\n') + 1
    const segment = value.slice(lineStart, end)
    const replaced = segment
        .split('\n')
        .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l))
        .join('\n')
    return {
        content: value.slice(0, lineStart) + replaced + value.slice(end),
        selectFrom: lineStart,
        selectTo: lineStart + replaced.length,
    }
}

function insertText(value, start, end, text) {
    return {
        content: value.slice(0, start) + text + value.slice(end),
        selectFrom: start,
        selectTo: start + text.length,
    }
}

function isImageUrl(text) {
    return /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(text)
}

/**
 * 卸载期销毁 vditor **必须吞异常**。
 *
 * 背景（2026-10-21 个人模式全量交互测试实测）：vditor 实例没建完时
 * （CDN 的 i18n 脚本 404、初始化被 Tab 切换打断等），
 * `vditor.destroy()` 会抛
 * `TypeError: Cannot read properties of undefined (reading 'element')`。
 * 这是**卸载期**抛的 ⇒ React 会把整棵树替换成错误页 ⇒
 * 「个人笔记 → 工作待办」一切换，整个个人工作台直接崩。
 *
 * 卸载清理期的异常没有补救价值（组件本来就要消失），只能吞掉。
 */
function safeDestroyVditor(box) {
    if (!box) return
    try {
        box.destroy()
    } catch {
        /* 实例没建完，编辑器随 DOM 一起消失即可 */
    }
}

/**
 * Markdown 双模编辑器（vditor 即时预览 + 源码模式）。
 *
 * 全仓 Markdown 编辑的**单一真源**（@yuku123/z-markdown-component）。
 */
export const MarkdownLiveEditor = forwardRef(function MarkdownLiveEditor(
    {
        mode,
        value,
        onChange,
        readOnly = false,
        onUploadImage,
        placeholder = '在此输入 Markdown，支持工具栏 / 快捷键 / 粘贴或拖拽图片…',
        onSave,
    },
    ref,
) {
    const wrapRef = useRef(null)
    const liveHostRef = useRef(null)
    const textareaRef = useRef(null)
    const fileInputRef = useRef(null)
    const vditorRef = useRef(null)
    const onChangeRef = useRef(onChange)
    const onSaveRef = useRef(onSave)
    const onUploadImageRef = useRef(onUploadImage)
    const valueRef = useRef(value)

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])
    useEffect(() => {
        onSaveRef.current = onSave
    }, [onSave])
    useEffect(() => {
        onUploadImageRef.current = onUploadImage
    }, [onUploadImage])
    useEffect(() => {
        valueRef.current = value
    }, [value])

    useImperativeHandle(ref, () => ({
        getTextarea: () => textareaRef.current,
        getLiveRoot: () => liveHostRef.current,
    }))

    const emitChange = useCallback((next) => {
        valueRef.current = next
        onChangeRef.current(next)
    }, [])

    useEffect(() => {
        if (readOnly || mode !== 'live') return
        const host = liveHostRef.current
        if (!host) return

        let destroyed = false
        let ready = false
        const box = {current: null}

        /**
         * ⚠ **每次挂载都用一个专属子容器**，不要让 vditor 直接挂到 `host` 上。
         *
         * 原因（2026-11-02 实测：整块编辑器空白、且控制台一条错都没有）：
         * vditor 的初始化是**异步**的（要先把 lute 解析器 fetch 回来才建 DOM），
         * 而 React `StrictMode`（开发模式 + 主壳生产入口都开了）会把 effect
         * 跑成 **挂载 → 清理 → 再挂载**：
         *   ① 第一次挂载：`new Vditor(host)` 开始异步 init（还没建 DOM）；
         *   ② 立刻清理：`destroy()` 排队；
         *   ③ 第二次挂载：`new Vditor(host)` 又挂到**同一个 host**；
         *   ④ ① 的 destroy 此时才真正执行 —— 把 host 里**第二次挂载刚建好的 DOM
         *      一起清空** ⇒ 编辑器永远空白。
         * 因为不抛异常，只有"空白 + 无报错"，极难定位。
         *
         * 专属子容器把这个竞态关进笼子：destroy 只可能清掉**自己那个** div，
         * 新的挂载永远是全新节点，互不干扰。
         */
        const mountEl = document.createElement('div')
        mountEl.style.height = '100%'
        if (mode === 'live') mountEl.className = styles.vditorMount || ''
        host.appendChild(mountEl)

        const insertImageMd = (url) => {
            const md = `\n![](${url})\n`
            box.current?.insertValue(md)
        }

        const uploadFiles = async (files) => {
            const upload = onUploadImageRef.current
            if (!upload) return '未配置图片上传'
            const images = files.filter((f) => f.type.startsWith('image/'))
            if (images.length === 0) return '仅支持上传图片'
            const hide = message.loading('上传图片中...', 0)
            try {
                for (const file of images) {
                    const url = await upload(file)
                    if (url) insertImageMd(url)
                }
                return null
            } catch {
                return '图片上传失败'
            } finally {
                hide()
            }
        }

        box.current = new Vditor(mountEl, {
            cdn: resolveVditorCdn(),
            mode: 'ir',
            value: valueRef.current,
            height: '100%',
            lang: 'zh_CN',
            icon: 'ant',
            placeholder,
            cache: {enable: false},
            toolbar: LIVE_TOOLBAR,
            toolbarConfig: {pin: true},
            hint: {emoji: {}},
            // maxWidth 默认 800 会居中留白；设大后左右只剩最小 padding，铺满可用宽度
            preview: {
                maxWidth: 9999,
                hljs: {enable: true, lineNumber: false, style: 'github'},
                math: {engine: 'KaTeX', inlineDigit: false},
                // 代码块默认渲染高亮预览；点进块内才编辑源码（配合 CSS 互斥显示）
                //
                // ⚠ vditor 4 运行时读的是 options.preview.markdown.codeBlockPreview
                // （见 vditor/src/index.ts:561 与 previewRender.ts:66），
                // 顶层 `markdown: {...}` 那份从未生效 —— 别挪回顶层。
                markdown: {
                    codeBlockPreview: true,
                    mathBlockPreview: true,
                },
            },
            customRenders: [
                {
                    language: 'sequenceDiagram',
                    render: (el) => {
                        void renderVditorMermaidPanel(el, 'sequenceDiagram')
                    },
                },
                {
                    language: 'sequence',
                    render: (el) => {
                        void renderVditorMermaidPanel(el, 'sequence')
                    },
                },
            ],
            after: () => {
                if (destroyed) {
                    safeDestroyVditor(box.current)
                    return
                }
                ready = true
            },
            input: (val) => {
                if (!ready) return
                emitChange(val)
            },
            keydown: (event) => {
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                    event.preventDefault()
                    void onSaveRef.current?.()
                }
            },
            upload: {
                accept: 'image/*',
                multiple: true,
                filename: (name) => name,
                handler: (files) => uploadFiles(files),
            },
        })
        vditorRef.current = box.current

        const onKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault()
                void onSaveRef.current?.()
            }
        }
        host.addEventListener('keydown', onKeyDown)

        return () => {
            destroyed = true
            host.removeEventListener('keydown', onKeyDown)
            safeDestroyVditor(box.current)
            // 只拆自己那份容器：即便 destroy 迟到，也污染不到下一次挂载的新节点
            mountEl.remove()
            vditorRef.current = null
        }
    }, [mode, readOnly, placeholder, emitChange])

    const applyEdit = useCallback(
        (result) => {
            emitChange(result.content)
            const ta = textareaRef.current
            if (ta) {
                requestAnimationFrame(() => {
                    ta.focus()
                    ta.setSelectionRange(result.selectFrom, result.selectTo)
                })
            }
        },
        [emitChange],
    )

    const runWrap = useCallback(
        (before, after, placeholderText) => {
            const ta = textareaRef.current
            if (!ta) return
            applyEdit(wrapSelection(ta.value, ta.selectionStart, ta.selectionEnd, before, after, placeholderText))
        },
        [applyEdit],
    )

    const runPrefix = useCallback(
        (prefix) => {
            const ta = textareaRef.current
            if (!ta) return
            applyEdit(prefixLines(ta.value, ta.selectionStart, ta.selectionEnd, prefix))
        },
        [applyEdit],
    )

    const runInsert = useCallback(
        (text) => {
            const ta = textareaRef.current
            if (!ta) return
            applyEdit(insertText(ta.value, ta.selectionStart, ta.selectionEnd, text))
        },
        [applyEdit],
    )

    const handleImageFile = useCallback(
        async (file) => {
            const upload = onUploadImageRef.current
            if (!upload) return
            const ta = textareaRef.current
            const start = ta?.selectionStart ?? valueRef.current.length
            const end = ta?.selectionEnd ?? valueRef.current.length
            const hide = message.loading('上传图片中...', 0)
            try {
                const url = await upload(file)
                const md = `\n![](${url})\n`
                const next = valueRef.current.slice(0, start) + md + valueRef.current.slice(end)
                emitChange(next)
                requestAnimationFrame(() => {
                    if (ta) {
                        const pos = start + md.length
                        ta.focus()
                        ta.setSelectionRange(pos, pos)
                    }
                })
            } catch {
                message.error('图片上传失败')
            } finally {
                hide()
            }
        },
        [emitChange],
    )

    const handlePaste = useCallback(
        async (e) => {
            const items = e.clipboardData?.items
            if (!items) return
            const imageFiles = []
            for (let i = 0; i < items.length; i++) {
                const it = items[i]
                if (it.kind === 'file' && it.type.startsWith('image/')) {
                    const f = it.getAsFile()
                    if (f) imageFiles.push(f)
                }
            }
            if (imageFiles.length > 0) {
                e.preventDefault()
                for (const f of imageFiles) {
                    await handleImageFile(f)
                }
                return
            }
            const text = e.clipboardData.getData('text/plain')?.trim()
            if (text && isImageUrl(text)) {
                e.preventDefault()
                const ta = e.currentTarget
                const start = ta.selectionStart
                const end = ta.selectionEnd
                const md = `\n![](${text})\n`
                const next = valueRef.current.slice(0, start) + md + valueRef.current.slice(end)
                emitChange(next)
                requestAnimationFrame(() => {
                    const pos = start + md.length
                    ta.focus()
                    ta.setSelectionRange(pos, pos)
                })
            }
        },
        [emitChange, handleImageFile],
    )

    const handleTextareaDrop = useCallback(
        (e) => {
            const files = e.dataTransfer?.files
            if (!files || files.length === 0) return
            const images = Array.from(files).filter((f) => f.type.startsWith('image/'))
            if (images.length === 0) return
            e.preventDefault()
            for (const f of images) {
                void handleImageFile(f)
            }
        },
        [handleImageFile],
    )

    const handleKeyDown = useCallback(
        (e) => {
            const ta = e.currentTarget
            const mod = e.ctrlKey || e.metaKey
            if (e.key === 'Tab') {
                e.preventDefault()
                const s = ta.selectionStart
                const en = ta.selectionEnd
                if (e.shiftKey) {
                    const before = ta.value.slice(0, s)
                    const lineStart = before.lastIndexOf('\n') + 1
                    const seg = ta.value.slice(lineStart, en)
                    const replaced = seg
                        .split('\n')
                        .map((l) => (l.startsWith('  ') ? l.slice(2) : l.replace(/^ /, '')))
                        .join('\n')
                    applyEdit({
                        content: ta.value.slice(0, lineStart) + replaced + ta.value.slice(en),
                        selectFrom: lineStart,
                        selectTo: lineStart + replaced.length,
                    })
                } else {
                    applyEdit(insertText(ta.value, s, en, '  '))
                }
                return
            }
            if (mod && !e.shiftKey && e.key.toLowerCase() === 'b') {
                e.preventDefault()
                runWrap('**', '**', '加粗')
            } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'i') {
                e.preventDefault()
                runWrap('*', '*', '斜体')
            } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                runWrap('[', '](url)', '链接文本')
            } else if (mod && e.key.toLowerCase() === 's') {
                e.preventDefault()
                void onSaveRef.current?.()
            }
        },
        [applyEdit, runWrap],
    )

    const toolbarBtn = (key, icon, title, onClick) => (
        <Tooltip key={key} title={title}>
            <Button size="small" type="text" className={styles.mdBtn} icon={icon} onClick={onClick}/>
        </Tooltip>
    )

    if (readOnly) {
        return (
            <div ref={wrapRef} className={styles.wrap}>
                <div ref={liveHostRef} className={styles.preview}>
                    {value ? (
                        <NoteMarkdown>{value}</NoteMarkdown>
                    ) : (
                        <Empty description="暂无内容" image={Empty.PRESENTED_IMAGE_SIMPLE}/>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div ref={wrapRef} className={styles.wrap}>
            {mode === 'live' ? (
                <div ref={liveHostRef} className={styles.live}/>
            ) : (
                <>
                    <div className={styles.mdToolbar}>
                        {toolbarBtn('h1', 'H1', '一级标题', () => runPrefix('# '))}
                        {toolbarBtn('h2', 'H2', '二级标题', () => runPrefix('## '))}
                        {toolbarBtn('h3', 'H3', '三级标题', () => runPrefix('### '))}
                        <span className={styles.mdSep}/>
                        {toolbarBtn('bold', <BoldOutlined/>, '加粗 Ctrl+B', () => runWrap('**', '**', '加粗'))}
                        {toolbarBtn('italic', <ItalicOutlined/>, '斜体 Ctrl+I', () => runWrap('*', '*', '斜体'))}
                        {toolbarBtn('strike', <StrikethroughOutlined/>, '删除线', () => runWrap('~~', '~~', '删除线'))}
                        <span className={styles.mdSep}/>
                        {toolbarBtn('quote', '❝', '引用', () => runPrefix('> '))}
                        {toolbarBtn('ul', <UnorderedListOutlined/>, '无序列表', () => runPrefix('- '))}
                        {toolbarBtn('ol', <OrderedListOutlined/>, '有序列表', () => runPrefix('1. '))}
                        {toolbarBtn('task', <CheckSquareOutlined/>, '任务列表', () => runPrefix('- [ ] '))}
                        <span className={styles.mdSep}/>
                        {toolbarBtn('code', <CodeOutlined/>, '代码块', () => runWrap('```ts\n', '\n```', 'code'))}
                        {toolbarBtn('inlineCode', <ConsoleSqlOutlined/>, '行内代码', () => runWrap('`', '`', 'code'))}
                        {toolbarBtn('link', <LinkOutlined/>, '链接 Ctrl+K', () => runWrap('[', '](url)', '链接文本'))}
                        {toolbarBtn('image', <PictureOutlined/>, '图片（可粘贴/拖拽）', () => fileInputRef.current?.click())}
                        {toolbarBtn('table', <TableOutlined/>, '表格', () =>
                            runInsert('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| | | |\n'),
                        )}
                        {toolbarBtn('hr', '—', '分割线', () => runInsert('\n---\n'))}
                        {toolbarBtn('mermaid', 'M', 'Mermaid 流程图', () => runInsert(MERMAID_TEMPLATE))}
                        {toolbarBtn('sequence', 'Seq', 'Mermaid 时序图', () => runInsert(MERMAID_SEQUENCE_TEMPLATE))}
                    </div>
                    <textarea
                        ref={textareaRef}
                        className={styles.textarea}
                        value={value}
                        onChange={(e) => emitChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        onDrop={handleTextareaDrop}
                        onDragOver={(e) => e.preventDefault()}
                        placeholder={placeholder}
                        spellCheck={false}
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{display: 'none'}}
                        onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) void handleImageFile(f)
                            e.target.value = ''
                        }}
                    />
                </>
            )}
        </div>
    )
})

export default MarkdownLiveEditor
