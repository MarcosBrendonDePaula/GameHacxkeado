import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { WalletProvider } from './providers/WalletProvider'
import Dashboard from './pages/Dashboard'
import Bots from './pages/Bots'
import Logs from './pages/Logs'
import BotInfo from './pages/BotInfo'
import BotManagement from './pages/BotManagement'
import AddWallet from './pages/AddWallet'

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div className="app">
      <nav className="navbar">
        <div className="container">
          <h1>🎣 Fogo Fishing Bot</h1>
          <ul>
            <li>
              <NavLink
                to="/"
                className={location.pathname === '/' ? 'active' : ''}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <button className={location.pathname === '/' ? 'active' : ''}>
                  Dashboard
                </button>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/bots"
                className={location.pathname.startsWith('/bots') ? 'active' : ''}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <button className={location.pathname.startsWith('/bots') ? 'active' : ''}>
                  Bots
                </button>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/management"
                className={location.pathname === '/management' ? 'active' : ''}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <button className={location.pathname === '/management' ? 'active' : ''}>
                  Gerenciar
                </button>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/logs"
                className={location.pathname === '/logs' ? 'active' : ''}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <button className={location.pathname === '/logs' ? 'active' : ''}>
                  Logs
                </button>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/add-wallet"
                className={location.pathname === '/add-wallet' ? 'active' : ''}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <button className={location.pathname === '/add-wallet' ? 'active' : ''} style={{ backgroundColor: '#7c3aed' }}>
                  + Carteira
                </button>
              </NavLink>
            </li>
          </ul>
        </div>
      </nav>

      <main className="container">
        {children}
      </main>

      <footer className="footer">
        <p>Feito com ❤️ usando Bun, Elysia e React</p>
      </footer>
    </div>
  )
}

function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bots" element={<Bots />} />
            <Route path="/bots/:id" element={<BotInfo />} />
            <Route path="/management" element={<BotManagement />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/add-wallet" element={<AddWallet />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </WalletProvider>
  )
}

export default App
