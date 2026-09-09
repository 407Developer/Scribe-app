import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const input = process.argv[2] ?? path.join(root, 'public/data/kjv.raw.json')

const BOOKS = {
  Genesis: ['gen', 'Genesis', ['genesis', 'gen']],
  Exodus: ['exo', 'Exodus', ['exodus', 'exod', 'exo', 'ex']],
  Leviticus: ['lev', 'Leviticus', ['leviticus', 'lev']],
  Numbers: ['num', 'Numbers', ['numbers', 'num', 'nu']],
  Deuteronomy: ['deut', 'Deuteronomy', ['deuteronomy', 'deut', 'dt']],
  Joshua: ['jos', 'Joshua', ['joshua', 'josh', 'jos']],
  Judges: ['jdg', 'Judges', ['judges', 'judg', 'jdg']],
  Ruth: ['rth', 'Ruth', ['ruth', 'rth']],
  'I Samuel': ['1sam', '1 Samuel', ['1 samuel', '1 sam', 'i samuel', 'i sam', '1samuel', '1sam']],
  'II Samuel': ['2sam', '2 Samuel', ['2 samuel', '2 sam', 'ii samuel', 'ii sam', '2samuel', '2sam']],
  'I Kings': ['1ki', '1 Kings', ['1 kings', '1 kgs', '1 ki', 'i kings', 'i ki', '1kings', '1ki']],
  'II Kings': ['2ki', '2 Kings', ['2 kings', '2 kgs', '2 ki', 'ii kings', 'ii ki', '2kings', '2ki']],
  'I Chronicles': ['1chr', '1 Chronicles', ['1 chronicles', '1 chron', '1 chr', 'i chronicles', 'i chr', '1chronicles', '1chr']],
  'II Chronicles': ['2chr', '2 Chronicles', ['2 chronicles', '2 chron', '2 chr', 'ii chronicles', 'ii chr', '2chronicles', '2chr']],
  Ezra: ['ezra', 'Ezra', ['ezra', 'ezr']],
  Nehemiah: ['neh', 'Nehemiah', ['nehemiah', 'neh']],
  Esther: ['est', 'Esther', ['esther', 'est']],
  Job: ['job', 'Job', ['job']],
  Psalms: ['ps', 'Psalms', ['psalms', 'psalm', 'ps', 'psa']],
  Proverbs: ['pro', 'Proverbs', ['proverbs', 'prov', 'pro']],
  Ecclesiastes: ['ecc', 'Ecclesiastes', ['ecclesiastes', 'eccl', 'ecc']],
  'Song of Solomon': ['song', 'Song of Solomon', ['song of solomon', 'song of songs', 'song', 'sos', 'canticles', 'sol']],
  Isaiah: ['isa', 'Isaiah', ['isaiah', 'isa', 'is']],
  Jeremiah: ['jer', 'Jeremiah', ['jeremiah', 'jer', 'jr']],
  Lamentations: ['lam', 'Lamentations', ['lamentations', 'lam']],
  Ezekiel: ['ezek', 'Ezekiel', ['ezekiel', 'ezek', 'eze']],
  Daniel: ['dan', 'Daniel', ['daniel', 'dan']],
  Hosea: ['hos', 'Hosea', ['hosea', 'hos']],
  Joel: ['joel', 'Joel', ['joel']],
  Amos: ['amos', 'Amos', ['amos']],
  Obadiah: ['obad', 'Obadiah', ['obadiah', 'obad']],
  Jonah: ['jon', 'Jonah', ['jonah', 'jon']],
  Micah: ['mic', 'Micah', ['micah', 'mic']],
  Nahum: ['nah', 'Nahum', ['nahum', 'nah']],
  Habakkuk: ['hab', 'Habakkuk', ['habakkuk', 'hab']],
  Zephaniah: ['zeph', 'Zephaniah', ['zephaniah', 'zeph']],
  Haggai: ['hag', 'Haggai', ['haggai', 'hag']],
  Zechariah: ['zech', 'Zechariah', ['zechariah', 'zech']],
  Malachi: ['mal', 'Malachi', ['malachi', 'mal']],
  Matthew: ['matt', 'Matthew', ['matthew', 'matt', 'mt']],
  Mark: ['mark', 'Mark', ['mark', 'mrk', 'mk']],
  Luke: ['luke', 'Luke', ['luke', 'luk', 'lu']],
  John: ['john', 'John', ['john', 'jhn', 'jn']],
  Acts: ['act', 'Acts', ['acts', 'act']],
  Romans: ['rom', 'Romans', ['romans', 'rom', 'ro']],
  'I Corinthians': ['1cor', '1 Corinthians', ['1 corinthians', '1 cor', 'i corinthians', 'i cor', '1corinthians', '1cor']],
  'II Corinthians': ['2cor', '2 Corinthians', ['2 corinthians', '2 cor', 'ii corinthians', 'ii cor', '2corinthians', '2cor']],
  Galatians: ['gal', 'Galatians', ['galatians', 'gal']],
  Ephesians: ['eph', 'Ephesians', ['ephesians', 'eph']],
  Philippians: ['phil', 'Philippians', ['philippians', 'phil', 'php']],
  Colossians: ['col', 'Colossians', ['colossians', 'col']],
  'I Thessalonians': ['1thess', '1 Thessalonians', ['1 thessalonians', '1 thess', 'i thessalonians', 'i thess', '1thess', '1th']],
  'II Thessalonians': ['2thess', '2 Thessalonians', ['2 thessalonians', '2 thess', 'ii thessalonians', 'ii thess', '2thess', '2th']],
  'I Timothy': ['1tim', '1 Timothy', ['1 timothy', '1 tim', 'i timothy', 'i tim', '1timothy', '1tim', '1ti']],
  'II Timothy': ['2tim', '2 Timothy', ['2 timothy', '2 tim', 'ii timothy', 'ii tim', '2timothy', '2tim', '2ti']],
  Titus: ['tit', 'Titus', ['titus', 'tit']],
  Philemon: ['phlm', 'Philemon', ['philemon', 'phlm', 'phm']],
  Hebrews: ['heb', 'Hebrews', ['hebrews', 'heb']],
  James: ['james', 'James', ['james', 'jas']],
  'I Peter': ['1pet', '1 Peter', ['1 peter', '1 pet', 'i peter', 'i pet', '1peter', '1pet', '1pe']],
  'II Peter': ['2pet', '2 Peter', ['2 peter', '2 pet', 'ii peter', 'ii pet', '2peter', '2pet', '2pe']],
  'I John': ['1john', '1 John', ['1 john', '1 jn', 'i john', 'i jn', '1john', '1jn']],
  'II John': ['2john', '2 John', ['2 john', '2 jn', 'ii john', 'ii jn', '2john', '2jn', '2jo']],
  'III John': ['3john', '3 John', ['3 john', '3 jn', 'iii john', 'iii jn', '3john', '3jn', '3jo']],
  Jude: ['jude', 'Jude', ['jude']],
  'Revelation of John': ['rev', 'Revelation', ['revelation', 'revelation of john', 'rev', 're', 'rv']],
}

