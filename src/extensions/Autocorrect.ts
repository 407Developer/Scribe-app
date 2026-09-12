import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { AUTOCORRECT_LIMIT, correctWord, isLetter } from '../lib/autocorrect'

export const Autocorrect = Extension.create({
  name: 'autocorrect',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleTextInput(view, from, to, text) {
            if (!text || from !== to || text.length > 1) return false
            if (isLetter(text)) return false

            const { doc } = view.state
            const $from = doc.resolve(from)
            if ($from.parent.type.name === 'codeBlock') return false
            if ($from.marks().some((m) => m.type.name === 'code')) return false

            const start = Math.max(0, from - AUTOCORRECT_LIMIT)
            const anchor = doc.textBetween(start, from)
            const m = /([A-Za-z']+)$/.exec(anchor)
            if (!m) return false
            if (m.index === 0) return false

            const word = m[1]
            const wordStart = from - word.length
            if (word.includes("'") && word.length < 4) return false

            const correction = correctWord(word)
            if (!correction || correction === word) return false

            const tr = view.state.tr
            tr.replaceWith(wordStart, from, view.state.schema.text(correction))
            tr.insertText(text, wordStart + correction.length)
            tr.setMeta('addToHistory', false)
            view.dispatch(tr)
            return true
          },
        },
      }),
    ]
  },
})