# Auto Cast Delay Finder - Regras e Instruções

## Visão Geral

Este projeto contém ferramentas para encontrar e modificar automaticamente os delays do auto cast em jogos JavaScript, funcionando mesmo se o código mudar nas próximas versões.

## Funcionalidades

### 1. Detecção Automática de Delays
- **Auto Cast Normal**: Encontra delays principais (geralmente 500ms-2000ms)
- **Super Cast**: Encontra delays rápidos (geralmente 100ms-300ms)
- **Busca por padrões regex**: Funciona mesmo com mudanças no código

### 2. Modificação de Velocidades
- **Presets predefinidos**: slow, normal, fast, ultra_fast
- **Valores customizados**: Define delays personalizados
- **Backup automático**: Preserva código original

## Estrutura do Projeto

```
src/
├── utils/
│   ├── __init__.py              # Inicialização do pacote
│   ├── config.py                # Configurações e presets
│   └── find_autocast_delays.py  # Classe principal
└── find_delays.py               # Script principal interativo

claude.md                        # Este arquivo (regras e instruções)
```

## Como Usar

### Método 1: Script Interativo (Recomendado)

```bash
cd src
python find_delays.py
```

Menu interativo com opções:
1. Apenas encontrar delays atuais
2. Aplicar preset de velocidade
3. Aplicar delays customizados
4. Mostrar presets disponíveis
5. Sair

### Método 2: Linha de Comando

```bash
cd src/utils
python find_autocast_delays.py --help
```

Exemplos:
```bash
# Apenas encontrar delays
python find_autocast_delays.py

# Aplicar mudanças com valores padrão
python find_autocast_delays.py --apply

# Delays customizados
python find_autocast_delays.py --apply --auto-delay 800 --super-delay 150

# Arquivo específico
python find_autocast_delays.py --file /path/to/source.js --apply
```

## Presets de Velocidade

| Preset     | Auto Cast | Super Cast | Descrição           |
|------------|-----------|------------|---------------------|
| slow       | 2000ms    | 300ms      | Velocidade lenta    |
| normal     | 1000ms    | 200ms      | Velocidade normal   |
| fast       | 500ms     | 100ms      | Velocidade rápida   |
| ultra_fast | 200ms     | 50ms       | Velocidade máxima   |

## Padrões de Detecção

### Auto Cast Normal
O script procura por estes padrões:

1. **Declaração de constante com delay**:
   ```regex
   const\s+(\w+)\s*=\s*(\d+(?:e\d+)?),?\s*(?://.*?)?\s*\w+\s*=\s*50
   ```

2. **Contexto específico do auto cast**:
   ```regex
   if\s*\(!ft\s*\|\|\s*!xe\.current\)[\s\S]*?const\s+(\w+)\s*=\s*(\d+(?:e\d+)?)
   ```

3. **SetInterval que usa variável de delay**:
   ```regex
   const\s+(\w+)\s*=\s*(\d+(?:e\d+)?),[\s\S]{1,200}?setInterval\([^,]*?,\s*\1\)
   ```

### Super Cast
Procura por estes padrões:

1. **Delay após som de tap**:
   ```regex
   audioManager\.playTileTapSound\(\)[\s\S]{1,100}?},\s*(\d+)\);
   ```

2. **Contexto do toggleTileFished**:
   ```regex
   toggleTileFished[\s\S]{1,100}?},\s*(\d+)\);\s*return\s*\(\)\s*=>
   ```

3. **Contexto de SUPERCAST**:
   ```regex
   SUPERCAST[\s\S]{1,500}?},\s*(\d+)\);
   ```

## Localização dos Delays no Código

### Auto Cast Normal
- **Localização típica**: Linhas ~230950-230960
- **Código exemplo**:
  ```javascript
  const xr = 500,  // Delay em millisegundos
      zr = 50;
  ```

### Super Cast
- **Localização típica**: Linhas ~231015-231020
- **Código exemplo**:
  ```javascript
  audioManager.playTileTapSound(),
  xe.current.toggleTileFished(Wr.instanceIndex);
  }, 200);  // Delay em millisegundos
  ```

## Backup e Segurança

