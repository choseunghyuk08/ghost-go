/**
 * 유령 이미지 검수기
 *
 *   npm run check:assets
 *
 * 파일명이 하나만 틀려도 그 유령만 조용히 임시 그림으로 나온다.
 * 화면만 봐서는 못 잡으므로 자동으로 검사한다.
 *
 * 허용 형식: svg / webp / png  (앞에서부터 우선 사용)
 *   초기 설계는 Firebase Hosting(360MB/일) 기준이라 SVG 를 강제했지만,
 *   Cloudflare Pages 는 대역폭 무제한이라 그 제약이 사라졌다.
 *   지금 기준은 '학교 와이파이에서의 로딩 속도'뿐이다.
 */

import fs from 'node:fs'
import path from 'node:path'
import { GHOSTS } from '../src/data/ghosts.ts'

const DIR = path.join(import.meta.dirname, '..', 'public', 'ghosts')
const EXTS = ['svg', 'webp', 'png'] as const

/** 파일당 권장 상한 (도감은 20종을 한 번에 받는다) */
const WARN_BYTES = 120 * 1024
/** 20종 합계 권장 상한 */
const TOTAL_BUDGET = 1.5 * 1024 * 1024
/** 발견 연출이 200px CSS → 2배 DPR 기준 최소 해상도 */
const MIN_PX = 400

interface Row {
  no: number
  name: string
  file: string
  status: 'ok' | 'missing' | 'warn' | 'error'
  bytes: number
  dim: string
  notes: string[]
}

/** PNG IHDR 파싱 → 크기와 알파 채널 유무 */
function readPng(buf: Buffer) {
  if (buf.length < 33 || buf.toString('ascii', 1, 4) !== 'PNG') return null
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const colorType = buf[25] // 4 = 회색+알파, 6 = RGBA
  return { width, height, hasAlpha: colorType === 4 || colorType === 6 }
}

/** WebP 헤더 파싱 → 크기와 알파 유무 */
function readWebp(buf: Buffer) {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF') return null
  if (buf.toString('ascii', 8, 12) !== 'WEBP') return null
  const fmt = buf.toString('ascii', 12, 16)
  if (fmt === 'VP8X') {
    return {
      width: 1 + (buf.readUIntLE(24, 3) & 0xffffff),
      height: 1 + (buf.readUIntLE(27, 3) & 0xffffff),
      hasAlpha: (buf[20] & 0x10) !== 0,
    }
  }
  if (fmt === 'VP8L') return { width: 0, height: 0, hasAlpha: true } // 무손실은 알파 지원
  return { width: 0, height: 0, hasAlpha: false } // VP8 (손실, 알파 없음)
}

const rows: Row[] = []

