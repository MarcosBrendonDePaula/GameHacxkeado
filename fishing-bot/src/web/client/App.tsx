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
    { path: '/game', label: 'On-Chain', icon: <ChainIcon /> },
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

      <main className="page-shell" style={{ flex: 1, paddingTop: '32px', paddingBottom: '32px' }}>
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

function ChainIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  )
}

