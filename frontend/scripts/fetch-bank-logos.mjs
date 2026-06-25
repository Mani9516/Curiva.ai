import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'
import { siHsbc, siDeutschebank } from 'simple-icons'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../src/assets/banks')
const base = 'https://raw.githubusercontent.com/praveenpuglia/indian-banks/main/assets/logos'

const SLUG_MAP = {
  sbi: 'sbin',
  hdfc: 'hdfc',
  icici: 'icic',
  axis: 'utib',
  kotak: 'kkbk',
  bob: 'barb',
  pnb: 'punb',
  ubi: 'ubin',
  canara: 'cnrb',
  indusind: 'indb',
  yes: 'yesb',
  idbi: 'ibkl',
  federal: 'fdrl',
  indian: 'idib',
  uco: 'ucba',
  central: 'cbin',
  bom: 'mahb',
  karnataka: 'karb',
  rbl: 'ratn',
  southindian: 'sibl',
  karur: 'kvbl',
  bandhan: 'bdbl',
  au: 'aubl',
  dcb: 'dcbl',
  tmb: 'tmbl',
  cityunion: 'ciub',
  jk: 'jaka',
  csb: 'csbk',
  dhanlaxmi: 'dlxb',
  iob: 'ioba',
  sc: 'scbl',
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetch(res.headers.location).then(resolve).catch(reject)
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function simpleIconSvg(icon) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img"><title>${icon.title}</title><path fill="#${icon.hex}" d="${icon.path}"/></svg>`
}

fs.mkdirSync(outDir, { recursive: true })

const results = []
for (const [id, slug] of Object.entries(SLUG_MAP)) {
  const url = `${base}/${slug}/logo.svg`
  try {
    const buf = await fetch(url)
    const text = buf.toString('utf8')
    if (!text.includes('<svg')) throw new Error('not svg')
    fs.writeFileSync(path.join(outDir, `${id}.svg`), text)
    results.push(`${id}: ok`)
  } catch (e) {
    results.push(`${id}: fail (${e.message})`)
  }
}

for (const [id, icon] of [
  ['hsbc_in', siHsbc],
  ['db', siDeutschebank],
]) {
  fs.writeFileSync(path.join(outDir, `${id}.svg`), simpleIconSvg(icon))
  results.push(`${id}: simple-icons`)
}

// Equitas — fetch PNG from official site touch icon fallback
try {
  const eq = await fetch('https://www.equitasbank.com/favicon.ico')
  if (eq.length > 100) {
    fs.writeFileSync(path.join(outDir, 'equitas.ico'), eq)
    results.push('equitas: favicon.ico')
  }
} catch (e) {
  results.push(`equitas: fail (${e.message})`)
}

console.log(results.join('\n'))
