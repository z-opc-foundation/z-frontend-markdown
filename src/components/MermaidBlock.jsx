import {useEffect, useRef, useState} from 'react'
import styles from './index.module.css'
import {renderMermaidSvg} from './mermaidRuntime'

/**
 * Mermaid 代码块渲染器。
 *
 * 渲染失败时不吞错误 —— 显示错误面板 + 原始源码，让作者能直接看到问题。
 */
export function MermaidBlock({code, lang}) {
    const hostRef = useRef(null)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false
        const trimmed = String(code ?? '').trim()
        if (!trimmed) {
            setError(null)
            if (hostRef.current) hostRef.current.innerHTML = ''
            return
        }
        setError(null)
        void renderMermaidSvg(code, lang)
            .then((svg) => {
                if (cancelled || !hostRef.current) return
                hostRef.current.innerHTML = svg
            })
            .catch((e) => {
                if (cancelled) return
                setError(e instanceof Error ? e.message : 'Mermaid 渲染失败')
                if (hostRef.current) hostRef.current.innerHTML = ''
            })
        return () => {
            cancelled = true
        }
    }, [code, lang])

    if (error) {
        return (
            <div className={styles.mermaidError}>
                <div className={styles.mermaidErrorTitle}>Mermaid 渲染失败</div>
                <pre className={styles.mermaidErrorMsg}>{error}</pre>
                <pre className={styles.mermaidSource}>{code}</pre>
            </div>
        )
    }

    return <div ref={hostRef} className={styles.mermaid}/>
}
