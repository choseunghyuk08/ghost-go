/**
 * QR 카드 생성기
 *
 *   node scripts/make-qr.mjs [사이트주소]
 *   예: node scripts/make-qr.mjs https://ghost-go.pages.dev
 *
 * 산출물 (qr-out/ — git 제외)
 *   - <slug>.png     개별 QR (인쇄용 원본)
 *   - cards.html     A4 인쇄용 카드 시트 (2×2, 유령당 1장)
 *   - screen.html    화면 테스트용 (폰으로 모니터를 찍어 스캔)
 *
 * 인쇄 규격 (기획서 PART 0 모순 14 확정):
 *   QR 70mm 이상 / 오류정정 H / 사방 8mm 완전 흰 여백 / 무광 100g 이상
 */

import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { GHOSTS } from '../src/data/ghosts.ts'
import { devSlug } from '../src/lib/slug.ts'

const ORIGIN = (process.argv[2] || 'https://ghost-go.pages.dev').replace(/\/+$/, '')
const OUT = path.join(import.meta.dirname, '..', 'qr-out')
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const items = []
for (const g of GHOSTS) {
  const slug = devSlug(g.ghostId, 1)
  const url = `${ORIGIN}/S/${slug}`
  const file = path.join(OUT, `${slug}.png`)
  await QRCode.toFile(file, url, {
    errorCorrectionLevel: 'H', // 낙서·훼손 대비
    margin: 4, // quiet zone (모듈 4개)
    width: 1200, // 70mm @ 435dpi 상당
    color: { dark: '#000000', light: '#FFFFFF' },
  })
  const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'H', margin: 4, width: 600 })
  items.push({ ...g, slug, url, dataUrl })
  console.log(`  ${String(g.no).padStart(2)} ${g.name.padEnd(12)} ${slug}`)
}

const css = `
  * { box-sizing: border-box; }
  body { margin:0; font-family: 'Malgun Gothic','Apple SD Gothic Neo',sans-serif; background:#fff; }
  .sheet { width:210mm; min-height:297mm; padding:8mm; display:grid;
           grid-template-columns:1fr 1fr; grid-auto-rows:min-content; gap:4mm;
           page-break-after:always; }
  .card { border:1px dashed #ccc; border-radius:4mm; padding:5mm 4mm 4mm;
          background:linear-gradient(160deg,#130A24,#1C1033); color:#F4F1FA;
          display:flex; flex-direction:column; align-items:center; text-align:center; }
  .brand { font-size:11pt; font-weight:900; letter-spacing:-0.3px; }
  .brand span { color:#FF7A00; }
  .ghost { width:26mm; height:26mm; object-fit:contain; margin:2mm 0 1mm; }
  /* QR 주변 8mm 완전 흰 여백 — 여기에 아무것도 겹치면 인식 실패 */
  .qrbox { background:#fff; padding:8mm; border-radius:2mm; }
  .qr { display:block; width:70mm; height:70mm; }
  .scan { margin-top:3mm; font-size:12pt; font-weight:900; color:#FF7A00; letter-spacing:1px; }
  .code { margin-top:1mm; font-size:8pt; color:#9C8BB8; font-family:Consolas,monospace; }
  .safe { margin-top:2mm; font-size:8pt; color:#FFA04D; }
  @media print { .card { border-color:transparent; } body { background:#fff; } }
`

const card = (it) => `
  <div class="card">
    <div class="brand">🎃 고스트 <span>GO</span></div>
    <img class="ghost" src="/ghosts/${it.shape}.webp" alt="" onerror="this.style.visibility='hidden'">
    <div class="qrbox"><img class="qr" src="${it.dataUrl}" alt=""></div>
    <div class="scan">SCAN ME</div>
    <div class="code">${it.slug}</div>
    <div class="safe">⚠️ 뛰지 마세요</div>
  </div>`

// A4 인쇄용: 4장씩 페이지 분할
const pages = []
for (let i = 0; i < items.length; i += 4) pages.push(items.slice(i, i + 4))
fs.writeFileSync(
  path.join(OUT, 'cards.html'),
  `<!doctype html><meta charset="utf-8"><title>고스트 GO QR 카드</title><style>${css}</style>
   ${pages.map((p) => `<div class="sheet">${p.map(card).join('')}</div>`).join('')}`,
)

// 화면 테스트용: 작게 여러 개 (폰으로 모니터를 찍어 스캔)
fs.writeFileSync(
  path.join(OUT, 'screen.html'),
  `<!doctype html><meta charset="utf-8"><title>고스트 GO QR (화면 테스트)</title>
   <style>
     body{margin:0;padding:16px;background:#0B0614;color:#F4F1FA;
          font-family:'Malgun Gothic',sans-serif}
     h1{font-size:18px;margin:0 0 4px}
     p{font-size:12px;color:#9C8BB8;margin:0 0 16px}
     .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
     .c{background:#1C1033;border:1px solid #3a2a5c;border-radius:12px;padding:10px;text-align:center}
     .c img.q{width:100%;background:#fff;padding:6px;border-radius:6px;display:block}
     .c img.g{width:40px;height:40px;object-fit:contain}
     .n{font-size:12px;font-weight:700;margin-top:6px}
     .r{font-size:10px;color:#9C8BB8}
   </style>
   <h1>👻 고스트 GO — QR 테스트</h1>
   <p>이 화면을 모니터에 띄우고 폰으로 스캔하세요. ${ORIGIN}</p>
   <div class="grid">
   ${items
     .map(
       (it) => `<div class="c">
        <img class="q" src="${it.dataUrl}" alt="">
        <img class="g" src="${ORIGIN}/ghosts/${it.shape}.webp" onerror="this.style.display='none'">
        <div class="n">${it.no}. ${it.name}</div>
        <div class="r">${it.rarity}</div>
      </div>`,
     )
     .join('')}
   </div>`,
)

console.log(`\n주소: ${ORIGIN}`)
console.log(`PNG ${items.length}개 + cards.html(인쇄용) + screen.html(화면테스트) → qr-out/`)
console.log('\n⚠️ 지금 슬러그는 devSlug(결정적)입니다.')
console.log('   실제 행사 전에는 generateSlug()로 재발급하고 이 QR을 다시 인쇄해야 합니다.')
