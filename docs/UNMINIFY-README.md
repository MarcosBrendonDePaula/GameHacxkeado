# 🚀 Auto Unminify System

Sistema automatizado para desminificar arquivos JavaScript do jogo, baseado no sistema web existente.

## ✨ Funcionalidades

- ✅ **Detecção automática** de arquivos `index-*.js`
- ✅ **Backup automático** do `source.js` atual com timestamp
- ✅ **Desminificação inteligente** usando Prettier
- ✅ **Processo completamente automatizado**
- ✅ **Suporte a Windows, Linux e Mac**
- ✅ **Interface de linha de comando simples**

## 📋 Pré-requisitos

- **Node.js** (versão 12 ou superior)
- **npm** (incluído com Node.js)

## 🔧 Instalação Rápida

1. **Clone/baixe o projeto**
2. **Execute uma vez** (instala dependências automaticamente):
   ```bash
   npm install
   ```

## 🎯 Como Usar

### Método 1: Processo Automático (Recomendado)

**Windows:**
```bash
unminify.bat
```

**Linux/Mac:**
```bash
./unminify.sh
```

**Node.js direto:**
```bash
node auto-unminify.js
```

### Método 2: Comandos Específicos

```bash
# Ver arquivos disponíveis
node auto-unminify.js list

# Modo detalhado (verbose)
node auto-unminify.js verbose

# Formatar arquivo específico
node auto-unminify.js format index-ABC.js output.js

# Ver ajuda completa
node auto-unminify.js help
```

### Método 3: NPM Scripts

```bash
npm run unminify          # Processo automático
npm run unminify:verbose  # Modo detalhado
npm run list-files        # Listar arquivos
```

## 📁 O que o Sistema Faz

### 1. **Detecção Automática**
- Busca por arquivos no padrão `index-*.js`
- Seleciona automaticamente o mais recente
- Mostra tamanho e data de modificação

### 2. **Backup Seguro**
- Renomeia o `source.js` atual para `old-source-TIMESTAMP.js`
- Preserva o arquivo original com timestamp único
- Exemplo: `old-source-2025-12-22T18-49-27-838Z.js`

### 3. **Desminificação**
- Usa Prettier para formatar o código
- Adiciona quebras de linha e indentação
- Torna o código legível para análise/modificação

### 4. **Resultado**
- Cria novo `source.js` formatado e legível
- Mantém funcionalidade idêntica ao original
- Tamanho geralmente aumenta (normal após formatação)

## 📊 Exemplo de Execução

```bash
$ node auto-unminify.js verbose
[AutoUnminify] Inicializando Auto Unminify...
[AutoUnminify] ============================================================
[AutoUnminify] INICIANDO PROCESSO DE AUTO UNMINIFY
[AutoUnminify] ============================================================
[AutoUnminify] Procurando por arquivos index-*.js...
[AutoUnminify] Encontrados 1 arquivo(s): index-B-wWs9BU.js
[AutoUnminify] Arquivo selecionado: index-B-wWs9BU.js
[AutoUnminify] Backup criado: old-source-2025-12-22T18-49-27-838Z.js
[AutoUnminify] Lendo arquivo: index-B-wWs9BU.js...
[AutoUnminify] Tamanho do arquivo: 5.86 MB
[AutoUnminify] Desminificando código com Prettier...
[AutoUnminify] Novo source.js criado: 10.06 MB
[AutoUnminify] ============================================================
[AutoUnminify] PROCESSO CONCLUÍDO COM SUCESSO!
[AutoUnminify] ============================================================
[AutoUnminify] ✅ Arquivo processado: index-B-wWs9BU.js
[AutoUnminify] ✅ Backup criado: old-source-2025-12-22T18-49-27-838Z.js
[AutoUnminify] ✅ Novo source.js criado
[AutoUnminify] ✅ Tamanho: 10.06 MB
```

## 🔍 Comparação: Antes vs Depois

### Antes (Minificado):
```javascript
var Fo=Object.defineProperty;var Uo=(b,y,x)=>y in b?Fo(b,y,{enumerable:!0,configurable:!0,writable:!0,value:x}):b[y]=x;var or=(b,y,x)=>Uo(b,typeof y!="symbol"?y+"":y,x);function _mergeNamespaces(b,y){for(var x=0;x<y.length;x++){const A=y[x];
```

