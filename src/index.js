/**
 * @yuku123/z-markdown-component —— 全仓 Markdown 渲染 / 编辑的**单一真源**。
 *
 * 2026-11-02 随待办能力从 z-team 迁到 z-task 而抽出。
 *
 * <h3>为什么抽成独立包</h3>
 * 此前 Markdown 编辑器（MarkdownLiveEditor）住在 z-team 的
 * `workspace/components/MarkdownLiveEditor/` 下，而它的消费者已经跨到 z-task：
 * 待办详情里的「补充描述」与「关联笔记」都要用它。
 * ⇒ 复制一份到 z-task 会立刻产生**两份实现漂移**（历史上 z-team 自己的
 * `services/api.ts` 与 `services/api/todo.ts` 就是这么漂移出来的）。
 * ⇒ 抽成公共包，两仓共同依赖，**不拷贝**。
 *
 * <h3>导出</h3>
 * - {@link MarkdownLiveEditor} —— 双模编辑器（vditor 即时预览 + 源码模式）
 * - {@link NoteMarkdown} —— 只读渲染器（GFM + 代码高亮 + Mermaid）
 * - {@link MermaidBlock} / mermaid 工具 —— Mermaid 渲染能力
 *
 * @author zifang
 * @since 1.0.0
 */

export {MarkdownLiveEditor, LIVE_EDITOR_MODES} from './components/MarkdownLiveEditor.jsx'
export {NoteMarkdown, noteMarkdownComponents} from './components/NoteMarkdown.jsx'
export {MermaidBlock} from './components/MermaidBlock.jsx'
export {
    MERMAID_FLOW_TEMPLATE,
    MERMAID_SEQUENCE_TEMPLATE,
    MERMAID_SEQUENCE_FENCE_TEMPLATE,
    isMermaidCodeBlock,
    normalizeMermaidSource,
    mermaidSourceFromCode,
} from './components/mermaidUtils.js'
export {ensureMermaidReady, renderMermaidSvg, renderVditorMermaidPanel} from './components/mermaidRuntime.js'
