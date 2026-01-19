import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { SessionButton, useSession, isEstablished } from '@fogo/sessions-sdk-react'
import { WalletProvider } from './providers/WalletProvider'
import { AuthProvider, useAuth } from './providers/AuthProvider'
import BotInfo from './pages/BotInfo'
import Logs from './pages/Logs'
import AddWallet from './pages/AddWallet'

function WalletStatus() {
  const sessionState = useSession()
  const { isConnected, walletPubkey } = useAuth()

  if (isConnected && walletPubkey) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: 'rgba(74, 222, 128, 0.1)',
          border: '1px solid #4ade80',
          borderRadius: '6px',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#4ade80',
            borderRadius: '50%',
          }} />
          <span style={{ color: '#4ade80', fontSize: '0.85rem' }}>
            {walletPubkey.slice(0, 4)}...{walletPubkey.slice(-4)}
          </span>
        </div>
        <button
          onClick={() => {
            indexedDB.deleteDatabase('sessionsdb')
            window.location.reload()
          }}
          style={{
            padding: '6px 12px',
            fontSize: '0.85rem',
            backgroundColor: '#dc2626',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Sair
        </button>
      </div>
    )
  }

  return <SessionButton />
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div className="app">
      <nav className="navbar">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Fogo Fishing Bot</h1>
            <ul style={{ display: 'flex', gap: '0.5rem', margin: 0, padding: 0, listStyle: 'none' }}>
              <li>
                <NavLink
                  to="/"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <button className={location.pathname === '/' ? 'active' : ''}>
                    Dashboard
                  </button>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/logs"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <button className={location.pathname === '/logs' ? 'active' : ''}>
                    Logs
                  </button>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/config"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <button className={location.pathname === '/config' ? 'active' : ''} style={{ backgroundColor: '#7c3aed' }}>
                    Configurar
                  </button>
                </NavLink>
              </li>
            </ul>
          </div>
          <WalletStatus />
        </div>
      </nav>

      <main className="container">
        {children}
      </main>

      <footer className="footer">
        <p>Feito com Bun, Elysia e React</p>
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
              <Route path="/config" element={<AddWallet />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </WalletProvider>
  )
}

export default App
