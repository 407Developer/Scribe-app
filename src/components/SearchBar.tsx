import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { searchReplaceKey } from '../extensions/SearchReplace'

interface Props {
  editor: Editor | null
  onClose: () => void
}

export function SearchBar({ editor, onClose }: Props) {
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

  const isOnCurrentMatch = () => {
    if (!editor || !st || !st.matches[st.index]) return false
    const { from, to } = editor.state.selection
    return from === st.matches[st.index].from && to === st.matches[st.index].to
  }

  const next = () => {
    if (!editor) return
    if (total && !isOnCurrentMatch()) editor.chain().searchFind(query, true).run()
    else editor.chain().searchNext().run()
  }

  const prev = () => editor?.chain().searchPrev().run()

  return (
    <div className="searchbar" role="search">
      <input
        ref={inputRef}
        className="find-input"
        value={query}
        placeholder="Find in document…"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) prev()
            else next()
          }
          if (e.key === 'Escape') onClose()
        }}
      />
      <span className="cnt">{total ? `${current}/${total}` : query.trim() ? '0' : ''}</span>
      <button className="nav" title="Previous (Shift+Enter)" onClick={prev}>‹</button>
      <button className="nav" title="Next (Enter)" onClick={next}>›</button>
      <input
        ref={replRef}
        className="rep-input"
        value={repl}
        placeholder="Replace with…"
        onChange={(e) => setRepl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (e.shiftKey) editor?.chain().searchReplaceAll(repl).run()
          else editor?.chain().searchReplace(repl).run()
        }}
      />
      <button title="Replace this match" onClick={() => editor?.chain().searchReplace(repl).run()}>Replace</button>
      <button title="Replace all matches" onClick={() => editor?.chain().searchReplaceAll(repl).run()}>All</button>
      <button className="close" title="Close (Esc)" onClick={onClose}>✕</button>
    </div>
  )
}