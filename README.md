# 🎮 GameHacxkeado - Sistema Completo de Modificação

Ferramentas avançadas para desminificação e modificação de jogos JavaScript. Sistema completo com unminify automático e patches modulares.

## ✨ Funcionalidades Principais

### 🔄 Sistema de Unminify
- **Detecção automática** de arquivos `index-*.js`
- **Desminificação inteligente** usando Prettier
- **Backup automático** do source.js atual
- **Processo completamente automatizado**

### 🔧 Sistema de Patches
- **Patches modulares** para auto-cast, auto-repair e mais
- **Aplicação e remoção** reversível de patches
- **Sistema de backup** completo
- **Interface CLI** intuitiva

## 🚀 Quick Start

### 1. Instalação
```bash
# Clone/baixe o projeto
git clone https://github.com/MarcosBrendonDePaula/GameHacxkeado.git
cd GameHacxkeado

# Instale dependências
npm install
```

### 2. Desminify Automático
```bash
# Windows
unminify.bat

# Linux/Mac
./unminify.sh

# Ou direto com Node.js
node auto-unminify.js
```

### 3. Sistema de Patches
```bash
# Ver patches disponíveis
./patch.sh list

# Aplicar patches essenciais
./patch.sh apply auto-cast-speed
./patch.sh apply super-cast-speed
./patch.sh apply auto-repair

# Ver status
./patch.sh status
```

## 📁 Estrutura do Projeto

```
GameHacxkeado/
├── 📄 Sistemas Principais
│   ├── auto-unminify.js          # Sistema de desminificação
│   ├── patch-system.js           # Sistema de patches
│   └── codigo-site.js            # Sistema web original
│
├── 🔧 Patches Disponíveis
│   ├── patches/definitions/
│   │   ├── auto-cast-speed.js    # Modifica velocidade auto-cast
│   │   ├── super-cast-speed.js   # Modifica velocidade super-cast
│   │   ├── auto-repair.js        # Sistema auto-repair
│   │   ├── config-menu.js        # Menu visual de configurações
│   │   └── test-patch.js         # Patch de teste
│   │
│   ├── patches/backups/          # Backups automáticos
│   └── patches/applied/          # Estado dos patches
│
├── 📜 Scripts Convenientes
│   ├── unminify.bat / .sh        # Scripts para unminify
│   ├── patch.bat / .sh           # Scripts para patches
│   └── package.json              # NPM scripts
│
├── 📚 Documentação
│   ├── README.md                 # Este arquivo
│   ├── UNMINIFY-README.md        # Documentação do unminify
│   ├── PATCH-SYSTEM-README.md    # Documentação dos patches
│   └── claude.md                 # Documentação técnica
│
└── 🎯 Arquivos de Trabalho
    ├── source.js                 # Arquivo principal (resultado)
    ├── index-*.js                # Arquivos minificados de entrada
    └── old-source-*.js           # Backups automáticos
```

## 🎯 Patches Disponíveis

### 🏹 Auto Cast Speed
Modifica velocidade do sistema de auto cast (500ms-2000ms)
```bash
./patch.sh apply auto-cast-speed
```
**Presets**: slow (2000ms) | normal (1000ms) | **fast (500ms)** | ultra_fast (200ms) | instant (50ms)

### ⚡ Super Cast Speed
Modifica velocidade do sistema de super cast (100ms-300ms)
```bash
./patch.sh apply super-cast-speed
```
**Presets**: slow (300ms) | normal (200ms) | **fast (100ms)** | ultra_fast (50ms) | instant (10ms)

### 🔧 Auto Repair
Sistema completo de reparo automático de itens
```bash
./patch.sh apply auto-repair
```
**Controle**: `AutoRepair.enable()` | `AutoRepair.disable()` | `AutoRepair.testModal()`

### 🎮 Config Menu
Menu visual de configurações no jogo (Ctrl+Shift+C)
```bash
./patch.sh apply config-menu
```
**Hotkey**: Ctrl+Shift+C para abrir/fechar menu

## 📊 Exemplo de Workflow Completo

```bash
# 1. Desminificar arquivo index-*.js para source.js legível
./unminify.sh

# 2. Ver patches disponíveis
./patch.sh list

# 3. Aplicar patches essenciais
./patch.sh apply auto-cast-speed
./patch.sh apply super-cast-speed
./patch.sh apply auto-repair

# 4. Aplicar interface visual (opcional)
./patch.sh apply config-menu

# 5. Verificar status final
./patch.sh status
```

## 🛠️ NPM Scripts

```bash
# Unminify
npm run unminify              # Processo automático
npm run unminify:verbose      # Modo detalhado
npm run list-files            # Listar arquivos index-*.js

# Patches
npm run patch                 # Status do sistema
npm run patch:list            # Listar patches
npm run patch:status          # Status detalhado
npm run patch:backups         # Ver backups
```

## 📝 Comandos Mais Usados

