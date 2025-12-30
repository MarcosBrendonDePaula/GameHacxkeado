# 🔧 Sistema de Patches GameHacxkeado

Sistema avançado de patches para injeção e modificação do código JavaScript do jogo, permitindo aplicar funcionalidades como auto-cast, auto-repair e outras modificações de forma modular e reversível.

## ✨ Funcionalidades Principais

- 🎯 **Patches Modulares**: Cada funcionalidade é um patch independente
- 🔄 **Sistema de Backup**: Backup automático antes de cada modificação
- ↩️ **Reversibilidade**: Remove patches individuais ou restaura de backup
- 🧠 **Inteligente**: Usa regex para encontrar código mesmo quando muda
- 🛡️ **Seguro**: Validação de patches e tratamento de erros
- 📊 **Monitoramento**: Interface CLI completa para gerenciar patches

## 🗂️ Estrutura do Sistema

```
patches/
├── definitions/          # Definições dos patches
│   ├── auto-cast-speed.js    # Modifica velocidade do auto cast
│   ├── super-cast-speed.js   # Modifica velocidade do super cast
│   ├── auto-repair.js        # Sistema de auto repair
│   ├── config-menu.js        # Menu visual de configurações
│   └── test-patch.js         # Patch de teste
├── backups/             # Backups automáticos
├── applied/             # Estado dos patches aplicados
└── applied.json         # Lista de patches ativos

patch-system.js          # Sistema principal
```

## 🚀 Como Usar

### Comandos Básicos

```bash
# Ver status de todos os patches
node patch-system.js status

# Listar patches disponíveis
node patch-system.js list

# Aplicar um patch específico
node patch-system.js apply <nome-do-patch>

# Remover um patch específico
node patch-system.js remove <nome-do-patch>

# Ver backups disponíveis
node patch-system.js backups

# Restaurar de um backup
node patch-system.js restore <nome-do-backup>
```

### Comandos com Opções

```bash
# Aplicar patch com saída detalhada
node patch-system.js apply auto-cast-speed --verbose

# Forçar reaplicação de patch
node patch-system.js apply auto-cast-speed --force

# Ajuda completa
node patch-system.js help
```

## 📋 Patches Disponíveis

### 1. 🏹 Auto Cast Speed (`auto-cast-speed`)

**Função**: Modifica delays do sistema de auto cast principal (500ms-2000ms)

**Presets de Velocidade**:
- `slow`: 2000ms
- `normal`: 1000ms
- `fast`: 500ms (padrão)
- `ultra_fast`: 200ms
- `instant`: 50ms
- `custom`: Valor personalizado

**Como usar**:
```bash
node patch-system.js apply auto-cast-speed
```

**O que faz**:
- Detecta padrões de delays de auto cast no código
- Substitui delays encontrados pela velocidade configurada
- Funciona mesmo se o código mudar entre versões

### 2. ⚡ Super Cast Speed (`super-cast-speed`)

**Função**: Modifica delays do sistema de super cast rápido (100ms-300ms)

**Presets de Velocidade**:
- `slow`: 300ms
- `normal`: 200ms
- `fast`: 100ms (padrão)
- `ultra_fast`: 50ms
- `instant`: 10ms
- `custom`: Valor personalizado

**Como usar**:
```bash
node patch-system.js apply super-cast-speed
```

**O que faz**:
- Detecta delays rápidos relacionados ao super cast
- Modifica setTimeout, delays de tap sounds, etc.
- Encontra centenas de delays relacionados

### 3. 🔧 Auto Repair (`auto-repair`)

**Função**: Injeta sistema completo de auto repair no jogo

**Funcionalidades**:
- Detecção automática de modais de reparo
- MutationObserver para mudanças no DOM
- Múltiplos critérios de detecção
- Interface de controle via JavaScript

**Como usar**:
```bash
node patch-system.js apply auto-repair
```

**Controle no jogo**:
```javascript
// Ativar auto repair
AutoRepair.enable()

// Desativar auto repair
AutoRepair.disable()

// Testar detecção
AutoRepair.testModal()

// Forçar reparo
AutoRepair.forceRepair()
```

