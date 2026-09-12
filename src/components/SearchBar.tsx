import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { searchReplaceKey } from '../extensions/SearchReplace'

interface Props {
  editor: Editor | null
  onClose: () => void
  scrollToMatch: (m: { from: number; to: number }) => void
}

export function SearchBar({ editor, onClose, scrollToMatch }: Props) {
  const [query, setQuery] = useState('')
  const [repl, setRepl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const replRef = useRef<HTMLInputElement>(null)
  const [, force] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!editor) return
    const onChange = () => force((x) => x + 1)
    editor.on('transaction', onChange)
    editor.on('selectionUpdate', onChange)
    return () => {
      editor.off('transaction', onChange)
      editor.off('selectionUpdate', onChange)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const id = window.setTimeout(() => {
      if (!query.trim()) {
        editor.chain().searchClear().run()
      } else {
        editor.chain().searchFind(query).run()
      }
    }, 160)
    return () => window.clearTimeout(id)
  }, [query, editor])

  const st = editor ? searchReplaceKey.getState(editor.state) : undefined
  const total = st?.matches.length ?? 0
  const current = total ? (st?.index ?? 0) + 1 : 0
  const curMatch = st?.matches[st?.index ?? 0]

  const isOnCurrentMatch = () => {
    if (!editor || !curMatch) return false
    const { from, to } = editor.state.selection
    return from === curMatch.from && to === curMatch.to
  }

  const nav = (dir: 1 | -1) => {
    if (!editor) return
    if (dir === 1 && total && !isOnCurrentMatch()) editor.chain().searchFind(query, true).run()
    else if (dir === 1) editor.chain().searchNext().run()
    else editor.chain().searchPrev().run()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const s = searchReplaceKey.getState(editor.state)
        const m = s?.matches[s.index]
        if (m) scrollToMatch(m)
      })
    })
  }

  if (!st) return null

  return (
    <div className="searchbar" role="search">
      <span className="sb-mag">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M15.5 15.5L20 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
      </span>
      <input
        ref={inputRef}
        className="find-input"
        value={query}
        placeholder="Find in document"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) nav(-1)
            else nav(1)
          }
          if (e.key === 'Escape') onClose()
        }}
      />
      <span className={`sb-cnt ${total ? 'has' : ''}`}>{total ? `${current}/${total}` : query.trim() ? '0' : ''}</span>
      <span className="sb-group-btns">
        <button className="nav" title="Previous match (Shift+Enter)" disabled={!total} onClick={() => nav(-1)}>
          <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button className="nav" title="Next match (Enter)" disabled={!total} onClick={() => nav(1)}>
          <svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </span>

      <span className="sb-divider" />

      <input
        ref={replRef}
        className="rep-input"
        value={repl}
        placeholder="Replace with"
        onChange={(e) => setRepl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (e.shiftKey) editor?.chain().searchReplaceAll(repl).run()
          else editor?.chain().searchReplace(repl).run()
        }}
      />
      <button
        className="sb-replace"
        title="Replace the selected match only"
        disabled={!total || !isOnCurrentMatch()}
        onClick={() => editor?.chain().searchReplace(repl).run()}
      >
        Replace
      </button>
      <button className="sb-all" title="Replace every match (⇧+Enter)" disabled={!total} onClick={() => editor?.chain().searchReplaceAll(repl).run()}>
        All
      </button>

      <button className="close" title="Close (Esc)" onClick={onClose}>✕</button>
    </div>
  )
}