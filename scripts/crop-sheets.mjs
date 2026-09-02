/**
 * 미리보기 시트 → 유령 개별 투명 PNG (임시 방편)
 *
 * ⚠️ 이건 원본 파일을 못 구했을 때의 차선책이다.
 *    1200×630 JPEG 안에 10마리가 들어 있어 한 마리당 ~180px 뿐이고,
 *    후광이 이미 그려져 있어 배경을 깨끗이 분리할 수 없다.
 *    가능하면 원본 개별 파일을 받는 편이 훨씬 낫다.
 *
 * 방식:
 *   1) 아트 밴드에서 내용이 있는 x 범위를 자동 검출 → 5등분
 *   2) 셀 모서리에서 배경색을 추정하고 색 거리로 알파 생성
 *   3) 원형 비네트를 곱해 사각 경계를 없앰 (앱 배경이 거의 검정이라 자연스럽다)
 */
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const DIR =
  'C:/Users/IOT2/AppData/Local/Temp/claude/d--experience/d014c093-d946-4a77-88d2-2cf56e689bbf/scratchpad/sheets'
const OUT = path.join(DIR, 'out')
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const SHEETS = [
  {
    file: 'sheet1.jpg',
    // 시트1은 유령 뒤에 밝은 후광이 그려져 있다.
    // 색 거리 임계를 높이고 비네트를 좁혀 후광을 걷어낸다.
    dist: [0.09, 0.28],
    vig: [0.70, 1.00],
    rows: [
      { y0: 12, y1: 205, names: ['ribbon', 'box', 'board', 'tray', 'drop'] },
      { y0: 262, y1: 440, names: ['rod', 'leaf', 'paper', 'stair', 'flask'] },
    ],
  },
  {
    file: 'sheet2.jpg',
    // 시트2는 배경이 거의 검정이라 그대로 두면 앱 배경과 자연스럽게 이어진다
    dist: [0.05, 0.22],
    vig: [0.84, 1.06],
    rows: [
      { y0: 8, y1: 196, names: ['note', 'ball', 'hydrant', 'bundle', 'book'] },
      { y0: 252, y1: 430, names: ['mirror', 'mic', 'bust', 'clock', 'door'] },
    ],
  },
]

const CANVAS = 256
const PAD = 0.05

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/** 밴드에서 내용이 있는 x 범위를 찾는다 (좌우 레터박스 제거) */
async function contentX(src, y0, y1, W) {
  const { data, info } = await sharp(src)
    .extract({ left: 0, top: y0, width: W, height: y1 - y0 })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const ch = info.channels
  const colMax = new Float64Array(info.width)
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const p = (y * info.width + x) * ch
      const l = lum(data[p], data[p + 1], data[p + 2])
      if (l > colMax[x]) colMax[x] = l
    }
  }
  const TH = 0.12
  let a = 0
  let b = info.width - 1
  while (a < info.width && colMax[a] < TH) a++
  while (b > a && colMax[b] < TH) b--
  return [a, b + 1]
}

const results = []

