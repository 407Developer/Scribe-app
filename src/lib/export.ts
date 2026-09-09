import { Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Document, type IRunOptions } from 'docx'

const SIZE = 22
const INLINE_TAGS = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'U', 'CODE', 'MARK', 'SPAN', 'BR'])

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

function sanitizeFilename(name: string) {
  const clean = name.replace(/[^\w\d -]+/g, '').replace(/\s+/g, ' ').trim()
  return clean || 'document'
}

export function exportTxt(text: string, title: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  download(blob, `${sanitizeFilename(title)}.txt`)
}

export function exportHtml(body: string, title: string) {
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title || 'Epistola'}</title>` +
    `<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;font-size:18px;color:#1f2937}` +
    `blockquote{border-left:4px solid #c9a85d;margin:1em 0;padding:0.1em 1em;background:#f6ecd6;color:#333}` +
    `blockquote p:last-child{color:#6b7280;font-size:0.85em}</style></head><body>${body}<hr><p style="color:#9ca3af;font-size:0.8em">Exported from Epistola</p></body></html>`
  download(new Blob([doc], { type: 'text/html' }), `${sanitizeFilename(title)}.html`)
}

function hexToHex(fill: string[]): string {
  return fill.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase()
}

function styleFrom(node: Element): IRunOptions {
  const o: Record<string, boolean | string | object> = {}
  const tag = node.tagName
  if (tag === 'B' || tag === 'STRONG') o.bold = true
  if (tag === 'I' || tag === 'EM') o.italics = true
  if (tag === 'U') o.underline = {}
  if (tag === 'CODE') o.font = 'Consolas'
  if (tag === 'A') o.underline = {}
  const style = node.getAttribute('style') ?? ''
  const color = /color:\s*([^;]+)/.exec(style)?.[1]
  const bg = /background(?:-color)?:\s*([^;]+)/.exec(style)?.[1]
  if (color) o.color = color.trim()
  if (bg) {
    const rgb = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(bg)
    const hex = /^#([0-9a-f]{6})$/i.exec(bg.trim())
    if (rgb) o.highlight = hexToHex(rgb.slice(1))
    else if (hex) o.highlight = hex[1].toUpperCase()
  }
  return o as unknown as IRunOptions
}

function collectRuns(node: Node, parent: IRunOptions, out: TextRun[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').replace(/\u00a0/g, ' ')
    if (!text) return
    out.push(new TextRun({ text, size: SIZE, ...parent }))
    return
  }
  const el = node as Element
  if (INLINE_TAGS.has(el.tagName)) {
    if (el.tagName === 'BR') {
      out.push(new TextRun({ text: ' ', size: SIZE }))
      return
    }
    const merged = { ...parent, ...styleFrom(el) }
    if (el.tagName === 'A') {
      out.push(new TextRun({ text: el.textContent ?? '', size: SIZE, ...merged, underline: {} }))
      return
    }
    for (const child of Array.from(el.childNodes)) collectRuns(child, merged, out)
    return
  }
  for (const child of Array.from(node.childNodes)) collectRuns(child, parent, out)
}

function paraRuns(el: Element, base: IRunOptions = {}): TextRun[] {
  const runs: TextRun[] = []
  for (const child of Array.from(el.childNodes)) collectRuns(child, base, runs)
  return runs
}

type AlignValue = (typeof AlignmentType)[keyof typeof AlignmentType]

function alignmentOf(el: Element): AlignValue | undefined {
  const m = /\btext-align:\s*(\w+)/.exec(el.getAttribute('style') ?? '')?.[1]
  if (!m) return undefined
  return { center: AlignmentType.CENTER, right: AlignmentType.END, justify: AlignmentType.BOTH }[m]
}

export async function downloadDocx(html: string, title: string) {
  const name = sanitizeFilename(title)
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const paragraphs: Paragraph[] = []

  const walk = (elements: Element[]) => {
    for (const el of elements) {
      switch (el.tagName) {
        case 'P': {
          const runs = paraRuns(el)
          if (!runs.length) break
          paragraphs.push(new Paragraph({ children: runs, alignment: alignmentOf(el), spacing: { after: 140 } }))
          break
        }
        case 'H1':
        case 'H2':
        case 'H3': {
          const runs = paraRuns(el)
          const heading = el.tagName === 'H1' ? HeadingLevel.HEADING_1 : el.tagName === 'H2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
          paragraphs.push(new Paragraph({ children: runs, heading, spacing: { before: 200, after: 120 } }))
          break
        }
        case 'BLOCKQUOTE': {
          const parents = Array.from(el.children).filter((c) => c.tagName === 'P')
          parents.forEach((p, i) => {
            const base: IRunOptions = i === parents.length - 1
              ? { italics: true, color: '857B6C', size: 20 }
              : {}
            const runs = paraRuns(p as Element, base)
            paragraphs.push(
              new Paragraph({
                children: runs,
                indent: { left: 720 },
                border: { left: { style: 'single', size: 12, color: 'C9A85D', space: 4 } },
                spacing: { after: 120 },
              }),
            )
          })
          break
        }
        case 'UL': {
          for (const li of Array.from(el.children).filter((c) => c.tagName === 'LI')) {
            paragraphs.push(new Paragraph({ children: paraRuns(li), bullet: { level: 0 }, spacing: { after: 80 } }))
          }
          break
        }
        case 'OL': {
          for (const li of Array.from(el.children).filter((c) => c.tagName === 'LI')) {
            paragraphs.push(new Paragraph({ children: paraRuns(li), numbering: { reference: 'epistola-list', level: 0 }, spacing: { after: 80 } }))
          }
          break
        }
        case 'DIV':
          walk(Array.from(el.children))
          break
        default:
          break
      }
    }
  }
  walk(Array.from(parsed.body.children))
  if (!paragraphs.length) paragraphs.push(new Paragraph({ children: [new TextRun({ text: '' })] }))

  const doc = new Document({
    creator: 'Epistola',
    title: name,
    numbering: {
      config: [{ reference: 'epistola-list', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }] }],
    },
    styles: { default: { document: { run: { font: 'Georgia', size: SIZE } } } },
    sections: [
      {
        children: paragraphs,
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1260, right: 1260 } } },
      },
    ],
  })
  const blob = await Packer.toBlob(doc)
  download(blob, `${name}.docx`)
}

export async function shareDoc(html: string, title: string, text: string) {
  if (!navigator.share) return false
  const name = sanitizeFilename(title)
  try {
    await navigator.share({
      title: title || 'Epistola document',
      text,
      files: [new File([html], `${name}.html`, { type: 'text/html' })],
    } as ShareData)
    return true
  } catch {
    return false
  }
}