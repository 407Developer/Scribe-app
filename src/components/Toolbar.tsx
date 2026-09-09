import type { Editor } from '@tiptap/react'
import { useState } from 'react'

const colors = [
  '#000000',
  '#b91c1c',
  '#b45309',
  '#15803d',
  '#1d4ed8',
  '#6d28d9',
  '#0e7490',
  '#be185d',
]

interface Props {
  editor: Editor
  onOpenAbout: () => void
}

export function Toolbar({ editor, onOpenAbout }: Props) {
  const [linkUrl, setLinkUrl] = useState<string>('')
  const [showLink, setShowLink] = useState(false)

  const setLink = () => {
    const url = linkUrl || 'https://'
    if (url === 'https://') return setShowLink(false)
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    setShowLink(false)
    setLinkUrl('')
  }

  const Headings = () => {
    const level = editor.isActive('heading')
      ? (editor.getAttributes('heading').level as number | undefined)
      : undefined
    const value = level ? `h${level}` : 'p'
    const options: [string, string][] = [
      ['p', 'Normal text'],
      ['h1', 'Heading 1'],
      ['h2', 'Heading 2'],
      ['h3', 'Heading 3'],
    ]
    return (
      <select
        className="tb-select"
        value={value}
        title="Heading style"
        onChange={(e) => {
          const v = e.target.value
          if (v === 'p') editor.chain().focus().setParagraph().run()
          else editor.chain().focus().toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run()
        }}
      >
        {options.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <div className="tb-group">
        <button className="tb-btn" title="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 9h10a6 6 0 1 1 0 12h-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <button className="tb-btn" title="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <svg viewBox="0 0 24 24"><path d="M15 14l5-5-5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 9H10a6 6 0 1 0 0 12h2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div className="tb-group">
        <Headings />
      </div>

      <div className="tb-group">
        <button className={`tb-btn ${editor.isActive('bold') ? 'active' : ''}`} title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>
          <svg viewBox="0 0 24 24"><path d="M7 5h6.5a3.5 3.5 0 1 1 0 7H7zM7 12h7.8a3.6 3.6 0 1 1 0 7.2H7z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" /></svg>
        </button>
        <button className={`tb-btn ${editor.isActive('italic') ? 'active' : ''}`} title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <svg viewBox="0 0 24 24"><path d="M10 4h9M8 20h9M14 4L10 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
        <button className={`tb-btn ${editor.isActive('underline') ? 'active' : ''}`} title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <svg viewBox="0 0 24 24"><path d="M7 4v6a5 5 0 0 0 10 0V4M5 20h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
        <button className={`tb-btn ${editor.isActive('strike') ? 'active' : ''}`} title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}>
          <svg viewBox="0 0 24 24"><path d="M6 5h12M4 12h16M8 12a4.5 4.5 0 0 1 0-4M16 12a4.5 4.5 0 0 0 0-4M9 12a4 4 0 0 0 0 4M12 12v5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
        <button className={`tb-btn ${editor.isActive('highlight') ? 'active' : ''}`} title="Highlight" onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}>
          <svg viewBox="0 0 24 24"><path d="M4 20l3-3M9 4l11 11-6 6L3 10z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" /></svg>
        </button>
        <button className={`tb-btn ${editor.isActive('code') ? 'active' : ''}`} title="Inline code" onClick={() => editor.chain().focus().toggleCode().run()}>
          <svg viewBox="0 0 24 24"><path d="M8 6l-5 6 5 6M16 6l5 6-5 6M13 4l-3 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <div className="tb-group">
        <button className={`tb-btn ${editor.isActive('bulletList') ? 'active' : ''}`} title="Bulleted list" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><circle cx="4" cy="6" r="1.3" fill="currentColor" /><circle cx="4" cy="12" r="1.3" fill="currentColor" /><circle cx="4" cy="18" r="1.3" fill="currentColor" /></svg>
        </button>
        <button className={`tb-btn ${editor.isActive('orderedList') ? 'active' : ''}`} title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><path d="M4 5.5L5.5 4.5v3M4 12h3M4 19c0-1 1-1.5 2-2 1-.5 .8-1.5-.8-1.8M6.2 21c1.3 0 1.8-.5 1.8-1.2 0-.9-.8-1.3-2-1.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <button className={`tb-btn ${editor.isActive('blockquote') ? 'active' : ''}`} title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <svg viewBox="0 0 24 24"><path d="M6 17c-2 0-3-2-3-4.5S4.8 9 6.5 9c.0 0 0 0 0 0C7 10 7 11 6 12c1 1 2 1 2 2 0 1.7-1 3-2 3zM14 17c-2 0-3-2-3-4.5S12.8 9 14.5 9C15 10 15 11 14 12c1 1 2 1 2 2 0 1.7-1 3-2 3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div className="tb-group">
        {showLink ? (
          <span className="tb-linkbar">
            <input
              autoFocus
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setLink()
                if (e.key === 'Escape') setShowLink(false)
              }}
            />
            <button onClick={setLink}>OK</button>
          </span>
        ) : (
          <button
            className={`tb-btn ${editor.isActive('link') ? 'active' : ''}`}
            title="Link"
            onClick={() => {
              if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run()
              } else {
                setShowLink(true)
              }
            }}
          >
            <svg viewBox="0 0 24 24"><path d="M9 15l6-6M11 7l1.5-1.5a4 4 0 0 1 5.7 5.7L16.5 13M13 17l-1.5 1.5a4 4 0 0 1-5.7-5.7L7.5 11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </div>

      <div className="tb-group">
        <button className={`tb-btn ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`} title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 10h10M4 14h16M4 18h10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
        <button className={`tb-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`} title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <svg viewBox="0 0 24 24"><path d="M3 6h18M7 10h10M3 14h18M7 18h10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
        <button className={`tb-btn ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`} title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <svg viewBox="0 0 24 24"><path d="M4 6h16M10 10h10M4 14h16M10 18h10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
        <button className={`tb-btn ${editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}`} title="Justify" onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
          <svg viewBox="0 0 24 24"><path d="M3 6h18M3 10h18M3 14h18M3 18h18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div className="tb-group tb-colors" title="Text color">
        {colors.map((c) => (
          <button
            key={c}
            style={{ background: c }}
            className="tb-color"
            aria-label={`Text color ${c}`}
            onClick={() => editor.chain().focus().setColor(c).run()}
          />
        ))}
      </div>

      <div className="tb-spacer" />

      <div className="tb-group">
        <button className="tb-btn" title="Clear formatting" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
          <svg viewBox="0 0 24 24"><path d="M4 6h16M6 6l6 14h2M14 6l-3 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button className="tb-btn" title="About this app" onClick={onOpenAbout}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 11v5M12 8h.01" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
      </div>
    </div>
  )
}