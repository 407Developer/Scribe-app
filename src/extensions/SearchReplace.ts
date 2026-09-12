import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { Node } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { scanDoc, toDocPos } from '../lib/bible'

export const searchReplaceKey = new PluginKey<SearchReplaceState>('searchReplace')

export interface SearchReplaceState {
  query: string
  matches: { from: number; to: number }[]
  index: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchFind: { searchFind: (query?: string, select?: boolean) => ReturnType }
    searchNext: { searchNext: () => ReturnType }
    searchPrev: { searchPrev: () => ReturnType }
    searchReplace: { searchReplace: (text: string) => ReturnType }
    searchReplaceAll: { searchReplaceAll: (text: string) => ReturnType }
    searchClear: { searchClear: () => ReturnType }
  }
}

function toEndPos(units: { s: number; e: number; pos: number }[], charIndex: number): number | null {
  const p = toDocPos(units, charIndex)
  if (p != null) return p
  const last = units[units.length - 1]
  return last ? last.pos + (last.e - last.s) : null
}

/** Literal, case-insensitive, paragraph-safe search returning doc ranges. */
export function searchMatches(doc: Node, query: string): { from: number; to: number }[] {
  if (!query) return []
  const { text, units } = scanDoc(doc)
  const out: { from: number; to: number }[] = []
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let i = 0
  while (i <= text.length - q.length) {
    const idx = lower.indexOf(q, i)
    if (idx === -1) break
    const seg = text.slice(idx, idx + q.length)
    if (!seg.includes('\n')) {
      const from = toDocPos(units, idx)
      const to = toEndPos(units, idx + q.length)
      if (from != null && to != null && to > from) out.push({ from, to })
    }
    i = idx + q.length
  }
  return out
}

export const SearchReplace = Extension.create({
  name: 'searchReplace',

  addCommands() {
    return {
      searchFind:
        (query = '', select = false) =>
        ({ tr, dispatch }) => {
          tr.setMeta('searchReplace', { query })
          const matches = searchMatches(tr.doc, query)
          if (matches.length && select) {
            tr.setSelection(TextSelection.create(tr.doc, matches[0].from, matches[0].to))
            tr.scrollIntoView()
          }
          if (dispatch) dispatch(tr)
          return true
        },

      searchNext:
        () =>
        ({ tr, dispatch, state }) => {
          const s = searchReplaceKey.getState(state) as SearchReplaceState | undefined
          if (!s || !s.matches.length) return false
          const index = (s.index + 1) % s.matches.length
          const m = s.matches[index]
          tr.setMeta('searchReplace', { query: s.query, index })
          tr.setSelection(TextSelection.create(tr.doc, m.from, m.to))
          tr.scrollIntoView()
          if (dispatch) dispatch(tr)
          return true
        },

      searchPrev:
        () =>
        ({ tr, dispatch, state }) => {
          const s = searchReplaceKey.getState(state) as SearchReplaceState | undefined
          if (!s || !s.matches.length) return false
          const index = (s.index - 1 + s.matches.length) % s.matches.length
          const m = s.matches[index]
          tr.setMeta('searchReplace', { query: s.query, index })
          tr.setSelection(TextSelection.create(tr.doc, m.from, m.to))
          tr.scrollIntoView()
          if (dispatch) dispatch(tr)
          return true
        },

      searchReplace:
        (text: string) =>
        ({ tr, dispatch, state }) => {
          const s = searchReplaceKey.getState(state) as SearchReplaceState | undefined
          if (!s || !s.query) return false
          const m = s.matches[s.index]
          if (!m) return false
          const { from, to } = state.selection
          if (from !== m.from || to !== m.to) return false
          tr.insertText(text, from, to)
          tr.setMeta('searchReplace', { query: s.query, index: s.index })
          const next = searchMatches(tr.doc, s.query)[Math.min(s.index, Math.max(searchMatches(tr.doc, s.query).length - 1, 0))]
          if (next) {
            tr.setSelection(TextSelection.create(tr.doc, next.from, next.to))
            tr.scrollIntoView()
          }
          if (dispatch) dispatch(tr)
          return true
        },

      searchReplaceAll:
        (text: string) =>
        ({ tr, dispatch, state }) => {
          const s = searchReplaceKey.getState(state) as SearchReplaceState | undefined
          if (!s || !s.matches.length) return false
          const nodes = state.schema.text(text)
          for (let i = s.matches.length - 1; i >= 0; i--) {
            tr.replaceWith(s.matches[i].from, s.matches[i].to, nodes)
          }
          tr.setMeta('searchReplace', { query: s.query, index: 0 })
          const first = searchMatches(tr.doc, s.query)[0]
          if (first) {
            tr.setSelection(TextSelection.create(tr.doc, first.from, first.to))
            tr.scrollIntoView()
          }
          if (dispatch) dispatch(tr)
          return true
        },

      searchClear:
        () =>
        ({ tr, dispatch }) => {
          if (tr.selection?.empty === false) tr.setSelection(TextSelection.near(tr.selection.$from))
          tr.setMeta('searchReplace', { query: '', clear: true })
          if (dispatch) dispatch(tr)
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const compute = (doc: Node, query: string, index = 0): SearchReplaceState => {
      const matches = searchMatches(doc, query)
      return { query, matches, index: matches.length ? Math.min(index, matches.length - 1) : 0 }
    }
    return [
      new Plugin<SearchReplaceState>({
        key: searchReplaceKey,
        state: {
          init: () => ({ query: '', matches: [], index: 0 }),
          apply(tr, prev) {
            const meta = tr.getMeta('searchReplace') as { query?: string; clear?: boolean; index?: number } | undefined
            if (meta?.clear) return { query: '', matches: [], index: 0 }
            if (meta && meta.query !== undefined) return compute(tr.doc, meta.query, meta.index ?? 0)
            if (tr.docChanged) return prev.query ? compute(tr.doc, prev.query, prev.index) : prev
            return prev
          },
        },
        props: {
          decorations(state) {
            const s = searchReplaceKey.getState(state)
            if (!s || !s.matches.length) return DecorationSet.empty
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.index ? 'find-current' : 'find-match' })),
            )
          },
        },
      }),
    ]
  },
})