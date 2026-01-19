import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { getLogs } from '../lib/api'

interface Log {
  id: number
  level: 'success' | 'warn' | 'error' | 'info'
  message: string
  timestamp: Date
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
  const { isConnected } = useAuth()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLevel, setSelectedLevel] = useState<LogLevel>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const [logsPerPage, setLogsPerPage] = useState(50)
  const logViewerRef = useRef<HTMLDivElement>(null)

  const totalPages = Math.ceil(totalLogs / logsPerPage)

  const fetchLogs = useCallback(async (page: number, silent = false) => {
    if (!isConnected) {
      setLoading(false)
      return
    }

    if (!silent) setLoading(true)

    try {
      const offset = (page - 1) * logsPerPage
      const params: { limit: number; offset: number; level?: string } = {
        limit: logsPerPage,
        offset,
      }

      if (selectedLevel !== 'all') {
        params.level = selectedLevel
      }

      const data: LogsResponse = await getLogs(params)

      setLogs(data.logs || [])
      setTotalLogs(data.total || 0)
    } catch (error) {
      console.error('Erro ao buscar logs:', error)
    } finally {
      setLoading(false)
    }
  }, [isConnected, logsPerPage, selectedLevel])

  useEffect(() => {
    setCurrentPage(1)
    fetchLogs(1)
  }, [selectedLevel, logsPerPage])

  useEffect(() => {
    fetchLogs(currentPage)
  }, [currentPage, fetchLogs])

  useEffect(() => {
    if (currentPage === 1 && isConnected) {
      const interval = setInterval(() => {
        fetchLogs(1, true)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [selectedLevel, currentPage, logsPerPage, isConnected, fetchLogs])

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      if (logViewerRef.current) {
        logViewerRef.current.scrollTop = 0
      }
    }
  }

  const levelFilters = [
    { id: 'all' as LogLevel, label: 'Todos', icon: '', color: '#8b949e' },
    { id: 'success' as LogLevel, label: 'Success', icon: '', color: '#3fb950' },
    { id: 'warn' as LogLevel, label: 'Avisos', icon: '', color: '#d29922' },
    { id: 'error' as LogLevel, label: 'Erros', icon: '', color: '#f85149' },
    { id: 'info' as LogLevel, label: 'Info', icon: '', color: '#58a6ff' },
  ]

  const logsPerPageOptions = [25, 50, 100, 200]

  if (!isConnected) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h3>Conecte sua carteira</h3>
        <p style={{ color: '#888', marginTop: '1rem' }}>
          Use o botao "+ Carteira" no menu para conectar e ver os logs do seu bot.
        </p>
      </div>
    )
  }

  if (loading && logs.length === 0) {
    return <div className="loading">Carregando logs...</div>
  }

  return (
    <div>
      <h2>Logs do Bot</h2>

      {/* Layout: Sidebar + Content */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
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
              Filtrar por tipo
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
                Logs por pagina
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
                Total: <strong style={{ color: '#58a6ff' }}>{totalLogs}</strong>
              </div>
              {currentPage === 1 && (
                <div style={{ color: '#3fb950' }}>
                  Auto-refresh ativo
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
                Nenhum log disponivel para os filtros selecionados
              </p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={`log-line ${log.level}`}>
                  <span className="timestamp">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`level-badge ${log.level}`}>
                    {log.level.toUpperCase()}
                  </span>
                  {log.message}
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
                Anterior
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
                Proxima
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
            Pagina {currentPage} de {totalPages || 1} - Mostrando logs {((currentPage - 1) * logsPerPage) + 1}-{Math.min(currentPage * logsPerPage, totalLogs)} de {totalLogs}
          </div>
        </div>
      </div>

      <style>{`
        .log-viewer {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 15px;
          max-height: 500px;
          overflow-y: auto;
          font-family: monospace;
          font-size: 0.85rem;
        }
        .log-line {
          padding: 6px 10px;
          border-radius: 4px;
          margin-bottom: 4px;
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .log-line.success {
          background: rgba(63, 185, 80, 0.1);
          border-left: 3px solid #3fb950;
        }
        .log-line.warn {
          background: rgba(210, 153, 34, 0.1);
          border-left: 3px solid #d29922;
        }
        .log-line.error {
          background: rgba(248, 81, 73, 0.1);
          border-left: 3px solid #f85149;
        }
        .log-line.info {
          background: rgba(88, 166, 255, 0.1);
          border-left: 3px solid #58a6ff;
        }
        .timestamp {
          color: #8b949e;
          font-size: 0.8rem;
          min-width: 80px;
        }
        .level-badge {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: bold;
          min-width: 60px;
          text-align: center;
        }
        .level-badge.success {
          background: #3fb950;
          color: white;
        }
        .level-badge.warn {
          background: #d29922;
          color: white;
        }
        .level-badge.error {
          background: #f85149;
          color: white;
        }
        .level-badge.info {
          background: #58a6ff;
          color: white;
        }
      `}</style>
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
