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
import { downloadDocx, shareDoc } from '../lib/export'

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
          'Start writing…\n\nTip: type a Bible reference like “John 3:16”, then press Shift+Enter (or tap the highlight on a phone). The reference is boldened and the King James text is inserted right after it — even if you keep typing after it.',
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

  const saveDocx = async () => {
    if (!editor) return
    setSavedAt('Building DOCX…')
    await downloadDocx(editor.getHTML(), title)
    setSavedAt('Downloaded as DOCX')
  }

  const printPdf = () => {
    if (!editor) return
    setSavedAt('Print or save as PDF')
    window.print()
  }

  const share = async () => {
    if (!editor) return
    const ok = await shareDoc(editor.getHTML(), title, editor.getText())
    if (ok) {
      setSavedAt('Shared')
    } else {
      try {
        await navigator.clipboard.writeText(editor.getText())
        setSavedAt('Copied to clipboard')
      } catch {
        setSavedAt('Sharing not supported here')
      }
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
          <svg viewBox="0 0 24 24" className="brand-icon" aria-label="Epistola">
            <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="url(#brand-gradient)" />
            <path d="M6.5 5.2h3.4v1.9H6.5zM9.9 5.2h7.6v1.9H9.9zM6.5 9.2h3.4v1.9H6.5zM9.9 9.2h7.6v1.9H9.9zM6.5 13.2h3.4v1.9H6.5zM9.9 13.2h7.6v1.9H9.9z" fill="#f6ecd6" />
            <circle cx="18" cy="7" r="1.35" fill="#c9a227" />
            <defs>
              <linearGradient id="brand-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4338ca" />
                <stop offset="1" stopColor="#26205e" />
              </linearGradient>
            </defs>
          </svg>
          <span className="brand-name">Epistola</span>
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
          <button onClick={saveDocx}>DOCX</button>
          <button onClick={printPdf}>PDF</button>
          <button onClick={copyText}>Copy</button>
          <button onClick={share}>Share</button>
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
            <h2>How Epistola works</h2>
            <ul>
              <li>
                <strong>Type a reference</strong> — e.g. <code>John 3:16</code>, <code>Ps 23:1</code>,{' '}
                <code>Rom 8:28</code> or <code>1 Cor 13:4-7</code>. It gets highlighted as you type.
              </li>
              <li>
                <strong>Insert the verse</strong> — press <kbd>Shift</kbd>+<kbd>Enter</kbd> on a laptop or{' '}
                <strong>tap the highlight</strong> on a phone. The reference turns into a bolded lead-in and the King
                James text follows it inline — verse ranges mark later verses with “Vs 3”, “Vs 4”, and so on. You can
                keep typing after it and still insert later — Epistola quotes the last reference you wrote.
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