for (const g of GHOSTS) {
  const found = EXTS.map((e) => ({ ext: e, full: path.join(DIR, `${g.shape}.${e}`) })).find((c) =>
    fs.existsSync(c.full),
  )

  if (!found) {
    rows.push({
      no: g.no, name: g.name, file: `${g.shape}.(svg|webp|png)`,
      status: 'missing', bytes: 0, dim: '-', notes: ['파일 없음 → 임시 그림 사용'],
    })
    continue
  }

  const buf = fs.readFileSync(found.full)
  const notes: string[] = []
  let status: Row['status'] = 'ok'
  let dim = '-'
  const bump = (s: Row['status']) => {
    if (s === 'error' || status === 'ok') status = s
  }

  if (buf.length > WARN_BYTES) {
    notes.push(`${(buf.length / 1024).toFixed(0)} KB — 권장 ${WARN_BYTES / 1024} KB 초과`)
    bump('warn')
  }

  if (found.ext === 'svg') {
    const svg = buf.toString('utf8')
    if (!svg.includes('<svg')) {
      notes.push('SVG 형식이 아님')
      bump('error')
    }
    const vb = svg.match(/viewBox\s*=\s*["']([^"']+)["']/)
    if (!vb) {
      notes.push('viewBox 없음 (크기 조절이 깨진다)')
      bump('error')
    } else {
      dim = vb[1].replace(/\s+/g, ' ').trim()
      if (dim !== '0 0 100 100') notes.push(`viewBox="${dim}" — "0 0 100 100" 권장`)
    }
    if (/<script[\s>]/i.test(svg)) {
      notes.push('<script> 포함 — 제거할 것')
      bump('error')
    }
    // 비트맵을 SVG 로 감싼 경우: 벡터의 이점이 없고 용량만 커진다
    if (/<image[\s>]/i.test(svg) || /data:image\/(png|jpe?g|webp)/i.test(svg)) {
      notes.push('내부에 비트맵이 들어 있음 — 그럴 거면 webp/png 로 주는 게 낫다')
      bump('warn')
    }
    if (/<rect[^>]*fill\s*=\s*["']?(#fff(fff)?|white)["']?[^>]*>/i.test(svg)) {
      notes.push('흰색 배경 사각형으로 보이는 요소 있음 — 투명이어야 함')
      bump('warn')
    }
  } else {
    const meta = found.ext === 'png' ? readPng(buf) : readWebp(buf)
    if (!meta) {
      notes.push(`${found.ext.toUpperCase()} 헤더를 읽을 수 없음 — 파일이 깨졌거나 확장자가 틀림`)
      bump('error')
    } else {
      if (meta.width) {
        dim = `${meta.width}×${meta.height}`
        if (meta.width < MIN_PX || meta.height < MIN_PX) {
          notes.push(`${dim} — 발견 연출에서 흐릿하다. ${MIN_PX}px 이상 권장`)
          bump('warn')
        }
      }
      if (!meta.hasAlpha) {
        notes.push('투명 배경이 아님 — 어두운 화면에 흰 사각형으로 보인다')
        bump('error')
      }
    }
  }

  rows.push({
    no: g.no, name: g.name, file: path.basename(found.full),
    status, bytes: buf.length, dim, notes,
  })
}

/* ------------------------------------------------------------------ 출력 */

const ICON = { ok: '✅', warn: '⚠️ ', missing: '⬜', error: '❌' }

console.log('\n유령 이미지 검수  (public/ghosts/)\n')
console.log('   #  유령            파일               크기      해상도        상태')
console.log('  ' + '─'.repeat(72))

for (const r of rows) {
  const size = r.bytes ? `${(r.bytes / 1024).toFixed(1)} KB` : '-'
  console.log(
    `  ${String(r.no).padStart(2)}  ${r.name.padEnd(14)}  ${r.file.padEnd(16)}  ${size.padStart(8)}  ${r.dim.padEnd(12)}  ${ICON[r.status]}`,
  )
  for (const n of r.notes) console.log(`      └ ${n}`)
}

const count = (s: Row['status']) => rows.filter((r) => r.status === s).length
const total = rows.reduce((a, r) => a + r.bytes, 0)

console.log('  ' + '─'.repeat(72))
console.log(
  `  정상 ${count('ok')} · 경고 ${count('warn')} · 오류 ${count('error')} · 미제출 ${count('missing')}  /  전체 ${rows.length}`,
)
const pct = ((total / TOTAL_BUDGET) * 100).toFixed(0)
console.log(
  `  합계 ${(total / 1024).toFixed(0)} KB / 권장 ${(TOTAL_BUDGET / 1024 / 1024).toFixed(1)} MB (${pct}%)` +
    (total > TOTAL_BUDGET ? '  ⚠️  도감 첫 로딩이 느려진다' : ''),
)

// 폴더에 있지만 쓰이지 않는 파일 (파일명 오타 탐지)
if (fs.existsSync(DIR)) {
  const known = new Set(GHOSTS.flatMap((g) => EXTS.map((e) => `${g.shape}.${e}`)))
  const extra = fs
    .readdirSync(DIR)
    .filter((f) => /\.(svg|webp|png)$/i.test(f) && !known.has(f))
  if (extra.length) {
    console.log(`\n  ⚠️  쓰이지 않는 파일 ${extra.length}개 — 파일명 오타일 가능성:`)
    for (const f of extra) console.log(`      ${f}`)
  }
}

console.log()

if (count('error') > 0) {
  console.error('오류가 있는 파일이 있습니다. 수정 후 다시 검사하세요.')
  process.exit(1)
}