for (const sheet of SHEETS) {
  const src = path.join(DIR, sheet.file)
  const meta = await sharp(src).metadata()

  for (const row of sheet.rows) {
    const [cx0, cx1] = await contentX(src, row.y0, row.y1, meta.width)
    const cellW = (cx1 - cx0) / row.names.length
    console.log(`${sheet.file} y${row.y0}-${row.y1}: x ${cx0}~${cx1} (셀 폭 ${cellW.toFixed(1)})`)

    for (let i = 0; i < row.names.length; i++) {
      const name = row.names[i]
      const left = Math.round(cx0 + cellW * i)
      const width = Math.round(cellW)
      const top = row.y0
      const height = row.y1 - row.y0

      const { data, info } = await sharp(src)
        .extract({ left, top, width, height })
        .raw()
        .toBuffer({ resolveWithObject: true })

      const ch = info.channels
      const W = info.width
      const H = info.height

      // 셀 네 모서리에서 배경색 추정
      const S = 6
      let br = 0, bg = 0, bb = 0, n = 0
      for (const [ox, oy] of [[0, 0], [W - S, 0], [0, H - S], [W - S, H - S]]) {
        for (let y = oy; y < oy + S; y++)
          for (let x = ox; x < ox + S; x++) {
            const p = (y * W + x) * ch
            br += data[p]; bg += data[p + 1]; bb += data[p + 2]; n++
          }
      }
      br /= n; bg /= n; bb /= n

      const cxp = W / 2
      const cyp = H / 2
      const rMax = Math.min(W, H) / 2

      const rgba = Buffer.alloc(W * H * 4)
      let minX = W, minY = H, maxX = -1, maxY = -1
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = (y * W + x) * ch
          const r = data[p], g = data[p + 1], b = data[p + 2]

          // 배경색과의 거리 → 알파
          const d = Math.sqrt((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2) / 255
          let a = smooth(sheet.dist[0], sheet.dist[1], d)

          // 원형 비네트로 사각 경계 제거
          const dist = Math.hypot((x - cxp) / rMax, (y - cyp) / rMax)
          a *= 1 - smooth(sheet.vig[0], sheet.vig[1], dist)

          const A = Math.round(clamp01(a) * 255)
          rgba[(y * W + x) * 4] = r
          rgba[(y * W + x) * 4 + 1] = g
          rgba[(y * W + x) * 4 + 2] = b
          rgba[(y * W + x) * 4 + 3] = A
          if (A >= 170) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }

      if (maxX < 0) { console.log(`  ${name}: 내용 없음`); continue }

      // bbox 를 조금 넓혀 비네트로 부드럽게 사라지는 가장자리를 포함시킨다.
      // (딱 맞게 자르면 잘린 단면이 직선으로 드러난다)
      const mx = Math.round((maxX - minX + 1) * 0.14)
      const my = Math.round((maxY - minY + 1) * 0.14)
      minX = Math.max(0, minX - mx); maxX = Math.min(W - 1, maxX + mx)
      minY = Math.max(0, minY - my); maxY = Math.min(H - 1, maxY + my)

      const bw = maxX - minX + 1
      const bh = maxY - minY + 1
      const inner = Math.round(CANVAS * (1 - PAD * 2))
      const scale = inner / Math.max(bw, bh)
      const tw = Math.max(1, Math.round(bw * scale))
      const th = Math.max(1, Math.round(bh * scale))

      const cropped = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
        .extract({ left: minX, top: minY, width: bw, height: bh })
        .resize(tw, th, { fit: 'fill', kernel: 'lanczos3' })
        .png()
        .toBuffer()

      const outPath = path.join(OUT, `${name}.png`)
      await sharp({
        create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: cropped, left: (CANVAS - tw) >> 1, top: (CANVAS - th) >> 1 }])
        .png({ compressionLevel: 9 })
        .toFile(outPath)

      const size = fs.statSync(outPath).size
      results.push({ name, bytes: size })
      console.log(`  ${name.padEnd(9)} bbox ${String(bw).padStart(3)}×${String(bh).padStart(3)} → ${(size / 1024).toFixed(0)} KB`)
    }
  }
}

console.log(`\n총 ${results.length}개 / ${(results.reduce((a, r) => a + r.bytes, 0) / 1024).toFixed(0)} KB`)

const tiles = results.map((r, i) => ({
  input: path.join(OUT, `${r.name}.png`),
  left: (i % 5) * 200 + 8,
  top: ((i / 5) | 0) * 200 + 8,
}))
await sharp({
  create: { width: 5 * 200 + 16, height: 4 * 200 + 16, channels: 4, background: { r: 11, g: 6, b: 20, alpha: 255 } },
})
  .composite(tiles.map((t) => ({ input: t.input, left: t.left, top: t.top })))
  .png()
  .toFile(path.join(DIR, 'contact.png'))
console.log('검수 시트: contact.png')