### Depois (Legível):
```javascript
var Fo = Object.defineProperty;
var Uo = (b, y, x) => (
    y in b ? Fo(b, y, { enumerable: !0, configurable: !0, writable: !0, value: x }) : (b[y] = x)
);
var or = (b, y, x) => Uo(b, typeof y != "symbol" ? y + "" : y, x);
function _mergeNamespaces(b, y) {
    for (var x = 0; x < y.length; x++) {
        const A = y[x];
        if (typeof A != "string" && !Array.isArray(A)) {
            for (const O in A)
                if (O !== "default" && !(O in b)) {
                    const U = Object.getOwnPropertyDescriptor(A, O);
                    U && Object.defineProperty(b, O, U.get ? U : { enumerable: !0, get: () => A[O] });
                }
        }
    }
    return Object.freeze(Object.defineProperty(b, Symbol.toStringTag, { value: "Module" }));
}
```

## 🛠️ Configuração do Prettier

O sistema usa estas configurações para formatação:

```javascript
{
    parser: 'babel',           // Parser JavaScript/TypeScript
    printWidth: 120,           // Largura máxima da linha
    tabWidth: 4,               // Tamanho da tabulação
    useTabs: false,            // Usar espaços em vez de tabs
    semi: true,                // Ponto e vírgula obrigatório
    singleQuote: false,        // Aspas duplas
    trailingComma: 'es5',      // Vírgula no final (ES5)
    bracketSpacing: true,      // Espaço entre chaves
    arrowParens: 'always'      // Parênteses em arrow functions
}
```

## 📝 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `node auto-unminify.js` | Processo automático completo |
| `node auto-unminify.js verbose` | Modo detalhado com logs |
| `node auto-unminify.js list` | Listar arquivos index-*.js |
| `node auto-unminify.js format <in> <out>` | Formatar arquivo específico |
| `node auto-unminify.js help` | Ajuda completa |
| `unminify.bat` | Script Windows |
| `./unminify.sh` | Script Unix/Linux/Mac |
| `npm run unminify` | Via NPM scripts |

## 🔄 Fluxo do Processo

1. **Inicialização**: Verifica Prettier (instala se necessário)
2. **Detecção**: Busca arquivos `index-*.js` no diretório
3. **Seleção**: Escolhe automaticamente o mais recente
4. **Backup**: Renomeia `source.js` atual com timestamp
5. **Desminificação**: Processa com Prettier
6. **Criação**: Gera novo `source.js` legível
7. **Sucesso**: Mostra relatório de conclusão

## ⚠️ Observações Importantes

- **Backup automático**: O arquivo original é sempre preservado
- **Sobrescrita**: O `source.js` atual será substituído
- **Tamanho**: O arquivo formatado é maior que o minificado (normal)
- **Funcionalidade**: O código mantém a mesma funcionalidade
- **Performance**: A desminificação pode levar alguns segundos

## 🐛 Resolução de Problemas

### Prettier não instalado
```bash
npm install prettier --save-dev
```

### Node.js não encontrado
- Instale Node.js: https://nodejs.org/

### Nenhum arquivo index-*.js encontrado
- Verifique se existe arquivo no padrão `index-*.js`
- Use `node auto-unminify.js list` para verificar

### Erro de permissão
**Windows:**
```bash
# Execute como administrador
```

**Linux/Mac:**
```bash
chmod +x unminify.sh
sudo chmod 755 auto-unminify.js
```

## 📁 Estrutura de Arquivos

```
GameHacxkeado/
├── auto-unminify.js          # Script principal
├── package.json               # Dependências do projeto
├── unminify.bat              # Script Windows
├── unminify.sh               # Script Unix/Linux/Mac
├── source.js                 # Arquivo desminificado (resultado)
├── old-source-TIMESTAMP.js   # Backup automático
├── index-*.js                # Arquivo minificado original
└── UNMINIFY-README.md        # Esta documentação
```

## 🎉 Pronto para Usar!

O sistema está configurado e pronto. Execute:

```bash
# Comando mais simples (Windows)
unminify.bat

# Ou (Linux/Mac)
./unminify.sh

# Ou direto com Node.js
node auto-unminify.js
```

O sistema detectará automaticamente o arquivo, fará backup do atual e criará um novo `source.js` legível!

---

**💡 Dica**: Use o modo verbose (`verbose`) na primeira execução para ver todos os detalhes do processo.