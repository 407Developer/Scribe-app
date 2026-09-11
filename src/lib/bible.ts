import type { BookInfo, KJVBook, RefMatch } from './types'
import type { Node } from '@tiptap/pm/model'

let books: BookInfo[] = []
let kjv: { meta: { id: string; name: string; short: string }; books: KJVBook[] } | null = null
let kmap = new Map<string, string>()

const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3' }

function isAlnum(c: string): boolean {
  const code = c.codePointAt(0) ?? 0
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

function isWs(c: string): boolean {
  return c === ' ' || c === '\t'
}

/** "I john" / "II corinthians" / "1 john" -> "1john", "song of solomon" -> "songofsolomon" */
export function normalizeTerm(s: string): string {
  let t = s.trim().toLowerCase()
  const m = t.match(/^(i{1,3})(?=\s)/)
  if (m) {
    t = ROMAN[m[1]] + t.slice(m[0].length)
  }
  return t.replace(/[^a-z0-9]/g, '')
}

function addKey(key: string, id: string) {
  kmap.set(normalizeTerm(key), id)
}

export async function loadBibleData(): Promise<void> {
  const [b, k] = await Promise.all([
    fetch('/data/books.json').then((r) => r.json()),
    fetch('/data/kjv.json').then((r) => r.json()),
  ])
  books = b as BookInfo[]
  kjv = k
  for (const bk of books) {
    addKey(bk.id, bk.id)
    addKey(bk.name, bk.id)
    for (const p of bk.patterns) addKey(p, bk.id)
  }
}

export interface RawRef {
  startChar: number
  endChar: number
  text: string
  bookId: string
  bookName: string
  chapter: number
  verses: number[]
  verseTexts: string[]
  label: string
  quote: string
  citation: string
}

interface Token {
  text: string
  s: number
  e: number
}

function tryParseRef(text: string, start: number): RawRef | null {
  const data = kjv
  if (!data) return null
  const n = text.length
  let i = start

  const tokens: Token[] = []
  for (let t = 0; t < 4; t++) {
    let s = i
    while (i < n && isAlnum(text[i])) i++
    if (i === s) {
      i = s
      break
    }
    tokens.push({ text: text.slice(s, i), s, e: i })
    let j = i
    while (j < n && isWs(text[j])) j++
    if (j < n && text[j] === '.') {
      j++
      while (j < n && isWs(text[j])) j++
    }
    if (j >= n || !isAlnum(text[j])) {
      i = j
      break
    }
    i = j
  }

  // Find the chapter token: all-digits followed by ":"
  let k = -1
  for (let idx = 0; idx < tokens.length; idx++) {
    if (!/^\d{1,3}$/.test(tokens[idx].text)) continue
    let j = tokens[idx].e
    while (j < n && isWs(text[j])) j++
    if (text[j] === ':') {
      k = idx
      break
    }
  }

  // Fallback: a single word like "john3" followed directly by ":"
  if (k === -1 && tokens.length === 1 && !/^\d+$/.test(tokens[0].text) && text[tokens[0].e] === ':') {
    const m = tokens[0].text.match(/^(.*?)(\d{1,3})$/)
    if (m && m[1]) {
      tokens[0] = { text: m[1], s: tokens[0].s, e: tokens[0].s + m[1].length }
      tokens[1] = { text: m[2], s: tokens[0].e, e: tokens[0].e + m[2].length }
      k = 1
    }
  }

  if (k === -1 || k === 0) return null
  const name = tokens.slice(0, k).map((t) => t.text).join(' ')
  const bookId = kmap.get(normalizeTerm(name))
  if (!bookId) return null
  const book = data.books.find((b) => b.id === bookId)
  if (!book) return null

  const chapter = Number(tokens[k].text)
  if (chapter < 1 || chapter > book.chapters.length) return null
  const chapterText = book.chapters[chapter - 1]

  let v = tokens[k].e
  while (v < n && isWs(text[v])) v++
  if (text[v] !== ':') return null
  v++
  while (v < n && isWs(text[v])) v++
  const verseStart = v
  while (v < n && text[v] >= '0' && text[v] <= '9') v++
  if (v === verseStart || v - verseStart > 3) return null

  const verseRanges: [number, number][] = [[Number(text.slice(verseStart, v)), Number(text.slice(verseStart, v))]]

  // optional range: 3:16-18
  {
    let j = v
    while (j < n && isWs(text[j])) j++
    if (j < n && (text[j] === '-' || text[j] === '–' || text[j] === '—')) {
      const jStart = j
      j++
      while (j < n && isWs(text[j])) j++
      const dStart = j
      while (j < n && text[j] >= '0' && text[j] <= '9') j++
      if (j > dStart && j - dStart <= 3) {
        verseRanges[0] = [verseRanges[0][0], Number(text.slice(dStart, j))]
        v = j
      } else {
        v = jStart
      }
    }
  }

  // optional list: 3:16, 18, 20-22
  for (let guard = 0; guard < 20; guard++) {
    let j = v
    while (j < n && isWs(text[j])) j++
    if (j >= n || (text[j] !== ',' && text[j] !== ';')) break
    j++
    while (j < n && isWs(text[j])) j++
    const dStart = j
    while (j < n && text[j] >= '0' && text[j] <= '9') j++
    if (j === dStart || j - dStart > 3) break
    const a = Number(text.slice(dStart, j))
    let b = a
    let j2 = j
    let j3 = j
    while (j3 < n && isWs(text[j3])) j3++
    if (j3 < n && (text[j3] === '-' || text[j3] === '–' || text[j3] === '—')) {
      let j4 = j3 + 1
      while (j4 < n && isWs(text[j4])) j4++
      const d2 = j4
      while (j4 < n && text[j4] >= '0' && text[j4] <= '9') j4++
      if (j4 > d2 && j4 - d2 <= 3) {
        b = Number(text.slice(d2, j4))
        j2 = j4
      }
    }
    verseRanges.push([a, b])
    v = j2
  }

  if (v < n && isAlnum(text[v])) return null

  const verses: number[] = []
  for (const [a, b] of verseRanges) {
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    for (let u = lo; u <= hi; u++) verses.push(u)
  }
  if (!verses.length) return null

  const resolved: number[] = []
  for (const u of verses) {
    if (u < 1 || u > chapterText.length) return null
    if (!resolved.includes(u)) resolved.push(u)
  }
  resolved.sort((a, b) => a - b)

  const contiguous = resolved.length > 1 && resolved.every((u, idx) => idx === 0 || u === resolved[idx - 1] + 1)
  const label =
    resolved.length === 1
      ? `${chapter}:${resolved[0]}`
      : contiguous
        ? `${chapter}:${resolved[0]}-${resolved[resolved.length - 1]}`
        : `${chapter}:${resolved.join(', ')}`

  const verseTexts = resolved.map((u) => chapterText[u - 1])
  const quote = verseTexts.join(' ')
  return {
    startChar: start,
    endChar: v,
    text: text.slice(start, v),
    bookId,
    bookName: book.name,
    chapter,
    verses: resolved,
    verseTexts,
    label,
    quote,
    citation: `— ${book.name} ${label} (KJV)`,
  }
}

/**
 * Manual, linear-time scanner for Bible references.
 * Immune to the regex catastrophic-backtracking / zero-advance bugs
 * that froze the editor on inputs like "job 3:1".
 */
export function scanText(text: string): RawRef[] {
  const out: RawRef[] = []
  const n = text.length
  let i = 0
  while (i < n) {
    if (!isAlnum(text[i])) {
      i++
      continue
    }
    if (i > 0 && isAlnum(text[i - 1])) {
      while (i < n && isAlnum(text[i])) i++
      continue
    }
    const r = tryParseRef(text, i)
    if (r) {
      out.push(r)
      i = r.endChar
    } else {
      while (i < n && isAlnum(text[i])) i++
    }
  }
  return out
}

/** Split document text into char-index -> doc position segments. */
export function scanDoc(doc: Node) {
  let text = ''
  const units: { s: number; e: number; pos: number }[] = []
  let prevParent: Node | null = null
  let prevEnd = -1

  doc.nodesBetween(0, doc.content.size, (node, pos, parent) => {
    if (node.isText && node.text) {
      const gap = prevParent !== null && (parent !== prevParent || pos > prevEnd)
      if (gap) {
        text += '\n'
      }
      units.push({ s: text.length, e: text.length + node.text.length, pos })
      text += node.text
      prevParent = parent
      prevEnd = pos + node.text.length
    }
  })

  return { text, units }
}

export function toDocPos(units: { s: number; e: number; pos: number }[], charIndex: number): number | null {
  if (!units.length) return null
  for (const u of units) {
    if (charIndex >= u.s && charIndex <= u.e) return u.pos + charIndex - u.s
  }
  return null
}

export type { RefMatch }