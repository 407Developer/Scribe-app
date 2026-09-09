import { useEffect, useState } from 'react'
import { BibleEditor } from './components/BibleEditor'
import { loadBibleData } from './lib/bible'

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadBibleData()
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (error) {
    return (
      <div className="boot">
        <h1>Could not load the Bible data</h1>
        <p>{error}</p>
        <p className="boot-note">Make sure <code>public/data/books.json</code> and <code>public/data/kjv.json</code> exist.</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="boot">
        <div className="spinner" />
        <p>Loading Scripture…</p>
      </div>
    )
  }

  return <BibleEditor />
}