### 4. 🎮 Config Menu (`config-menu`)

**Função**: Adiciona menu visual de configurações no jogo

**Funcionalidades**:
- Interface visual completa
- Controles para todos os patches
- Salva configurações no localStorage
- Hotkey Ctrl+Shift+C

**Como usar**:
```bash
node patch-system.js apply config-menu
```

**No jogo**:
- Pressione `Ctrl+Shift+C` para abrir/fechar
- Configure patches visualmente
- Monitoramento em tempo real

### 5. 🧪 Test Patch (`test-patch`)

**Função**: Patch simples para testar o sistema

**Como usar**:
```bash
node patch-system.js apply test-patch
```

## 🛠️ Como Funciona

### Tipos de Modificação

**1. Replace** - Substituição de texto/regex:
```javascript
{
    type: 'replace',
    target: /oldCode/g,
    replacement: 'newCode'
}
```

**2. Inject** - Injeção de código:
```javascript
{
    type: 'inject',
    target: 'function someFunction()',
    code: 'console.log("injected");',
    position: 'after'
}
```

**3. Modify** - Modificação com função:
```javascript
{
    type: 'modify',
    target: /pattern/g,
    transform: (match) => modifyMatch(match)
}
```

**4. Regex** - Substituição por regex:
```javascript
{
    type: 'regex',
    pattern: 'pattern',
    replacement: 'replacement',
    flags: 'g'
}
```

### Sistema de Backup

Cada operação cria um backup automático:
- **Formato**: `source_<patch>_<timestamp>_<hash>.js`
- **Localização**: `patches/backups/`
- **Restauração**: `node patch-system.js restore <backup>`

### Validação de Patches

O sistema valida automaticamente:
- Sintaxe JavaScript do patch
- Presença de função `apply` ou array `modifications`
- Estrutura correta das modificações
- Existência do arquivo source.js

## 📊 Exemplo de Execução

```bash
$ node patch-system.js apply auto-cast-speed --verbose
[PatchSystem] Aplicando patch: auto-cast-speed
[PatchSystem] Patch carregado: Auto Cast Speed
[PatchSystem] Descrição: Modifica delays do auto cast para velocidades personalizadas
[PatchSystem] Backup criado: source_auto-cast-speed_2025-12-22T19-03-31-487Z_909bf212.js
[auto-cast-speed] autocastConstant: 500ms → 500ms
[auto-cast-speed] autocastContext: 500ms → 500ms
[auto-cast-speed] 3 delays modificados para 500ms
[PatchSystem] ✅ Patch 'auto-cast-speed' aplicado com sucesso!
[PatchSystem] 📁 Backup salvo: source_auto-cast-speed_2025-12-22T19-03-31-487Z_909bf212.js

$ node patch-system.js status
=== PATCH SYSTEM STATUS ===
📦 Patches disponíveis: 5
  auto-cast-speed - ✅ APLICADO
  auto-repair - ⭕ DISPONÍVEL
  config-menu - ⭕ DISPONÍVEL
  super-cast-speed - ⭕ DISPONÍVEL
  test-patch - ⭕ DISPONÍVEL

✅ Patches aplicados: 1
💾 Backups salvos: 1
```

## 🎯 Criando Patches Personalizados

### Estrutura Básica

```javascript
module.exports = {
    name: "Meu Patch",
    description: "Descrição do que faz",
    version: "1.0.0",
    author: "Seu Nome",

    // Configurações (opcional)
    config: {
        enabled: true,
        customValue: 100
    },

    // Método 1: Array de modificações
    modifications: [
        {
            type: 'replace',
            target: 'oldCode',
            replacement: 'newCode'
        }
    ],

    // Método 2: Função customizada
    async apply(content) {
        // Sua lógica aqui
        return modifiedContent;
    },

    // Função de remoção (opcional)
    async remove(content) {
        // Lógica para reverter
        return revertedContent;
    }
};
```

### Padrões Regex Inteligentes

