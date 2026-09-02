import { NavLink } from 'react-router-dom'

/**
 * 하단 탭.
 * SCAN 은 가장 중요한 버튼이므로 가운데에서 위로 튀어나온 원형으로 강조한다.
 * 모든 터치 영역 44px 이상.
 */

const TABS = [
  { to: '/', icon: '🏠', label: 'HOME' },
  { to: '/dex', icon: '📖', label: 'DEX' },
  { to: '/scan', icon: '👻', label: 'SCAN', center: true },
  { to: '/ranking', icon: '🏆', label: 'RANK' },
  { to: '/profile', icon: '🎃', label: 'ME' },
]

export function TabBar() {
  return (
    <nav className="safe-b fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-md">
        <div className="relative border-t border-spirit/25 bg-night/92 backdrop-blur-xl">
          <ul className="flex items-stretch justify-around px-2 pt-2 pb-1">
            {TABS.map((t) =>
              t.center ? (
                <li key={t.to} className="relative -mt-8 w-16">
                  <NavLink
                    to={t.to}
                    className={({ isActive }) =>
                      `tap flex flex-col items-center gap-1 transition-transform active:scale-95 ${
                        isActive ? 'scale-105' : ''
                      }`
                    }
                    aria-label="유령 찾기"
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`anim-glow flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-[0_6px_20px_-4px_#ff7a00] ${
                            isActive
                              ? 'bg-pumpkin text-void'
                              : 'bg-gradient-to-b from-pumpkin to-spirit-deep text-ghost-white'
                          }`}
                        >
                          {t.icon}
                        </span>
                        <span className="text-[10px] font-black tracking-wider text-pumpkin">
                          {t.label}
                        </span>
                      </>
                    )}
                  </NavLink>
                </li>
              ) : (
                <li key={t.to} className="flex-1">
                  <NavLink
                    to={t.to}
                    end={t.to === '/'}
                    className={({ isActive }) =>
                      `tap flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors ${
                        isActive ? 'text-pumpkin' : 'text-muted'
                      }`
                    }
                  >
                    <span className="text-lg" aria-hidden>
                      {t.icon}
                    </span>
                    <span className="text-[10px] font-bold tracking-wider">{t.label}</span>
                  </NavLink>
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
    </nav>
  )
}
