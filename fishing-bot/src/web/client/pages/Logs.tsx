import { useEffect, useState, useRef } from 'react'

interface Log {
  timestamp: Date
  bot: string
  level: 'success' | 'warn' | 'error' | 'info'
  message: string
}

interface LogsResponse {
  logs: Log[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

type LogLevel = 'all' | 'success' | 'warn' | 'error' | 'info'

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBot, setSelectedBot] = useState<string>('all')
  const [selectedLevel, setSelectedLevel] = useState<LogLevel>('all')
  const [availableBots, setAvailableBots] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const [logsPerPage, setLogsPerPage] = useState(50)
  const logViewerRef = useRef<HTMLDivElement>(null)

  const totalPages = Math.ceil(totalLogs / logsPerPage)

  useEffect(() => {
    fetchBots()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
    fetchLogs(1)
  }, [selectedBot, selectedLevel, logsPerPage])

  useEffect(() => {
    fetchLogs(currentPage)
  }, [currentPage])

  useEffect(() => {
    if (currentPage === 1) {
      const interval = setInterval(() => {
        fetchLogs(1, true)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [selectedBot, selectedLevel, currentPage, logsPerPage])

  async function fetchBots() {
    try {
      const res = await fetch('/api/logs/bots')
      const data = await res.json()
      setAvailableBots(data.bots)
    } catch (error) {
      console.error('Erro ao buscar bots:', error)
    }
  }

  async function fetchLogs(page: number, silent = false) {
    if (!silent) setLoading(true)

    try {
      const offset = (page - 1) * logsPerPage
      const params = new URLSearchParams({
        limit: String(logsPerPage),
        offset: String(offset),
      })

      if (selectedBot !== 'all') {
        params.append('bot', selectedBot)
      }

      if (selectedLevel !== 'all') {
        params.append('level', selectedLevel)
      }

      const res = await fetch(`/api/logs?${params}`)
      const data: LogsResponse = await res.json()

      setLogs(data.logs)
      setTotalLogs(data.total)
    } catch (error) {
      console.error('Erro ao buscar logs:', error)
    } finally {
      setLoading(false)
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      if (logViewerRef.current) {
        logViewerRef.current.scrollTop = 0
      }
    }
  }

  const levelFilters = [
    { id: 'all' as LogLevel, label: 'Todos', icon: '📋', color: '#8b949e' },
    { id: 'success' as LogLevel, label: 'Success', icon: '✅', color: '#3fb950' },
    { id: 'warn' as LogLevel, label: 'Avisos', icon: '⚠️', color: '#d29922' },
    { id: 'error' as LogLevel, label: 'Erros', icon: '❌', color: '#f85149' },
    { id: 'info' as LogLevel, label: 'Info', icon: 'ℹ️', color: '#58a6ff' },
  ]

  const logsPerPageOptions = [25, 50, 100, 200]

  if (loading && logs.length === 0) {
    return <div className="loading">Carregando logs...</div>
  }

  return (
    <div>
      <h2>📝 Logs em Tempo Real</h2>

      {/* Tabs por Bot (Horizontal) */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '20px',
        marginBottom: '20px',
        overflowX: 'auto',
        paddingBottom: '10px',
        borderBottom: '2px solid #30363d',
      }}>
        <button
          onClick={() => setSelectedBot('all')}
          style={{
            padding: '10px 20px',
            borderRadius: '6px 6px 0 0',
            border: 'none',
            backgroundColor: selectedBot === 'all' ? '#21262d' : 'transparent',
            color: selectedBot === 'all' ? '#58a6ff' : '#8b949e',
            cursor: 'pointer',
            fontWeight: selectedBot === 'all' ? 'bold' : 'normal',
            borderBottom: selectedBot === 'all' ? '3px solid #58a6ff' : 'none',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
          }}
        >
          🤖 Todos os Bots
        </button>

        {availableBots.map(bot => (
          <button
            key={bot}
            onClick={() => setSelectedBot(bot)}
            style={{
              padding: '10px 20px',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              backgroundColor: selectedBot === bot ? '#21262d' : 'transparent',
              color: selectedBot === bot ? '#58a6ff' : '#8b949e',
              cursor: 'pointer',
              fontWeight: selectedBot === bot ? 'bold' : 'normal',
              borderBottom: selectedBot === bot ? '3px solid #58a6ff' : 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {bot}
          </button>
        ))}
      </div>

      {/* Layout: Sidebar + Content */}
      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Sidebar - Filtros de Nível */}
        <div style={{
          width: '200px',
          flexShrink: 0,
        }}>
          <div style={{
            backgroundColor: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '8px',
            padding: '15px',
          }}>
            <h3 style={{ fontSize: '0.9rem', color: '#8b949e', marginBottom: '12px' }}>
              🔍 Filtrar por tipo
            </h3>

            {levelFilters.map(filter => (
              <button
                key={filter.id}
                onClick={() => setSelectedLevel(filter.id)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  marginBottom: '6px',
                  borderRadius: '6px',
                  border: selectedLevel === filter.id ? `2px solid ${filter.color}` : '1px solid #30363d',
                  backgroundColor: selectedLevel === filter.id ? 'rgba(88, 166, 255, 0.1)' : '#0d1117',
                  color: selectedLevel === filter.id ? filter.color : '#c9d1d9',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: selectedLevel === filter.id ? 'bold' : 'normal',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{filter.icon}</span>
                <span>{filter.label}</span>
              </button>
            ))}

            <div style={{
              marginTop: '20px',
              paddingTop: '15px',
              borderTop: '1px solid #30363d',
            }}>
              <label style={{
                display: 'block',
                fontSize: '0.85rem',
                color: '#8b949e',
                marginBottom: '8px',
              }}>
                📄 Logs por página
              </label>
              <select
                value={logsPerPage}
                onChange={(e) => setLogsPerPage(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #30363d',
                  backgroundColor: '#0d1117',
                  color: '#c9d1d9',
                  cursor: 'pointer',
                }}
              >
                {logsPerPageOptions.map(num => (
                  <option key={num} value={num}>{num} logs</option>
                ))}
              </select>
            </div>

            <div style={{
              marginTop: '15px',
              padding: '10px',
              backgroundColor: '#0d1117',
              borderRadius: '6px',
              fontSize: '0.85rem',
              color: '#8b949e',
            }}>
              <div style={{ marginBottom: '5px' }}>
                📊 Total: <strong style={{ color: '#58a6ff' }}>{totalLogs}</strong>
              </div>
              {currentPage === 1 && (
                <div style={{ color: '#3fb950' }}>
                  🔄 Auto-refresh
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content - Logs e Paginação */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Logs */}
          <div ref={logViewerRef} className="log-viewer" style={{ position: 'relative' }}>
            {loading && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(13, 17, 23, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              }}>
                <span style={{ color: '#8b949e' }}>Carregando...</span>
              </div>
            )}

            {logs.length === 0 ? (
              <p style={{ color: '#8b949e', textAlign: 'center', padding: '40px' }}>
                Nenhum log disponível para os filtros selecionados
              </p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`log-line ${log.level}`}>
                  <span className="timestamp">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="bot">{log.bot}</span> {log.message}
                </div>
              ))
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{
              marginTop: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
            }}>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #30363d',
                  backgroundColor: currentPage === 1 ? '#161b22' : '#21262d',
                  color: currentPage === 1 ? '#484f58' : '#c9d1d9',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ← Anterior
              </button>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                {currentPage > 3 && (
                  <>
                    <PageButton page={1} currentPage={currentPage} onClick={goToPage} />
                    {currentPage > 4 && <span style={{ color: '#484f58' }}>...</span>}
                  </>
                )}

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === currentPage ||
                           page === currentPage - 1 ||
                           page === currentPage + 1 ||
                           page === currentPage - 2 ||
                           page === currentPage + 2
                  })
                  .map(page => (
                    <PageButton key={page} page={page} currentPage={currentPage} onClick={goToPage} />
                  ))
                }

                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span style={{ color: '#484f58' }}>...</span>}
                    <PageButton page={totalPages} currentPage={currentPage} onClick={goToPage} />
                  </>
                )}
              </div>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #30363d',
                  backgroundColor: currentPage === totalPages ? '#161b22' : '#21262d',
                  color: currentPage === totalPages ? '#484f58' : '#c9d1d9',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Próxima →
              </button>
            </div>
          )}

          {/* Info Footer */}
          <div style={{
            marginTop: '15px',
            padding: '12px',
            backgroundColor: '#161b22',
            borderRadius: '6px',
            border: '1px solid #30363d',
            fontSize: '0.85rem',
            color: '#8b949e',
            textAlign: 'center',
          }}>
            Página {currentPage} de {totalPages} · Mostrando logs {((currentPage - 1) * logsPerPage) + 1}-{Math.min(currentPage * logsPerPage, totalLogs)} de {totalLogs}
          </div>
        </div>
      </div>
    </div>
  )
}

function PageButton({ page, currentPage, onClick }: { page: number; currentPage: number; onClick: (page: number) => void }) {
  const isActive = page === currentPage

  return (
    <button
      onClick={() => onClick(page)}
      style={{
        padding: '6px 12px',
        borderRadius: '6px',
        border: '1px solid #30363d',
        backgroundColor: isActive ? '#58a6ff' : '#21262d',
        color: isActive ? 'white' : '#c9d1d9',
        cursor: 'pointer',
        fontWeight: isActive ? 'bold' : 'normal',
        minWidth: '40px',
      }}
    >
      {page}
    </button>
  )
}
