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

export type ParaSpacingPreset = 'none' | 'small' | 'normal'
export type PageSizePreset = 'a4' | 'letter'
export type MarginsPreset = 'normal' | 'narrow' | 'wide'

export interface DocSettings {
  lineSpacing: number
  paraSpacing: ParaSpacingPreset
  pageSize: PageSizePreset
  margins: MarginsPreset
  pageNumbers: boolean
}

export const DEFAULT_SETTINGS: DocSettings = {
  lineSpacing: 1.5,
  paraSpacing: 'normal',
  pageSize: 'letter',
  margins: 'normal',
  pageNumbers: false,
}