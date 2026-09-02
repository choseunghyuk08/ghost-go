/**
 * 유령 이미지 검수기
 *
 *   npm run check:assets
 *
 * 마누스에게 받은 SVG 20개가 실제로 쓸 수 있는 상태인지 점검한다.
 * 파일명이 하나만 틀려도 그 유령은 임시 그림으로 나오는데, 화면만 봐서는
 * 알아채기 어렵다. 그래서 자동으로 검사한다.
 */

import fs from 'node:fs'
import path from 'node:path'
import { GHOSTS } from '../src/data/ghosts.ts'

const DIR = path.join(import.meta.dirname, '..', 'public', 'ghosts')
const MAX_BYTES = 8 * 1024

interface Row {
  no: number
  name: string
  file: string
  status: 'ok' | 'missing' | 'warn' | 'error'
  bytes: number
  notes: string[]
}

const rows: Row[] = []

for (const g of GHOSTS) {
  const file = `${g.shape}.svg`
  const full = path.join(DIR, file)
  const notes: string[] = []

  if (!fs.existsSync(full)) {
    rows.push({ no: g.no, name: g.name, file, status: 'missing', bytes: 0, notes: ['파일 없음 → 임시 그림 사용'] })
    continue
  }

  const buf = fs.readFileSync(full)
  const svg = buf.toString('utf8')
  let status: Row['status'] = 'ok'

  // 1) 진짜 SVG 인가
  if (!svg.includes('<svg')) {
    notes.push('SVG 형식이 아님')
    status = 'error'
  }

  // 2) viewBox
  const vb = svg.match(/viewBox\s*=\s*["']([^"']+)["']/)
  if (!vb) {
    notes.push('viewBox 없음 (크기 조절이 깨진다)')
    status = 'error'
  } else if (vb[1].replace(/\s+/g, ' ').trim() !== '0 0 100 100') {
    notes.push(`viewBox="${vb[1]}" → "0 0 100 100" 이어야 함`)
    if (status === 'ok') status = 'warn'
  }

  // 3) 용량
  if (buf.length > MAX_BYTES) {
    notes.push(`${(buf.length / 1024).toFixed(1)} KB — 8 KB 초과`)
    if (status === 'ok') status = 'warn'
  }

  // 4) 래스터 삽입 (SVG 로 위장한 PNG)
  if (/<image[\s>]/i.test(svg) || /data:image\/(png|jpe?g)/i.test(svg)) {
    notes.push('내부에 비트맵이 들어 있음 — 벡터가 아니다')
    status = 'error'
  }

  // 5) 흰 배경 사각형 (다크 화면에서 흰 판으로 보인다)
  if (/<rect[^>]*fill\s*=\s*["']?(#fff(fff)?|white)["']?[^>]*>/i.test(svg)) {
    notes.push('흰색 배경 사각형이 있는 것 같음 — 투명이어야 함')
    if (status === 'ok') status = 'warn'
  }

  // 6) 스크립트 (외부 SVG 를 그대로 서빙하므로 확인)
  if (/<script[\s>]/i.test(svg)) {
    notes.push('내부에 <script> 가 있음 — 제거할 것')
    status = 'error'
  }

  rows.push({ no: g.no, name: g.name, file, status, bytes: buf.length, notes })
}

/* ------------------------------------------------------------------ 출력 */

const ICON = { ok: '✅', warn: '⚠️ ', missing: '⬜', error: '❌' }

console.log('\n유령 이미지 검수  (public/ghosts/)\n')
console.log('  #   유령            파일               크기      상태')
console.log('  ' + '─'.repeat(62))

for (const r of rows) {
  const size = r.bytes ? `${(r.bytes / 1024).toFixed(1)} KB` : '-'
  console.log(
    `  ${String(r.no).padStart(2)}  ${r.name.padEnd(14)}  ${r.file.padEnd(16)}  ${size.padStart(8)}  ${ICON[r.status]}`,
  )
  for (const n of r.notes) console.log(`      └ ${n}`)
}

const count = (s: Row['status']) => rows.filter((r) => r.status === s).length
const total = rows.reduce((a, r) => a + r.bytes, 0)

console.log('  ' + '─'.repeat(62))
console.log(
  `  정상 ${count('ok')} · 경고 ${count('warn')} · 오류 ${count('error')} · 미제출 ${count('missing')}  /  전체 ${rows.length}`,
)
console.log(`  합계 용량 ${(total / 1024).toFixed(1)} KB`)

// 폴더에 있지만 쓰이지 않는 파일
if (fs.existsSync(DIR)) {
  const known = new Set(GHOSTS.map((g) => `${g.shape}.svg`))
  const extra = fs
    .readdirSync(DIR)
    .filter((f) => f.toLowerCase().endsWith('.svg') && !known.has(f))
  if (extra.length) {
    console.log(`\n  ⚠️  쓰이지 않는 파일 ${extra.length}개 (파일명 오타일 가능성):`)
    for (const f of extra) console.log(`      ${f}`)
  }
}

console.log()

if (count('error') > 0) {
  console.error('오류가 있는 파일이 있습니다. 수정 후 다시 검사하세요.')
  process.exit(1)
}