function dotVariants(patterns) {
  const out = []
  for (const p of patterns) {
    out.push(p)
    out.push(`${p}.`)
  }
  return out
}

async function main() {
  const raw = JSON.parse(await fs.readFile(input, 'utf8'))
  const compact = { meta: { id: 'kjv', name: 'King James Version (1769)', short: 'KJV', language: 'en' }, books: [] }
  const index = []

  for (const rb of raw.books) {
    const [id, name, patterns] = BOOKS[rb.name]
    if (!id) throw new Error(`Unknown book: ${rb.name}`)
    const chapters = rb.chapters.map((c) => c.verses.map((v) => v.text))
    compact.books.push({ id, name, chapters })
    index.push({ id, name, chapters: chapters.length, patterns: dotVariants(patterns) })
  }

  await fs.mkdir(path.join(root, 'public/data'), { recursive: true })
  await fs.writeFile(path.join(root, 'public/data/kjv.json'), JSON.stringify(compact), 'utf8')
  await fs.writeFile(path.join(root, 'public/data/books.json'), JSON.stringify(index), 'utf8')

  const size = (await fs.stat(path.join(root, 'public/data/kjv.json'))).size
  console.log(`Wrote ${index.length} books. kjv.json = ${(size / 1024 / 1024).toFixed(2)} MB`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})