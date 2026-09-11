import { Extension } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node } from '@tiptap/pm/model'
import { scanDoc, scanText, toDocPos } from '../lib/bible'
import type { RefMatch } from '../lib/types'

export const bibleRefKey = new PluginKey<PluginState>('bibleReference')

interface PluginState {
  matches: RefMatch[]
  decor: DecorationSet
}

export function scanDocument(doc: Node): PluginState {
  const matches: RefMatch[] = []
  const ranges: { from: number; to: number; obj: Decoration }[] = []
  const { text, units } = scanDoc(doc)

  if (units.length) {
    for (const r of scanText(text)) {
      const from = toDocPos(units, r.startChar)
      const to = toDocPos(units, r.endChar)
      if (from == null || to == null) continue
      const resolved = doc.resolve(from)
      let inQuote = false
      for (let d = 1; d <= resolved.depth; d++) {
        if (resolved.node(d).type.name === 'blockquote') {
          inQuote = true
          break
        }
      }
      if (inQuote) continue
      const rec: RefMatch = { ...r, from, to }
      matches.push(rec)
      ranges.push({ from, to, obj: Decoration.inline(from, to, { class: 'bible-ref', 'data-ref': rec.citation }) })
    }
  }

  ranges.sort((a, b) => a.from - b.from)
  return { matches, decor: DecorationSet.create(doc, ranges.map((r) => r.obj)) }
}

/** True when the verse text already follows the reference inline (same paragraph). */
export function alreadyQuoted(state: { doc: Node }, match: RefMatch): boolean {
  const doc = state.doc
  const start = match.to
  if (start >= doc.content.size) return false
  const probe = doc.textBetween(start, Math.min(start + 160, doc.content.size), ' ')
  const head = match.quote.slice(0, 48)
  return !!head && probe.trimStart().startsWith(head)
}

/** The doc-style quote: bold label goes first, then the verse text, "Vs 3", "Vs 4", … for ranges. */
export function composeVerseText(match: RefMatch): { label: string; body: string } {
  const label = `${match.bookName} ${match.label} `
  const vt = match.verseTexts
  let body = vt.length ? vt[0] : ''
  for (let i = 1; i < vt.length; i++) {
    body += ` Vs ${match.verses[i]} ${vt[i]}`
  }
  return { label, body }
}

/** Insert the quoted verses as inline doc-style text, replacing the typed reference. */
export function insertVerse(view: EditorView, match: RefMatch): boolean {
  const { state } = view
  if (alreadyQuoted(state, match)) return true

  const { schema } = state
  const marks = schema.marks.bold.create()
  const { label, body } = composeVerseText(match)
  const nodes = [schema.text(label, [marks]), schema.text(body)]

  const tr = state.tr
  tr.replaceWith(match.from, match.to, nodes)
  const end = tr.doc.content.size
  let cursor = match.from + nodes.reduce((n, t) => n + t.nodeSize, 0)
  if (cursor < 0 || cursor > end) cursor = end
  let sel: Selection
  try {
    sel = TextSelection.near(tr.doc.resolve(cursor))
  } catch {
    sel = TextSelection.near(tr.doc.resolve(end))
  }
  tr.setSelection(sel)
  tr.scrollIntoView()
  view.dispatch(tr)
  return true
}

export function currentMatch(state: EditorState): RefMatch | null {
  const pl = bibleRefKey.getState(state)
  if (!pl || !pl.matches.length) return null
  const { from } = state.selection
  const at = pl.matches.find((m) => from >= m.from + 1 && from <= m.to + 1)
  if (at) return at
  let best: RefMatch | null = null
  for (const m of pl.matches) {
    if (m.to < from && (!best || m.to > best.to)) best = m
  }
  return best
}

export function insertCurrentMatch(view: EditorView): boolean {
  const m = currentMatch(view.state)
  return m ? insertVerse(view, m) : false
}

export const BibleReference = Extension.create({
  name: 'bibleReference',

  addProseMirrorPlugins() {
    return [
      new Plugin<PluginState>({
        key: bibleRefKey,
        state: {
          init: (_, state) => scanDocument(state.doc),
          apply(tr, prev) {
            if (tr.docChanged) return scanDocument(tr.doc)
            return prev
          },
        },
        props: {
          decorations: (state) => bibleRefKey.getState(state)?.decor ?? DecorationSet.empty,
          handleKeyDown(view, event) {
            if (!(event.key === 'Enter' && event.shiftKey)) return false
            const { state } = view
            if (!state.selection.empty) return false
            const pl = bibleRefKey.getState(state)
            if (!pl || !pl.matches.length) return false
            const m = currentMatch(state)
            if (!m || alreadyQuoted(state, m)) return false
            event.preventDefault()
            return insertVerse(view, m)
          },
          handleClick(view, _pos, event) {
            if (event.button !== 0) return false
            const { state } = view
            const pl = bibleRefKey.getState(state)
            if (!pl || !pl.matches.length) return false
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
            if (!pos) return false
            const m = pl.matches.find((match) => pos.pos > match.from && pos.pos < match.to)
            if (!m) return false
            return insertVerse(view, m)
          },
        },
      }),
    ]
  },
})