### Antes de Modificar
1. **Sempre faça backup** do arquivo source.js original
2. **Teste as modificações** em ambiente seguro
3. **Verifique os resultados** antes de usar no jogo

### Comando de Backup
```bash
cp source.js source.js.backup
```

### Restaurar Backup
```bash
cp source.js.backup source.js
```

## Saída do Script

### Formato de Resultado
```
Auto Cast Normal (delay principal):
  [OK] Padrão 1: Linha 230955 - Delay: 500 (500ms)
       Contexto: const xr = 500, zr = 50...

Super Cast (delay rápido):
  [OK] Padrão 1: Linha 231015 - Delay: 200 (200ms)
       Contexto: audioManager.playTileTapSound()...

Comandos para modificar os delays:

Auto Cast Normal:
   Linha 230955: Alterar '500' para '1000' (1000ms)

Super Cast:
   Linha 231015: Alterar '200' para '100' (100ms)
```

### Arquivo JSON de Resultados
O script salva os resultados em `autocast_delays_results.json`:

```json
{
  "auto_cast_normal": [
    {
      "pattern": 1,
      "line": 230955,
      "delay": "500",
      "delay_ms": 500,
      "context": "const xr = 500, zr = 50...",
      "full_match": "..."
    }
  ],
  "super_cast": [
    {
      "pattern": 1,
      "line": 231015,
      "delay": "200",
      "delay_ms": 200,
      "context": "audioManager.playTileTapSound()...",
      "full_match": "..."
    }
  ]
}
```

## Resolução de Problemas

### Problema: Nenhum delay encontrado
**Soluções**:
1. Verificar se o arquivo source.js está correto
2. O código pode ter mudado - ajustar padrões regex
3. Executar busca manual nas linhas ~230950 e ~231015

### Problema: Modificações não funcionam
**Soluções**:
1. Verificar se o arquivo foi salvo corretamente
2. Limpar cache do navegador
3. Verificar se não há outros delays sobrescrevendo

### Problema: Script não encontra arquivo
**Soluções**:
1. Executar o script na pasta correta
2. Especificar caminho completo: `--file /path/to/source.js`
3. Verificar permissões de leitura

## Desenvolvimento e Customização

### Adicionar Novos Padrões
Editar `src/utils/config.py`:

```python
ADVANCED_PATTERNS = {
    "auto_cast_contexts": [
        # Adicionar novo padrão regex aqui
        r"novo_padrão_regex",
    ]
}
```

### Criar Novos Presets
Editar `src/utils/config.py`:

```python
SPEED_PRESETS = {
    "custom_name": {
        "auto_cast_normal": 1500,  # ms
        "super_cast": 150,         # ms
    }
}
```

### Modificar Classe Principal
A classe `AutoCastDelayFinder` em `src/utils/find_autocast_delays.py` contém toda a lógica:

- `_create_patterns()`: Define padrões regex
- `find_delays()`: Executa busca
- `apply_modifications()`: Aplica mudanças

## Requisitos do Sistema

- **Python 3.6+**
- **Bibliotecas padrão**: re, os, json, argparse
- **Sistema operacional**: Windows, Linux, macOS
- **Arquivo fonte**: source.js (arquivo JavaScript do jogo)

## Regras de Uso

1. **Uso responsável**: Apenas para fins educacionais/pessoais
2. **Backup obrigatório**: Sempre criar backup antes de modificar
3. **Teste seguro**: Testar modificações em ambiente isolado
4. **Respeitar ToS**: Não violar termos de serviço do jogo
5. **Não distribuir**: Não compartilhar arquivos modificados

## Histórico de Versões

### v1.0 (Atual)
- Detecção automática de delays
- Interface interativa
- Presets de velocidade
- Suporte a valores customizados
- Sistema de backup
- Documentação completa

## Suporte

Para problemas ou melhorias:
1. Verificar este arquivo de documentação
2. Testar com valores padrão
3. Verificar logs de erro do script
4. Criar backup e tentar novamente

---

**IMPORTANTE**: Este script é fornecido como está, sem garantias. Sempre faça backup dos arquivos originais antes de usar.