import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { BibleReference, alreadyQuoted, currentMatch, insertCurrentMatch } from '../extensions/BibleReference'
import { Toolbar } from './Toolbar'

const STORAGE_KEY = 'scribe.doc.v1'

interface SavedDoc {
  title: string
  html: string
  updated: number
}

function loadDoc(): SavedDoc | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedDoc
    if (typeof parsed.html !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

function storeDoc(doc: SavedDoc) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
  } catch {
    /* storage full or unavailable — ignore */
  }
}

function exportHtml(editor: {
  getHTML: () => string
  getText: () => string
}, title: string) {
  const body = editor.getHTML()
  const blob = new Blob(
    [
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title || 'Scribe'}</title>` +
        `<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;font-size:18px;color:#1f2937}` +
        `blockquote{border-left:4px solid #c7d2fe;margin:1em 0;padding:0.1em 1em;background:#f5f7ff;color:#333}` +
        `blockquote p:last-child{color:#6b7280;font-size:0.85em}</style></head><body>${body}<hr><p style="color:#9ca3af;font-size:0.8em">Exported from Scribe</p></body></html>`,
    ],
    { type: 'text/html' },
  )
  download(blob, `${title || 'document'}.html`)
}

function exportTxt(editor: { getText: () => string }, title: string) {
  const blob = new Blob([editor.getText()], { type: 'text/plain;charset=utf-8' })
  download(blob, `${title || 'document'}.txt`)
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function BibleEditor() {
  const [{ title, html }, setDoc] = useState<SavedDoc>(() => loadDoc() ?? { title: '', html: '', updated: 0 })
  const savedAtRef = useRef<number>(0)
  const saveTimer = useRef<number | undefined>(undefined)
  const [savedAt, setSavedAt] = useState<string>('')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const [words, setWords] = useState(0)
  const [installEvt, setInstallEvt] = useState<Event | null>(null)
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    if (isStandalone) return
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e)
      setCanInstall(true)
    }
    const onInstalled = () => {
      setInstallEvt(null)
      setCanInstall(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const installApp = async () => {
    if (!installEvt) return
    const promptEvt = installEvt as Event & { prompt: () => Promise<void> }
    await promptEvt.prompt()
    setInstallEvt(null)
    setCanInstall(false)
  }

  const flush = useCallback(
    (editor: { getHTML: () => string; getText: () => string } | null, titleValue: string) => {
      if (!editor) return
      const now = Date.now()
      savedAtRef.current = now
      storeDoc({ title: titleValue, html: editor.getHTML(), updated: now })
      setSavedAt('Saved just now')
    },
    [],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder:
          'Start writing…\n\nTip: type a Bible reference like “John 3:16”, then press Shift+Enter (or tap the highlight on a phone) to insert the quoted verse — even if you keep typing after it.',
      }),
      BibleReference,
    ],
    content: html || '<p></p>',
    editorProps: {
      attributes: {
        class: 'doc-content',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: ed }) => {
      setWords(ed.getText().trim().split(/\s+/).filter(Boolean).length)
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        setDoc((d) => {
          const next = { ...d, html: ed.getHTML() }
          flush(ed, d.title)
          return next
        })
      }, 600)
    },
    onCreate: () => {
      const ed = editor
      if (!ed) return
      setWords(ed.getText().trim().split(/\s+/).filter(Boolean).length)
    },
  })

  const detected = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) return null
      const m = currentMatch(ed.state)
      if (!m || alreadyQuoted(ed.state, m)) return null
      return m
    },
  })

  const onTitle = (value: string) => {
    setDoc((d) => ({ ...d, title: value }))
    setSavedAt('Unsaved changes')
  }

  const newDocument = () => {
    if (!editor) return
    flush(editor, title)
    setDoc({ title: '', html: '', updated: Date.now() })
    savedAtRef.current = Date.now()
    editor.commands.clearContent(true)
    editor.commands.focus()
    setConfirmNew(false)
  }

  useEffect(() => () => window.clearTimeout(saveTimer.current), [])

  const copyText = async () => {
    if (!editor) return
    try {
      await navigator.clipboard.writeText(editor.getText())
      setSavedAt('Copied to clipboard')
    } catch {
      setSavedAt('Copy failed')
    }
  }

  const hintChip = useMemo(() => {
    if (!detected) return null
    return (
      <div className="hint-chip">
        <span className="hint-ref">{detected.text}</span>
        <span className="hint-hint">Shift+Enter&nbsp;·&nbsp;or tap the highlight</span>
        <button onClick={() => editor && insertCurrentMatch(editor.view)}>Insert verse</button>
      </div>
    )
  }, [detected, editor])

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">
          <svg viewBox="0 0 24 24" className="brand-icon">
            <path d="M4 4h5.5A2.5 2.5 0 0 1 12 6.5V20c-.5-1-1.5-2-3-2H4zM20 4h-5.5A2.5 2.5 0 0 0 12 6.5V20c.5-1 1.5-2 3-2h5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <span className="brand-name">Scribe</span>
        </div>
        <input
          className="title-input"
          value={title}
          placeholder="Untitled document"
          onChange={(e) => onTitle(e.target.value)}
          aria-label="Document title"
        />
        <div className="topbar-actions">
          <button onClick={() => setConfirmNew(true)}>New</button>
          <button onClick={() => editor && exportTxt(editor, title)}>TXT</button>
          <button onClick={() => editor && exportHtml(editor, title)}>HTML</button>
          <button onClick={copyText}>Copy</button>
          {canInstall && <button className="install-btn" onClick={installApp}>Install</button>}
          <div className="saved-indicator" title="Saved to this browser">{savedAt || 'Autosaved to this browser'}</div>
        </div>
      </header>

      <Toolbar editor={editor} onOpenAbout={() => setAboutOpen(true)} />

      <div className="paper-wrap">
        <div className="paper">
          <EditorContent editor={editor} />
        </div>
      </div>

      <footer className="statusbar">
        <span>{words} {words === 1 ? 'word' : 'words'}</span>
        <span className="status-spacer" />
        <span className="status-version">KJV · offline</span>
      </footer>

      {hintChip && <div className="hint-anchor">{hintChip}</div>}

      {aboutOpen && (
        <div className="modal-backdrop" onClick={() => setAboutOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>How Scribe works</h2>
            <ul>
              <li>
                <strong>Type a reference</strong> — e.g. <code>John 3:16</code>, <code>Ps 23:1</code>,{' '}
                <code>Rom 8:28</code> or <code>1 Cor 13:4-7</code>. It gets highlighted as you type.
              </li>
              <li>
                <strong>Insert the verse</strong> — press <kbd>Shift</kbd>+<kbd>Enter</kbd> on a laptop or{' '}
                <strong>tap the highlight</strong> on a phone, and the King James text is quoted right after the
                reference. You can keep typing after it and still insert later — Scribe quotes the last reference you
                wrote.
              </li>
              <li>
                <strong>Format like a doc</strong> — headings, bold, italic, lists, quotes, links, colors and alignment.
              </li>
            </ul>
            <p className="modal-note">Your document autosaves in this browser. More Bible versions are coming.</p>
            <button className="modal-close" onClick={() => setAboutOpen(false)}>Got it</button>
          </div>
        </div>
      )}

      {confirmNew && (
        <div className="modal-backdrop" onClick={() => setConfirmNew(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Start a new document?</h2>
            <p>Your current document stays saved in this browser, but the editor will be cleared.</p>
            <div className="modal-actions">
              <button className="modal-close" onClick={() => setConfirmNew(false)}>Cancel</button>
              <button className="modal-danger" onClick={newDocument}>New document</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}