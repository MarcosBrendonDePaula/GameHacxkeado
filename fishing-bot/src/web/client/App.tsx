import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { SessionButton } from '@fogo/sessions-sdk-react'
import { WalletProvider } from './providers/WalletProvider'
import { AuthProvider } from './providers/AuthProvider'
import BotInfo from './pages/BotInfo'
import Logs from './pages/Logs'
import AddWallet from './pages/AddWallet'
import GameConfig from './pages/GameConfig'

function WalletStatus() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <SessionButton />
    </div>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <DashboardIcon /> },
    { path: '/logs', label: 'Logs', icon: <LogsIcon /> },
    { path: '/game', label: 'On-Chain', icon: <ChainIcon /> },
    { path: '/config', label: 'Configurar', icon: <ConfigIcon />, accent: true },
  ]

  return (
    <div className="app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="navbar">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="nav-left" style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px var(--accent-glow)',
              }}>
                <FishIcon />
              </div>
              <h1 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Fogo Fishing
              </h1>
            </div>

            {/* Navigation */}
            <ul style={{ display: 'flex', gap: '6px', margin: 0, padding: 0, listStyle: 'none' }}>
              {navItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <button
                      className={location.pathname === item.path ? 'active' : ''}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: item.accent && location.pathname !== item.path
                          ? 'linear-gradient(135deg, var(--purple) 0%, #8b5cf6 100%)'
                          : undefined,
                        boxShadow: item.accent && location.pathname !== item.path
                          ? '0 4px 12px var(--purple-glow)'
                          : undefined,
                        color: item.accent && location.pathname !== item.path ? 'white' : undefined,
                      }}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          <WalletStatus />
        </div>
      </nav>

      <main className="container" style={{ flex: 1, paddingTop: '32px', paddingBottom: '32px' }}>
        {children}
      </main>

      <footer className="footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span>Feito com</span>
          <span style={{ color: 'var(--danger)' }}>&#9829;</span>
          <span>usando Bun, Elysia e React</span>
        </div>
      </footer>
    </div>
  )
}

function App() {
  return (
    <WalletProvider>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<BotInfo />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/game" element={<GameConfig />} />
              <Route path="/config" element={<AddWallet />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </WalletProvider>
  )
}

export default App

// Icons
function FishIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6-3.56 0-7.56-2.54-8.5-6z"/>
      <path d="M18 12v.5"/>
      <path d="M16 17.93a9.77 9.77 0 0 1-3 .07"/>
      <path d="M8 6a7.5 7.5 0 0 0-4 4 7.5 7.5 0 0 0 4 4"/>
    </svg>
  )
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}

function LogsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10,9 9,9 8,9"/>
    </svg>
  )
}

function ChainIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  )
}

function ConfigIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
