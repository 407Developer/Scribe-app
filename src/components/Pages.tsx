import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import type { DocSettings } from '../lib/types'
import { searchReplaceKey } from '../extensions/SearchReplace'

export interface PagesAPI {
  scrollToSelection: () => void
}

interface Props {
  editor: Editor
  settings: DocSettings
  zoom: number
  paperWidth: number
  apiRef: React.MutableRefObject<PagesAPI | null>
  onLayout?: (pageCount: number, currentPage: number) => void
}

interface PBlock {
  index: number
  live: HTMLElement
  top: number
  h: number
  isBreak: boolean
  start?: number
  size?: number
}

const PAGE_ASPECT: Record<string, number> = { letter: 11 / 8.5, a4: 297 / 210 }

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function walkText(root: Element, fn: (node: Text) => void) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let t: Node | null
  while ((t = walker.nextNode())) fn(t as Text)
}

function applyFind(root: Element, query: string, marker: number) {
  const re = new RegExp(escapeRe(query), 'gi')
  const nodes: Text[] = []
  walkText(root, (n) => nodes.push(n))
  let occ = 0
  for (const tn of nodes) {
    const text = tn.data
    const local = new RegExp(re.source, re.flags)
    let mm: RegExpExecArray | null
    while ((mm = local.exec(text))) {
      occ++
      if (occ !== marker) continue
      const [s, e] = [mm.index, mm.index + mm[0].length]
      const frag = document.createDocumentFragment()
      frag.appendChild(document.createTextNode(text.slice(0, s)))
      const mk = document.createElement('mark')
      mk.className = 'find-current'
      mk.appendChild(document.createTextNode(text.slice(s, e)))
      frag.appendChild(mk)
      frag.appendChild(document.createTextNode(text.slice(e)))
      tn.replaceWith(frag)
      return
    }
  }
}

function countOccurrences(root: Element, query: string): number {
  const re = new RegExp(escapeRe(query), 'gi')
  let n = 0
  walkText(root, (t) => {
    const local = new RegExp(re.source, re.flags)
    while (local.exec(t.data)) n++
  })
  return n
}

function charIndexOf(root: Element, target: Node, targetOffset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let t: Node | null
  let acc = 0
  while ((t = walker.nextNode())) {
    if (t === target) return acc + targetOffset
    acc += (t as Text).data.length
  }
  return acc
}

function topBlockOf(node: Node, root: Node): HTMLElement | null {
  let cur: Node | null = node
  while (cur && cur !== root) {
    if (cur.nodeType === 1 && (cur as HTMLElement).parentElement === root) return cur as HTMLElement
    cur = cur.parentNode
  }
  return null
}

function el(tag: string, attrs: Record<string, string> = {}, text = ''): HTMLElement {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  if (text) e.textContent = text
  return e
}