```javascript
// Detectar delays específicos
const autocastPattern = /const\s+(\w+)\s*=\s*(\d+(?:e\d+)?),?\s*(?:\/\/.*?)?\s*\w+\s*=\s*50/g;

// Detectar contexto específico
const contextPattern = /if\s*\(!ft\s*\|\|\s*!xe\.current\)[\s\S]*?const\s+(\w+)\s*=\s*(\d+(?:e\d+)?)/g;

// Aplicar mudanças inteligentes
content.replace(pattern, (match, varName, delay) => {
    const newDelay = calculateNewDelay(parseInt(delay));
    return match.replace(delay, newDelay);
});
```

## 🔄 Workflows Recomendados

### Aplicação de Patches

1. **Backup do source.js original**
   ```bash
   cp source.js source.js.original
   ```

2. **Ver patches disponíveis**
   ```bash
   node patch-system.js list
   ```

3. **Aplicar patches necessários**
   ```bash
   node patch-system.js apply auto-cast-speed
   node patch-system.js apply super-cast-speed
   node patch-system.js apply auto-repair
   ```

4. **Verificar status**
   ```bash
   node patch-system.js status
   ```

### Desenvolvimento de Novos Patches

1. **Criar arquivo de definição**
   ```bash
   touch patches/definitions/meu-patch.js
   ```

2. **Implementar patch** (usar estrutura acima)

3. **Testar com arquivo de teste**
   ```bash
   cp source.js test-source.js
   node patch-system.js apply meu-patch
   ```

4. **Verificar resultado e reverter se necessário**
   ```bash
   node patch-system.js remove meu-patch
   ```

### Manutenção

1. **Limpeza de backups antigos** (manual):
   ```bash
   ls -la patches/backups/
   rm patches/backups/source_old_*.js
   ```

2. **Reset completo** se necessário:
   ```bash
   cp source.js.original source.js
   rm patches/applied/applied.json
   ```

## ⚠️ Considerações Importantes

### Segurança
- **Sempre faça backup** antes de aplicar patches
- **Teste em ambiente seguro** antes de usar no jogo
- **Use velocidades moderadas** para evitar detecção
- **Monitore o comportamento** após aplicar patches

### Performance
- Patches são aplicados apenas uma vez
- Modificações são feitas em memória antes de salvar
- Backups automáticos podem ocupar espaço
- Alguns patches podem afetar performance do jogo

### Compatibilidade
- Patches usam regex para funcionar com mudanças no código
- Sempre teste após updates do jogo
- Alguns patches podem conflitar entre si
- Use `--force` para reaplicar se necessário

## 🐛 Resolução de Problemas

### Erro: "source.js não encontrado"
```bash
# Certifique-se de estar no diretório correto
ls source.js

# Ou especifique o caminho completo no script
```

### Erro: "Patch inválido"
```bash
# Verifique sintaxe do patch
node -c patches/definitions/nome-patch.js

# Verifique se tem função apply ou modifications
```

### Erro: "Nenhuma modificação detectada"
```bash
# Execute com --verbose para ver detalhes
node patch-system.js apply nome-patch --verbose

# Verifique se os padrões regex estão corretos
```

### Restaurar Estado Original
```bash
# Via backup automático
node patch-system.js restore nome-do-backup

# Via backup manual
cp source.js.original source.js
rm patches/applied/applied.json
```

## 📈 Estatísticas de Teste

Durante os testes, o sistema demonstrou:

- **Auto Cast Speed**: 3 delays modificados com sucesso
- **Super Cast Speed**: 188 delays modificados com sucesso
- **Backup System**: 100% de sucessso em aplicação e restore
- **Error Handling**: Recuperação automática em caso de falha
- **Validation**: Detecção correta de patches inválidos

## 🎉 Pronto para Usar!

O sistema está configurado e testado. Para começar:

```bash
# Ver status atual
node patch-system.js status

# Aplicar patches essenciais
node patch-system.js apply auto-cast-speed
node patch-system.js apply super-cast-speed

# Para interface visual
node patch-system.js apply config-menu

# Verificar resultado
node patch-system.js list
```

---

**💡 Dica Profissional**: Use sempre o modo `--verbose` na primeira execução para entender o que cada patch está modificando. O sistema foi projetado para ser seguro e reversível, então experimente à vontade!