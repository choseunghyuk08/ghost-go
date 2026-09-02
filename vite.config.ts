import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 스마트폰 실기기 테스트용: 같은 와이파이에서 http://<PC IP>:5173 으로 접속
    host: true,
    port: 5173,
  },
  build: {
    // 번들 예산: 초기 로드 gzip 250KB. 넘으면 경고가 뜨도록 낮게 잡는다.
    // (zxing-wasm 은 동적 import 라 iOS 사용자만 별도 청크로 받는다)
    chunkSizeWarningLimit: 700,
  },
})
