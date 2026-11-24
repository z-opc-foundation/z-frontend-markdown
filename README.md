# @yuku123/z-frontend-markdown

全仓 Markdown 渲染 / 编辑的**单一真源**。

## 为什么有这个包

2026-11-02 待办（todo）能力从 z-team 迁到 z-task，随之发现 Markdown 编辑器
（`MarkdownLiveEditor`）的消费者已经跨到 z-task —— 待办详情里的「补充描述」与
「关联笔记」都要用它。

此前它住在 `z-team/_frontend/z-team-component/src/zteam/pages/workspace/components/MarkdownLiveEditor/`，
若复制一份到 z-task 就会立刻产生**两份实现漂移**（z-team 自己的
`services/api.ts` 与 `services/api/todo.ts` 就是这么漂移出来的 —— 修好一份、
另一份还坏着，谁 import 到坏的那份就复现）。

⇒ 抽成独立包，**不拷贝**。z-team 与 z-task 共同依赖。

## 导出

| 导出 | 说明 |
|---|---|
| `MarkdownLiveEditor` | 双模编辑器：`live`（vditor 即时预览）/ `source`（纯文本 + 工具栏） |
| `NoteMarkdown` | 只读渲染器：GFM + 代码高亮 + Mermaid |
| `MermaidBlock` | Mermaid 代码块渲染器 |
| `MERMAID_FLOW_TEMPLATE` / `MERMAID_SEQUENCE_TEMPLATE` | Mermaid 模板片段 |
| `isMermaidCodeBlock` / `normalizeMermaidSource` / `mermaidSourceFromCode` | Mermaid 围栏工具 |
| `ensureMermaidReady` / `renderMermaidSvg` / `renderVditorMermaidPanel` | Mermaid 运行时 |

## 用法

### 编辑器

```jsx
import {MarkdownLiveEditor} from '@yuku123/z-frontend-markdown'

<MarkdownLiveEditor
    mode="live"
    value={content}
    onChange={setContent}
    onUploadImage={uploadImage}
    onSave={saveNow}
    placeholder="支持 Markdown"
/>
```

### 只读渲染

```jsx
import {NoteMarkdown} from '@yuku123/z-frontend-markdown'

<NoteMarkdown>{markdownText}</NoteMarkdown>
```

## Props

### `MarkdownLiveEditor`

| prop | 类型 | 说明 |
|---|---|---|
| `mode` | `'live' \| 'source'` | 编辑模式 |
| `value` | `string` | 当前内容 |
| `onChange` | `(v: string) => void` | 内容变更 |
| `readOnly` | `boolean` | 只读（退化为 Markdown 渲染） |
| `onUploadImage` | `(file: File) => Promise<string>` | 图片上传（返回可访问地址） |
| `placeholder` | `string` | 占位文案 |
| `onSave` | `() => void` | Ctrl/Cmd+S 回调 |

ref 暴露：`getTextarea()` / `getLiveRoot()`。

## 依赖

peerDependencies（由宿主提供，避免双实例）：

`antd` / `@ant-design/icons` / `react` / `react-dom` / `react-markdown` /
`remark-gfm` / `rehype-highlight` / `vditor`

## Mermaid 从哪来

Mermaid **不走 npm 依赖**，而是从宿主的 `/vditor/dist/js/mermaid/mermaid.min.js` 动态加载
（与 vditor 自带的资源目录一致），避免引入一个大依赖与 unpkg 外网请求。
宿主需保证 `/vditor` 静态目录可访问。
