# 🎯 Sistema de Patches Simplificado

Sistema modular de patches para GameHacxkeado com apenas 2 patches essenciais e sistema de configuração dinâmico.

## ✨ Patches Disponíveis

### 1. 🔧 Config System
**Arquivo:** `patches/definitions/config-system.js`
**Descrição:** Sistema central de configurações dinâmicas

#### Funcionalidades:
- ✅ API global `window.__cfg()` para gerenciar configurações
- ✅ Persistência automática no localStorage
- ✅ Configurações com valores padrão automáticos
- ✅ Interface simples para criar/alterar/remover configs

#### Como Usar:
```javascript
// Criar/obter configuração com valor padrão
window.__cfg('minha_config', 123);

// Alterar valor
window.__cfg.set('minha_config', 456);

// Obter valor atual
const valor = window.__cfg('minha_config');

// Listar todas as configurações
window.__cfg.list();

// Remover configuração
window.__cfg.remove('minha_config');

// Limpar todas
window.__cfg.clear();
```

### 2. ⚡ Auto Cast Speed
**Arquivo:** `patches/definitions/auto-cast-speed.js`
**Descrição:** Modifica delays do auto cast usando sistema de configuração dinâmico

#### Funcionalidades:
- ✅ Delay configurável dinamicamente via `window.__cfg`
- ✅ Configuração padrão: 500ms
- ✅ Mudanças aplicadas em tempo real
- ✅ Integração completa com Config System

#### Como Usar:
```javascript
// Alterar velocidade do auto cast (em millisegundos)
window.__cfg.set('autocast_delay', 200);  // Rápido
window.__cfg.set('autocast_delay', 500);  // Normal
window.__cfg.set('autocast_delay', 1000); // Lento

// Ver delay atual
window.__cfg('autocast_delay');
```

## 🚀 Quick Start

### 1. Aplicar Patches Essenciais
```bash
# Aplicar sistema de configuração primeiro
node patch-system.js apply config-system

# Depois aplicar auto cast speed
node patch-system.js apply auto-cast-speed

# Ou aplicar tudo de uma vez
./scripts/apply-all.sh
```

### 2. Usar no Jogo
```javascript
// No console do jogo:

// Ver configurações atuais
window.__cfg.list();

// Configurar velocidade do auto cast
window.__cfg.set('autocast_delay', 300); // 300ms = rápido

// Ver qual delay está sendo usado
console.log('Delay atual:', window.__cfg('autocast_delay'));
```

## 🔧 Desenvolvimento de Novos Patches

### Template Básico:
```javascript
module.exports = {
    name: "Meu Patch",
    description: "Descrição do patch",
    version: "1.0.0",

    apply: (sourceCode) => {
        console.log('Aplicando meu patch...');

        // Usar sistema de configuração
        const configCode = `
        // Configurações padrão
        window.__cfg('minha_opcao', true);
        window.__cfg('meu_valor', 100);

        console.log('Opção:', window.__cfg('minha_opcao'));
        console.log('Valor:', window.__cfg('meu_valor'));
        `;

        // Inserir código
        const modifiedCode = sourceCode + configCode;

        console.log('✅ Meu patch aplicado!');
        return modifiedCode;
    },

    remove: (sourceCode) => {
        // Lógica de remoção
        return sourceCode;
    }
};
```

### Exemplos de Configurações:

```javascript
// Configurações de velocidade
window.__cfg('autocast_delay', 500);
window.__cfg('animation_speed', 1.0);

// Configurações booleanas
window.__cfg('auto_repair_enabled', true);
window.__cfg('sound_effects', false);

// Configurações de texto
window.__cfg('player_name', 'GameHacker');

// Configurações de objetos
window.__cfg('keybinds', {
    'autocast': 'Space',
    'repair': 'R',
    'menu': 'Escape'
});
```

## 📊 Comandos Úteis

### Sistema de Patches:
```bash
# Ver status
node patch-system.js status

# Listar patches
node patch-system.js list

# Aplicar patch específico
node patch-system.js apply NOME_PATCH

# Remover patch específico
node patch-system.js remove NOME_PATCH

# Aplicar todos
./scripts/apply-all.sh
```

### No Console do Jogo:
```javascript
// Ver todas as configurações
window.__cfg.list();

// Ver configuração específica
window.__cfg('autocast_delay');

// Alterar configuração
window.__cfg.set('autocast_delay', 200);

// Configurações comuns
window.__cfg.set('autocast_delay', 100);  // Muito rápido
window.__cfg.set('autocast_delay', 300);  // Rápido
window.__cfg.set('autocast_delay', 500);  // Normal (padrão)
window.__cfg.set('autocast_delay', 1000); // Lento
window.__cfg.set('autocast_delay', 2000); // Muito lento
```

## 🎯 Benefícios do Sistema Simplificado

### ✅ **Simplicidade**
- Apenas 2 patches essenciais
- Sistema de configuração unificado
- API consistente e fácil de usar

### ✅ **Flexibilidade**
- Configurações dinâmicas em tempo real
- Sem necessidade de reaplicar patches
- Expansível para futuros patches

### ✅ **Manutenibilidade**
- Código limpo e organizado
- Sistema de backup desabilitado (menos complexidade)
- Fácil desenvolvimento de novos patches

### ✅ **Performance**
- Sistema leve e eficiente
- Persistência automática
- Sem overhead desnecessário

## 🔄 Migração de Patches Antigos

Se você tinha patches antigos aplicados:

1. **Execute um update:**
   ```bash
   node auto-update.js
   ```

2. **Reaplique os patches simplificados:**
   ```bash
   ./scripts/apply-all.sh
   ```

3. **Configure suas preferências:**
   ```javascript
   // No console do jogo
   window.__cfg.set('autocast_delay', SEU_DELAY_PREFERIDO);
   ```

---

**🎮 Sistema mais simples, mais poderoso e mais fácil de usar!** ✨