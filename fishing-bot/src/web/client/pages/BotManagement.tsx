import { useEffect, useState } from 'react'

interface BotConfig {
  name: string
  enabled: boolean
  keypair_path?: string
  keypair?: string
  proxy?: string
  delay?: number
}

export default function BotManagement() {
  const [bots, setBots] = useState<BotConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [keypairMode, setKeypairMode] = useState<'path' | 'direct'>('path')
  const [formData, setFormData] = useState<BotConfig>({
    name: '',
    enabled: true,
    keypair_path: '',
    keypair: '',
    proxy: '',
    delay: 1000,
  })

  useEffect(() => {
    fetchBots()
  }, [])

  async function fetchBots() {
    try {
      const res = await fetch('/api/bot-configs')
      const data = await res.json()
      setBots(data.bots || [])
    } catch (error) {
      console.error('Erro ao buscar configurações:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      const res = await fetch('/api/bot-configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bots }),
      })

      if (res.ok) {
        alert('Configurações salvas com sucesso!')
        setEditingIndex(null)
        setShowAddForm(false)
        // Recarrega para aplicar mudanças
        window.location.reload()
      }
    } catch (error) {
      console.error('Erro ao salvar:', error)
      alert('Erro ao salvar configurações')
    }
  }

  function handleEdit(index: number) {
    setEditingIndex(index)
    const bot = bots[index]
    setFormData({ ...bot })
    // Detecta qual modo usar baseado nos dados
    if (bot.keypair) {
      setKeypairMode('direct')
    } else {
      setKeypairMode('path')
    }
  }

  function handleDelete(index: number) {
    if (confirm(`Tem certeza que deseja deletar o bot "${bots[index].name}"?`)) {
      const newBots = [...bots]
      newBots.splice(index, 1)
      setBots(newBots)
    }
  }

  function handleAddNew() {
    setShowAddForm(true)
    setKeypairMode('path')
    setFormData({
      name: '',
      enabled: true,
      keypair_path: '',
      keypair: '',
      proxy: '',
      delay: 1000,
    })
  }

  async function handleSaveBot() {
    if (!formData.name) {
      alert('Nome é obrigatório!')
      return
    }

    if (keypairMode === 'path' && !formData.keypair_path) {
      alert('Caminho do keypair é obrigatório!')
      return
    }

    if (keypairMode === 'direct' && !formData.keypair) {
      alert('Keypair é obrigatório!')
      return
    }

    // Valida JSON do keypair se for modo direto
    if (keypairMode === 'direct') {
      try {
        const parsed = JSON.parse(formData.keypair || '')
        if (!Array.isArray(parsed) || parsed.length !== 64) {
          alert('Keypair inválido! Deve ser um array JSON com 64 números.')
          return
        }
      } catch (error) {
        alert('Keypair inválido! Deve ser um JSON válido.')
        return
      }
    }

    // Prepara dados para salvar, removendo campos vazios
    const botData: BotConfig = {
      name: formData.name,
      enabled: formData.enabled,
      proxy: formData.proxy,
      delay: formData.delay,
    }

    if (keypairMode === 'path') {
      botData.keypair_path = formData.keypair_path
    } else {
      botData.keypair = formData.keypair
    }

    let newBots: BotConfig[]
    if (editingIndex !== null) {
      // Editando bot existente
      newBots = [...bots]
      newBots[editingIndex] = botData
    } else {
      // Adicionando novo bot
      newBots = [...bots, botData]
    }

    // Salva automaticamente no servidor
    try {
      const res = await fetch('/api/bot-configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bots: newBots }),
      })

      if (res.ok) {
        alert('Bot salvo com sucesso! A página será recarregada.')
        window.location.reload()
      } else {
        alert('Erro ao salvar bot')
      }
    } catch (error) {
      console.error('Erro ao salvar:', error)
      alert('Erro ao salvar bot')
    }
  }

  function handleCancel() {
    setEditingIndex(null)
    setShowAddForm(false)
    setKeypairMode('path')
    setFormData({
      name: '',
      enabled: true,
      keypair_path: '',
      keypair: '',
      proxy: '',
      delay: 1000,
    })
  }

  if (loading) {
    return <div className="loading">Carregando configurações...</div>
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
      }}>
        <h2>⚙️ Gerenciamento de Bots</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleAddNew}
            disabled={showAddForm || editingIndex !== null}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: showAddForm || editingIndex !== null ? '#6e7681' : '#3fb950',
              color: 'white',
              cursor: showAddForm || editingIndex !== null ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
            }}
          >
            ➕ Adicionar Bot
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#58a6ff',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            💾 Salvar Todas as Alterações
          </button>
        </div>
      </div>

      {/* Formulário de Adição/Edição */}
      {(showAddForm || editingIndex !== null) && (
        <div style={{
          backgroundColor: '#161b22',
          border: '2px solid #58a6ff',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <h3 style={{ marginBottom: '20px', color: '#58a6ff' }}>
            {editingIndex !== null ? '✏️ Editar Bot' : '➕ Adicionar Novo Bot'}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Nome do Bot */}
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#8b949e', fontSize: '0.9rem' }}>
                Nome do Bot *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Bot Principal"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #30363d',
                  backgroundColor: '#0d1117',
                  color: '#c9d1d9',
                }}
              />
            </div>

            {/* Toggle de modo Keypair */}
            <div>
              <label style={{ display: 'block', marginBottom: '10px', color: '#8b949e', fontSize: '0.9rem' }}>
                Modo de Keypair *
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setKeypairMode('path')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: keypairMode === 'path' ? '2px solid #58a6ff' : '1px solid #30363d',
                    backgroundColor: keypairMode === 'path' ? '#1c2128' : '#0d1117',
                    color: keypairMode === 'path' ? '#58a6ff' : '#8b949e',
                    cursor: 'pointer',
                    fontWeight: keypairMode === 'path' ? 'bold' : 'normal',
                  }}
                >
                  📁 Caminho do Arquivo
                </button>
                <button
                  type="button"
                  onClick={() => setKeypairMode('direct')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: keypairMode === 'direct' ? '2px solid #58a6ff' : '1px solid #30363d',
                    backgroundColor: keypairMode === 'direct' ? '#1c2128' : '#0d1117',
                    color: keypairMode === 'direct' ? '#58a6ff' : '#8b949e',
                    cursor: 'pointer',
                    fontWeight: keypairMode === 'direct' ? 'bold' : 'normal',
                  }}
                >
                  🔑 Keypair Direto
                </button>
              </div>
            </div>

            {/* Campo condicional baseado no modo */}
            {keypairMode === 'path' ? (
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#8b949e', fontSize: '0.9rem' }}>
                  Caminho do Keypair *
                </label>
                <input
                  type="text"
                  value={formData.keypair_path || ''}
                  onChange={(e) => setFormData({ ...formData, keypair_path: e.target.value })}
                  placeholder="Ex: keypairs/wallet.json ou ./keypair.json"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #30363d',
                    backgroundColor: '#0d1117',
                    color: '#c9d1d9',
                  }}
                />
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#8b949e', fontSize: '0.9rem' }}>
                  Keypair (Array JSON com 64 números) *
                </label>
                <textarea
                  value={formData.keypair || ''}
                  onChange={(e) => setFormData({ ...formData, keypair: e.target.value })}
                  placeholder='[123,45,67,89,...]'
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #30363d',
                    backgroundColor: '#0d1117',
                    color: '#c9d1d9',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: '#6e7681', marginTop: '5px' }}>
                  Cole o conteúdo do arquivo keypair.json (deve ser um array com 64 números)
                </div>
              </div>
            )}

            {/* Grid para Proxy e Delay */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#8b949e', fontSize: '0.9rem' }}>
                  Proxy (opcional)
                </label>
                <input
                  type="text"
                  value={formData.proxy || ''}
                  onChange={(e) => setFormData({ ...formData, proxy: e.target.value })}
                  placeholder="Ex: socks5://user:pass@host:port"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #30363d',
                    backgroundColor: '#0d1117',
                    color: '#c9d1d9',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#8b949e', fontSize: '0.9rem' }}>
                  Delay (ms)
                </label>
                <input
                  type="number"
                  value={formData.delay || 1000}
                  onChange={(e) => setFormData({ ...formData, delay: parseInt(e.target.value) })}
                  min="500"
                  max="10000"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #30363d',
                    backgroundColor: '#0d1117',
                    color: '#c9d1d9',
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '15px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                color: '#c9d1d9',
              }}>
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                Bot habilitado
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={handleSaveBot}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#3fb950',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ✅ Confirmar
              </button>
              <button
                onClick={handleCancel}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid #30363d',
                  backgroundColor: '#21262d',
                  color: '#c9d1d9',
                  cursor: 'pointer',
                }}
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Bots */}
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '20px',
      }}>
        <h3 style={{ marginBottom: '20px', color: '#8b949e' }}>
          Bots Cadastrados ({bots.length})
        </h3>

        {bots.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#8b949e',
          }}>
            <p>Nenhum bot cadastrado ainda.</p>
            <p style={{ fontSize: '0.9rem' }}>Clique em "Adicionar Bot" para começar.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {bots.map((bot, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#0d1117',
                  border: `1px solid ${bot.enabled ? '#3fb950' : '#6e7681'}`,
                  borderRadius: '6px',
                  padding: '15px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '8px',
                  }}>
                    <span style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: bot.enabled ? '#3fb950' : '#6e7681',
                    }} />
                    <strong style={{ fontSize: '1.1rem' }}>{bot.name}</strong>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      backgroundColor: bot.enabled ? 'rgba(63, 185, 80, 0.2)' : 'rgba(110, 118, 129, 0.2)',
                      color: bot.enabled ? '#3fb950' : '#6e7681',
                    }}>
                      {bot.enabled ? 'Habilitado' : 'Desabilitado'}
                    </span>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '10px',
                    fontSize: '0.85rem',
                    color: '#8b949e',
                  }}>
                    <div>
                      <strong>Keypair:</strong> {bot.keypair ? '🔑 Direto (inline)' : `📁 ${bot.keypair_path}`}
                    </div>
                    <div>
                      <strong>Proxy:</strong> {bot.proxy || 'Nenhum'}
                    </div>
                    <div>
                      <strong>Delay:</strong> {bot.delay || 1000}ms
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleEdit(index)}
                    disabled={showAddForm || (editingIndex !== null && editingIndex !== index)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: showAddForm || (editingIndex !== null && editingIndex !== index) ? '#6e7681' : '#58a6ff',
                      color: 'white',
                      cursor: showAddForm || (editingIndex !== null && editingIndex !== index) ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                    }}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    disabled={showAddForm || editingIndex !== null}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: showAddForm || editingIndex !== null ? '#6e7681' : '#f85149',
                      color: 'white',
                      cursor: showAddForm || editingIndex !== null ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                    }}
                  >
                    🗑️ Deletar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#161b22',
        border: '1px solid #d29922',
        borderRadius: '6px',
        color: '#8b949e',
        fontSize: '0.85rem',
      }}>
        <strong style={{ color: '#d29922' }}>⚠️ Aviso:</strong> Após salvar as alterações, a página será recarregada para aplicar as mudanças. Todos os bots serão reiniciados.
      </div>
    </div>
  )
}