### Sistema Unminify
```bash
# Processo automático (detecta index-*.js e cria source.js)
./unminify.sh

# Com detalhes
./unminify.sh verbose

# Listar arquivos disponíveis
node auto-unminify.js list
```

### Sistema de Patches
```bash
# Status e lista de patches
./patch.sh list

# Aplicar patch específico
./patch.sh apply <nome-patch>

# Remover patch específico
./patch.sh remove <nome-patch>

# Ver backups disponíveis
./patch.sh backups

# Restaurar de backup
node patch-system.js restore <nome-backup>
```

## 🔄 Fluxo Recomendado

### Para Novos Arquivos de Jogo

1. **Colocar arquivo** `index-*.js` na pasta
2. **Executar unminify**: `./unminify.sh`
3. **Aplicar patches**: `./patch.sh apply auto-cast-speed`
4. **Verificar resultado**: `./patch.sh status`

### Para Desenvolvimento de Patches

1. **Criar patch**: `patches/definitions/meu-patch.js`
2. **Testar aplicação**: `./patch.sh apply meu-patch --verbose`
3. **Verificar resultado**: Verificar mudanças em source.js
4. **Testar remoção**: `./patch.sh remove meu-patch`

## 🧪 Resultados de Testes

### Sistema Unminify ✅
- **Input**: index-B-wWs9BU.js (5.86 MB)
- **Output**: source.js (10.06 MB formatado)
- **Backup**: Criado automaticamente

### Sistema de Patches ✅
- **Auto Cast Speed**: 3 delays modificados
- **Super Cast Speed**: 188 delays modificados
- **Auto Repair**: Sistema injetado com sucesso
- **Config Menu**: Interface visual funcional

## ⚠️ Considerações de Segurança

### Backup Obrigatório
- **Sempre** crie backup antes de modificar: `cp source.js source.js.original`
- Sistemas fazem backup automático, mas backup manual é recomendado
- Use `git` para versionamento se estiver em desenvolvimento

### Uso Responsável
- **Apenas para fins educacionais/pessoais**
- **Teste em ambiente seguro** antes de usar no jogo
- **Use velocidades moderadas** para evitar detecção
- **Respeite os termos de serviço** do jogo

### Detecção de Problemas
```bash
# Verificar integridade dos arquivos
ls -la source.js

# Verificar sintaxe JavaScript
node -c source.js

# Verificar patches aplicados
./patch.sh status
```

## 🐛 Resolução de Problemas

### Unminify
```bash
# Nenhum arquivo index-*.js encontrado
node auto-unminify.js list

# Erro do Prettier
npm install prettier --save-dev

# Arquivo muito grande
# Use limit e offset no código se necessário
```

### Patches
```bash
# Patch não encontrado
./patch.sh list

# Erro de sintaxe no patch
node -c patches/definitions/nome-patch.js

# Restaurar estado original
cp source.js.original source.js
rm patches/applied/applied.json
```

### Problemas Gerais
```bash
# Node.js não encontrado
# Instale: https://nodejs.org/

# Permissão negada (Linux/Mac)
chmod +x *.sh

# Dependências em falta
npm install
```

## 📚 Documentação Detalhada

- **[UNMINIFY-README.md](UNMINIFY-README.md)**: Documentação completa do sistema de unminify
- **[PATCH-SYSTEM-README.md](PATCH-SYSTEM-README.md)**: Documentação completa do sistema de patches
- **[claude.md](claude.md)**: Documentação técnica e padrões regex

## 🤝 Contribuição

1. **Fork** o projeto
2. **Crie** uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. **Commit** suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. **Push** para a branch (`git push origin feature/nova-feature`)
5. **Abra** um Pull Request

## 📋 TODO / Roadmap

- [ ] Interface web para sistema de patches
- [ ] Mais patches específicos (auto-fishing, auto-mining, etc.)
- [ ] Sistema de profiles de configuração
- [ ] Integração com CI/CD para testes automáticos
- [ ] Plugin para VS Code/editores

## 📄 Licença

Este projeto é disponibilizado sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🎉 Pronto para Usar!

O sistema está completo e testado. Para começar rapidamente:

```bash
# Processo completo em 3 comandos
./unminify.sh                      # Desminifica index-*.js → source.js
./patch.sh apply auto-cast-speed   # Aplica modificação de velocidade
./patch.sh status                  # Verifica resultado
```

---

**💡 Dica**: Use sempre `--verbose` ou `verbose` nos primeiros testes para entender o que cada ferramenta está fazendo. Ambos os sistemas foram projetados para serem seguros e reversíveis.

**🔗 Links Úteis**:
- [Node.js](https://nodejs.org/) - Runtime necessário
- [Prettier](https://prettier.io/) - Formatador de código usado
- [Issues](https://github.com/MarcosBrendonDePaula/GameHacxkeado/issues) - Reportar problemas

**✨ GameHacxkeado v1.0.0** - Sistema completo de modificação de jogos JavaScript