export interface BookInfo {
  id: string
  name: string
  chapters: number
  patterns: string[]
}

export interface KJVBook {
  id: string
  name: string
  chapters: string[][]
}

export interface RefMatch {
  from: number
  to: number
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