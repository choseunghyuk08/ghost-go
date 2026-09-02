import { useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Btn, Screen, Spinner } from './components/ui'
import { TabBar } from './components/TabBar'
import { GhostSprite } from './components/GhostSprite'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Scan } from './screens/Scan'
import { Reveal } from './screens/Reveal'
import { Dex } from './screens/Dex'
import { Ranking } from './screens/Ranking'
import { Profile } from './screens/Profile'
import { Prize } from './screens/Prize'
import { Ops } from './screens/Ops'
import { useGame } from './store/game'
import { parseSlug } from './lib/qr'

/** 탭바를 숨겨야 하는 화면 (몰입 화면) */
const FULLSCREEN = ['/scan', '/reveal']

function Shell() {
  const loc = useLocation()
  const hideTabs = FULLSCREEN.some((p) => loc.pathname.startsWith(p))

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/reveal" element={<Reveal />} />
        <Route path="/dex" element={<Dex />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/prize" element={<Prize />} />
        {/* QR 을 카메라 앱으로 직접 찍어 들어온 경우: /S/GG1-XXXX */}
        <Route path="/s/:slug" element={<DirectSlug />} />
        <Route path="/S/:slug" element={<DirectSlug />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideTabs && <TabBar />}
    </>
  )
}

/**
 * 폰 기본 카메라 앱으로 QR 을 찍으면 앱이 아니라 URL 로 바로 들어온다.
 * 이 경우에도 게임 안에서 발견 연출이 돌도록 /reveal 로 넘긴다.
 */
function DirectSlug() {
  const loc = useLocation()
  const slug = parseSlug(decodeURIComponent(loc.pathname.split('/').pop() ?? ''))
  // 렌더마다 새 키가 생기지 않도록 최초 1회만 만든다
  const idemRef = useRef<string | null>(null)
  if (idemRef.current === null) idemRef.current = crypto.randomUUID()
  return slug ? (
    <Navigate to="/reveal" state={{ slug, idem: idemRef.current }} replace />
  ) : (
    <Navigate to="/scan" replace />
  )
}

function Boot() {
  const boot = useGame((s) => s.boot)
  const bootError = useGame((s) => s.bootError)
  const bootstrap = useGame((s) => s.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (boot === 'loading') {
    return (
      <Screen className="items-center justify-center gap-5">
        <GhostSprite shape="ribbon" rarity="EPIC" attribute="SHADOW" size={120} aura />
        <div>
          <p className="text-center text-3xl font-black tracking-tight text-ghost-white">
            고스트 <span className="text-pumpkin">GO</span>
          </p>
          <p className="mt-1 text-center text-xs tracking-[0.25em] text-muted">
            SUMMONING GHOSTS…
          </p>
        </div>
        <Spinner />
      </Screen>
    )
  }

  if (boot === 'error') {
    return (
      <Screen className="items-center justify-center gap-4 px-8">
        <div className="text-5xl opacity-60">🌫️</div>
        <p className="text-center text-sm text-lilac">{bootError ?? '연결에 실패했어요.'}</p>
        <Btn onClick={() => window.location.reload()}>다시 시도</Btn>
      </Screen>
    )
  }

  if (boot === 'need-nickname') return <Onboarding />

  return <Shell />
}

/**
 * 운영 화면(/ops)은 플레이어 온보딩을 거치지 않는다.
 * 스태프는 닉네임을 만들 필요가 없고, 서버가 쿠키로 권한을 판정한다.
 */
function Root() {
  const loc = useLocation()
  if (loc.pathname.toLowerCase().startsWith('/ops')) {
    return (
      <Routes>
        <Route path="/ops" element={<Ops />} />
        <Route path="/ops/*" element={<Navigate to="/ops" replace />} />
      </Routes>
    )
  }
  return <Boot />
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="mx-auto max-w-md">
        <Root />
      </div>
    </BrowserRouter>
  )
}
