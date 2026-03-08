import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { getLogs } from '../lib/api'

interface Log {
  id: number
  level: 'success' | 'warn' | 'error' | 'info'
  category?: 'general' | 'websocket' | 'cast' | 'repair'
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
type LogCategory = 'all' | 'general' | 'websocket' | 'cast' | 'repair'

export default function Logs({ embedded = false }: { embedded?: boolean }) {
  const { isConnected } = useAuth()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLevel, setSelectedLevel] = useState<LogLevel>('all')
  const [selectedCategory, setSelectedCategory] = useState<LogCategory>('all')
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
      const params: { limit: number; offset: number; level?: string; category?: string } = {
        limit: logsPerPage,
        offset,
      }

      if (selectedLevel !== 'all') {
        params.level = selectedLevel
      }

      if (selectedCategory !== 'all') {
        params.category = selectedCategory
      }

      const data: LogsResponse = await getLogs(params)

      setLogs(data.logs || [])
      setTotalLogs(data.total || 0)
    } catch (error) {
      console.error('Erro ao buscar logs:', error)
    } finally {
      setLoading(false)
    }
  }, [isConnected, logsPerPage, selectedLevel, selectedCategory])

  useEffect(() => {
    setCurrentPage(1)
    fetchLogs(1)
  }, [selectedLevel, selectedCategory, logsPerPage])

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
    { id: 'all' as LogLevel, label: 'Todos', icon: <AllIcon />, color: 'var(--text-secondary)' },
    { id: 'success' as LogLevel, label: 'Success', icon: <CheckIcon />, color: 'var(--success)' },
    { id: 'warn' as LogLevel, label: 'Avisos', icon: <AlertIcon />, color: 'var(--warning)' },
    { id: 'error' as LogLevel, label: 'Erros', icon: <ErrorIcon />, color: 'var(--danger)' },
    { id: 'info' as LogLevel, label: 'Info', icon: <InfoIcon />, color: 'var(--accent)' },
  ]

  const logsPerPageOptions = [25, 50, 100, 200]

  const categoryFilters = [
    { id: 'all' as LogCategory, label: 'Todas', icon: '📋', color: 'var(--text-secondary)' },
    { id: 'websocket' as LogCategory, label: 'WebSocket', icon: '🌐', color: '#3b82f6' },
    { id: 'cast' as LogCategory, label: 'Casts', icon: '🎣', color: '#10b981' },
    { id: 'repair' as LogCategory, label: 'Reparos', icon: '🔧', color: '#f59e0b' },
    { id: 'general' as LogCategory, label: 'Geral', icon: '📝', color: 'var(--text-secondary)' },
  ]

  if (!isConnected && !embedded) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: 0.8 }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent)' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', fontWeight: 600 }}>Conecte sua Carteira</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
          Use o botao no canto superior direito para conectar sua wallet e ver os logs.
        </p>
      </div>
    )
  }

  if (loading && logs.length === 0) {
    return <div className="loading">Carregando logs...</div>
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header - only show if not embedded */}
      {!embedded && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <LogsHeaderIcon />
        <h2 style={{
          margin: 0,
          fontSize: '1.75rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Logs do Bot
        </h2>
      </div>
      )}

      {/* Layout: Sidebar + Content */}
      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Sidebar - Filtros de Nivel */}
        <div style={{ width: '220px', flexShrink: 0 }}>
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FilterIcon />
              Filtrar por tipo
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {levelFilters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedLevel(filter.id)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: selectedLevel === filter.id
                      ? `2px solid ${filter.color}`
                      : '1px solid var(--border)',
                    backgroundColor: selectedLevel === filter.id
                      ? `${filter.color}15`
                      : 'var(--bg-primary)',
                    color: selectedLevel === filter.id ? filter.color : 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontWeight: selectedLevel === filter.id ? 600 : 500,
                    transition: 'all 0.2s ease',
                    textAlign: 'left',
                    fontSize: '0.9rem',
                  }}
                >
                  <span style={{ color: filter.color, opacity: selectedLevel === filter.id ? 1 : 0.7 }}>
                    {filter.icon}
                  </span>
                  <span>{filter.label}</span>
                </button>
              ))}
            </div>

            {/* Filtros de Categoria */}
            <div style={{
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border)',
            }}>
              <h3 style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginBottom: '16px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FilterIcon />
                Filtrar por categoria
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {categoryFilters.map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedCategory(filter.id)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: selectedCategory === filter.id
                        ? `2px solid ${filter.color}`
                        : '1px solid var(--border)',
                      backgroundColor: selectedCategory === filter.id
                        ? `${filter.color}15`
                        : 'var(--bg-primary)',
                      color: selectedCategory === filter.id ? filter.color : 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontWeight: selectedCategory === filter.id ? 600 : 500,
                      transition: 'all 0.2s ease',
                      textAlign: 'left',
                      fontSize: '0.9rem',
                    }}
                  >
                    <span style={{ opacity: selectedCategory === filter.id ? 1 : 0.7 }}>
                      {filter.icon}
                    </span>
                    <span>{filter.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border)',
            }}>
              <label style={{
                display: 'block',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginBottom: '10px',
                fontWeight: 500,
              }}>
                Logs por pagina
              </label>
              <select
                value={logsPerPage}
                onChange={(e) => setLogsPerPage(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {logsPerPageOptions.map(num => (
                  <option key={num} value={num}>{num} logs</option>
                ))}
              </select>
            </div>

            {/* Stats box */}
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: 'linear-gradient(145deg, var(--bg-primary) 0%, rgba(0,0,0,0.2) 100%)',
              borderRadius: '10px',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px'
              }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total de logs</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>{totalLogs}</span>
              </div>
              {currentPage === 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: 'rgba(63, 185, 80, 0.1)',
                  borderRadius: '6px',
                  border: '1px solid rgba(63, 185, 80, 0.2)',
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    background: 'var(--success)',
                    borderRadius: '50%',
                    animation: 'pulse 2s ease infinite',
                  }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 500 }}>
                    Auto-refresh ativo
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content - Logs e Paginacao */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Logs */}
          <div
            ref={logViewerRef}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '8px',
              maxHeight: '550px',
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            {loading && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(10, 14, 20, 0.8)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                borderRadius: '16px',
              }}>
                <div className="loading" style={{ padding: '20px' }}>Carregando...</div>
              </div>
            )}

            {logs.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--text-secondary)'
              }}>
                <EmptyIcon />
                <p style={{ marginTop: '16px' }}>Nenhum log disponivel para os filtros selecionados</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {logs.map((log) => (
                  <LogLine key={log.id} log={log} />
                ))}
              </div>
            )}
          </div>

          {/* Paginacao */}
          {totalPages > 1 && (
            <div style={{
              marginTop: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
            }}>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                }}
              >
                <ChevronLeftIcon />
                Anterior
              </button>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                {currentPage > 3 && (
                  <>
                    <PageButton page={1} currentPage={currentPage} onClick={goToPage} />
                    {currentPage > 4 && <span style={{ color: 'var(--text-muted)', padding: '0 4px' }}>...</span>}
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
                    {currentPage < totalPages - 3 && <span style={{ color: 'var(--text-muted)', padding: '0 4px' }}>...</span>}
                    <PageButton page={totalPages} currentPage={currentPage} onClick={goToPage} />
                  </>
                )}
              </div>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                }}
              >
                Proxima
                <ChevronRightIcon />
              </button>
            </div>
          )}

          {/* Info Footer */}
          <div style={{
            marginTop: '16px',
            padding: '14px 20px',
            background: 'linear-gradient(145deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>Pagina</span>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{currentPage}</span>
            <span>de</span>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{totalPages || 1}</span>
            <span style={{ margin: '0 8px', color: 'var(--border)' }}>|</span>
            <span>Mostrando</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
              {((currentPage - 1) * logsPerPage) + 1}-{Math.min(currentPage * logsPerPage, totalLogs)}
            </span>
            <span>de</span>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{totalLogs}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LogLine({ log }: { log: Log }) {
  const levelColors = {
    success: { bg: 'rgba(63, 185, 80, 0.08)', border: 'var(--success)', badge: 'var(--success)' },
    warn: { bg: 'rgba(210, 153, 34, 0.08)', border: 'var(--warning)', badge: 'var(--warning)' },
    error: { bg: 'rgba(248, 81, 73, 0.08)', border: 'var(--danger)', badge: 'var(--danger)' },
    info: { bg: 'rgba(88, 166, 255, 0.08)', border: 'var(--accent)', badge: 'var(--accent)' },
  }

  const colors = levelColors[log.level]

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: '8px',
        borderLeft: `3px solid ${colors.border}`,
        background: colors.bg,
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        transition: 'all 0.15s ease',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: '0.85rem',
      }}
    >
      <span style={{
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
        minWidth: '75px',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {new Date(log.timestamp).toLocaleTimeString()}
      </span>
      <span style={{
        padding: '3px 8px',
        borderRadius: '4px',
        fontSize: '0.7rem',
        fontWeight: 700,
        minWidth: '60px',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        background: colors.badge,
        color: 'white',
      }}>
        {log.level}
      </span>
      <span style={{ color: 'var(--text-primary)', flex: 1 }}>
        {log.message}
      </span>
    </div>
  )
}

function PageButton({ page, currentPage, onClick }: { page: number; currentPage: number; onClick: (page: number) => void }) {
  const isActive = page === currentPage

  return (
    <button
      onClick={() => onClick(page)}
      style={{
        padding: '8px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        backgroundColor: isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
        color: isActive ? 'white' : 'var(--text-primary)',
        cursor: 'pointer',
        fontWeight: isActive ? 600 : 500,
        minWidth: '42px',
        transition: 'all 0.15s ease',
        boxShadow: isActive ? '0 4px 12px var(--accent-glow)' : 'none',
      }}
    >
      {page}
    </button>
  )
}

// Icons
function LogsHeaderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  )
}

function AllIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  )
}

function EmptyIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}