export function PagesView({ editor, settings, zoom, paperWidth, apiRef, onLayout }: Props) {
  const colRef = useRef<HTMLDivElement>(null)
  const measurerRef = useRef<HTMLDivElement>(null)
  const blocksRef = useRef<PBlock[]>([])
  const pendingScrollRef = useRef(false)
  const frameRef = useRef(0)

  useEffect(() => {
    if (!editor) return
    const handler = (e: MouseEvent) => {
      const slot = (e.target as HTMLElement)?.closest?.('.page-slot')
      if (!slot) return
      const bi = Number((slot as HTMLElement).dataset.block)
      const b = blocksRef.current.find((x) => x.index === bi)
      if (!b) return
      const winRoot = slot.firstElementChild?.firstElementChild as Element | null
      if (!winRoot) return
      const range = document.caretRangeFromPoint
        ? document.caretRangeFromPoint(e.clientX, e.clientY)
        : null
      if (!range) return
      const charIdx = winRoot.contains(range.startContainer)
        ? charIndexOf(winRoot, range.startContainer, range.startOffset)
        : b.live.textContent?.length ?? 0
      const start = b.start != null ? b.start : editor.view.posAtDOM(b.live, 0)
      const size = b.size ?? editor.state.doc.resolve(start ?? 0).nodeAfter?.content.size ?? 0
      const pos = Math.min((start ?? 0) + charIdx, (start ?? 0) + size)
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos)))
      const dom = editor.view.dom as HTMLElement
      setTimeout(() => { dom.focus(); editor.commands.focus() }, 50)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [editor])

  const contentWidth = (): number => {
    const live = editor?.view?.dom as HTMLElement | undefined
    if (!live) return paperWidth
    const cs = getComputedStyle(live)
    return Math.max(40, live.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))
  }

  const renderPages = () => {
    const col = colRef.current
    const measurer = measurerRef.current
    if (!editor || !editor.view?.dom || !col || !measurer) return

    const liveRoot = editor.view.dom as HTMLElement
    const cs = getComputedStyle(liveRoot)
    const contentW = contentWidth()

    measurer.className = 'doc-content'
    measurer.style.cssText = `position:absolute;left:-100000px;top:0;width:${contentW}px;visibility:hidden;pointer-events:none;padding:0;line-height:${cs.lineHeight};font-size:${cs.fontSize}`
    measurer.style.setProperty('--doc-ps', cs.getPropertyValue('--doc-ps') || '0.9em')
    measurer.innerHTML = ''

    const raw = Array.from(liveRoot.children) as HTMLElement[]
    const blocks: PBlock[] = []
    raw.forEach((live, bi) => {
      const c = live.cloneNode(true) as HTMLElement
      measurer.appendChild(c)
      blocks.push({ index: bi, live, top: 0, h: 0, isBreak: live.classList.contains('page-break') })
    })
    blocks.forEach((b) => {
      const c = measurer.children[b.index] as HTMLElement
      b.top = c.offsetTop
      b.h = c.offsetHeight
      if (!b.isBreak) {
        const s = editor.view.posAtDOM(b.live, 0)
        if (s != null) {
          b.start = s
          const $s = editor.state.doc.resolve(s)
          b.size = $s.nodeAfter?.content.size ?? 0
        }
      }
    })
    measurer.innerHTML = ''

    const pageH = contentW * (PAGE_ASPECT[settings.pageSize] ?? PAGE_ASPECT.letter)
    const margin = Math.max(0, (paperWidth - contentW) / 2)
    const pages: { start: number; slots: { i: number; y: number }[] }[] = []
    let pageStart = 0
    let pageBottom = pageH
    let cur: { start: number; slots: { i: number; y: number }[] } = { start: 0, slots: [] }
    const flush = () => {
      if (cur.slots.length) pages.push(cur)
    }

    for (const b of blocks) {
      if (b.isBreak) {
        flush()
        pageStart = b.top + b.h
        pageBottom = pageStart + pageH
        cur = { start: pageStart, slots: [] }
        continue
      }
      if (b.top >= pageBottom) {
        flush()
        pageStart = pageBottom
        pageBottom = pageStart + pageH
        cur = { start: pageStart, slots: [] }
      }
      let cursor = b.top
      while (cursor < b.top + b.h) {
        cur.slots.push({ i: b.index, y: b.top - cur.start })
        cursor = Math.min(b.top + b.h, pageBottom)
        if (cursor >= b.top + b.h) break
        flush()
        pageStart = pageBottom
        pageBottom = pageStart + pageH
        cur = { start: pageStart, slots: [] }
      }
    }
    flush()
    if (!pages.length) pages.push({ start: 0, slots: [] })

    col.innerHTML = ''
    const bodies: HTMLElement[] = []
    blocksRef.current = blocks
    pages.forEach((page, pi) => {
      const sheet = el('section', { class: 'page-sheet' })
      const body = el('div', { class: 'page-body doc-content', style: `height:${pageH}px` })
      body.style.setProperty('--doc-lh', cs.lineHeight)
      body.style.setProperty('--doc-ps', cs.getPropertyValue('--doc-ps') || '0.9em')
      for (const s of page.slots) {
        const b = blocks[s.i]
        const slot = el('div', { class: 'page-slot', style: `top:${s.y}px` })
        slot.dataset.block = String(b.index)
        const win = el('div', { class: 'page-block', style: `transform:translateY(-${b.top}px)` })
        win.appendChild(b.live.cloneNode(true))
        slot.appendChild(win)
        body.appendChild(slot)
      }
      sheet.appendChild(el('span', { class: 'page-corner' }, String(pi + 1)))
      sheet.appendChild(body)
      sheet.appendChild(el('span', { class: 'page-foot' }, 'Page ' + String(pi + 1)))
      sheet.style.width = `${paperWidth}px`
      sheet.style.padding = `${margin}px`
      col.appendChild(sheet)
      bodies.push(body)
    })

    if (queryText()) {
      const slots = col.querySelectorAll<HTMLElement>('.page-slot')
      const index = searchReplaceKey.getState(editor.state)?.index ?? 0
      let global = 0
      const markerByBlock = new Map<number, number>()
      blocks.forEach((b) => {
        const n = countOccurrences(b.live, queryText()!)
        for (let k = 0; k < n; k++) {
          if (global === index) markerByBlock.set(b.index, k + 1)
          global++
        }
      })
      slots.forEach((slot) => {
        const bi = Number(slot.dataset.block)
        const marker = markerByBlock.get(bi)
        if (marker == null) return
        const win = slot.firstElementChild?.firstElementChild as Element | null
        if (win) applyFind(win, queryText()!, marker)
      })
    }

    let caret = null as HTMLElement | null
    let caretPage = 1
    const sel = editor.state.selection
    if (sel.empty) {
      try {
        const domPos = editor.view.domAtPos(sel.from)
        const liveBlock = topBlockOf(domPos.node, liveRoot)
        if (liveBlock && liveRoot.contains(liveBlock)) {
          const range = document.createRange()
          range.setStart(domPos.node, domPos.offset)
          range.setEnd(domPos.node, domPos.offset)
          const r = range.getBoundingClientRect()
          const bR = liveBlock.getBoundingClientRect()
          const localY = r.top - bR.top
          const localX = r.left - bR.left
          const block = blocks.find((b) => b.live === liveBlock)
          if (block) {
            const contentY = block.top + localY
            for (let pi = 0; pi < pages.length; pi++) {
              const p = pages[pi]
              if (contentY >= p.start && contentY < p.start + pageH + 0.5) {
                caret = el('div', {
                  class: 'page-caret',
                  style: `top:${contentY - p.start}px;left:${localX}px;height:${r.height || 16}px`,
                })
                bodies[pi].appendChild(caret)
                caretPage = pi + 1
                break
              }
            }
          }
        }
      } catch {
        caret = null
      }
    }

    if (pendingScrollRef.current) {
      let sheet = caret?.closest('.page-sheet') as HTMLElement | null
      if (!sheet) {
        const mk = col.querySelector('.page-sheet .find-current')
        sheet = mk ? ((mk.closest('.page-sheet') as HTMLElement) ?? null) : null
      }
      if (sheet) sheet.scrollIntoView({ behavior: 'smooth', block: 'center' })
      pendingScrollRef.current = false
    }

    onLayout?.(pages.length, caretPage)
  }

  const queryText = () => (editor ? searchReplaceKey.getState(editor.state)?.query ?? '' : '')

  useEffect(() => {
    apiRef.current = {
      scrollToSelection: () => {
        pendingScrollRef.current = true
        renderPages()
      },
    }
    return () => {
      apiRef.current = null
    }
  }, [apiRef, editor])

  useEffect(() => {
    if (!editor) return
    const schedule = () => {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(() => renderPages())
    }
    editor.on('transaction', schedule)
    editor.on('selectionUpdate', schedule)
    return () => {
      editor.off('transaction', schedule)
      editor.off('selectionUpdate', schedule)
    }
  }, [editor, settings, zoom, paperWidth])

  useEffect(() => {
    renderPages()
  }, [settings, zoom, paperWidth, editor])

  return (
    <div className="pages-view" style={{ width: paperWidth * zoom }}>
      <div className="pages-scaler" style={{ width: paperWidth, transform: `scale(${zoom})` }}>
        <div ref={colRef} className="pages-col" />
      </div>
      <div ref={measurerRef} className="pages-meas" />
    </div>
  )
}