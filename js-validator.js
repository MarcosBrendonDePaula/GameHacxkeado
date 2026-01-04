#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

class JavaScriptValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    // Valida sintaxe do JavaScript
    validateSyntax(code, filename = 'source.js') {
        this.errors = [];
        this.warnings = [];

        console.log(`🔍 Validando sintaxe do arquivo: ${filename}`);
        console.log(`📊 Tamanho do código: ${(code.length / 1024 / 1024).toFixed(2)} MB`);

        try {
            // Método 1: Tentar compilar com vm.compileFunction (mais seguro)
            const result = this.validateWithVM(code, filename);

            if (result.isValid) {
                console.log('✅ Sintaxe JavaScript válida!');
                this.runAdditionalChecks(code);
                return true;
            } else {
                return false;
            }

        } catch (error) {
            this.addError('SYNTAX_ERROR', error.message, this.extractLineInfo(error));
            return false;
        }
    }

    // Validação usando VM (mais segura)
    validateWithVM(code, filename) {
        try {
            // Criar contexto seguro sem executar o código
            const script = new vm.Script(code, {
                filename: filename,
                lineOffset: 0,
                columnOffset: 0,
                displayErrors: true
            });

            return { isValid: true, script };

        } catch (syntaxError) {
            // Tenta extrair informações de linha do erro
            const lineInfo = this.extractLineInfo(syntaxError, code);

            this.addError(
                'SYNTAX_ERROR',
                syntaxError.message,
                {
                    line: lineInfo.line || 'desconhecida',
                    column: lineInfo.column || 'desconhecida',
                    context: lineInfo.context || null,
                    stack: syntaxError.stack
                }
            );

            return { isValid: false, error: syntaxError };
        }
    }

    // Verificações adicionais (não-bloqueantes)
    runAdditionalChecks(code) {
        console.log('🔍 Executando verificações adicionais...');

        // Verificar parênteses balanceados
        this.checkBalancedParentheses(code);

        // Verificar vírgulas problemáticas
        this.checkTrailingCommas(code);

        // Verificar uso de console
        this.checkConsoleUsage(code);

        // Verificar funções arrow problemáticas
        this.checkArrowFunctions(code);

        // Verificar finais de linha
        this.checkLineEndings(code);

        if (this.warnings.length > 0) {
            console.log(`⚠️  ${this.warnings.length} aviso(s) encontrado(s)`);
        }
    }

    // Verifica parênteses balanceados
    checkBalancedParentheses(code) {
        const brackets = { '(': ')', '[': ']', '{': '}' };
        const stack = [];
        let line = 1;
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < code.length; i++) {
            const char = code[i];

            if (char === '\n') line++;

            // Detectar strings
            if ((char === '"' || char === "'" || char === '`') && !inString) {
                inString = true;
                stringChar = char;
                continue;
            }

            if (inString && char === stringChar && code[i-1] !== '\\') {
                inString = false;
                continue;
            }

            if (inString) continue;

            // Verificar abertura
            if (brackets[char]) {
                stack.push({ char, expected: brackets[char], line });
            }

            // Verificar fechamento
            if (Object.values(brackets).includes(char)) {
                if (stack.length === 0) {
                    this.addWarning('UNMATCHED_BRACKET', `Parêntese/chave fechando sem abertura: '${char}'`, { line });
                } else {
                    const last = stack.pop();
                    if (last.expected !== char) {
                        this.addWarning('MISMATCHED_BRACKET',
                            `Esperado '${last.expected}' na linha ${last.line}, encontrado '${char}'`,
                            { line }
                        );
                    }
                }
            }
        }

        // Verificar parênteses não fechados
        stack.forEach(item => {
            this.addWarning('UNCLOSED_BRACKET',
                `Parêntese/chave não fechado: '${item.char}' esperando '${item.expected}'`,
                { line: item.line }
            );
        });
    }

    // Verifica vírgulas problemáticas
    checkTrailingCommas(code) {
        const problematicCommas = code.match(/,\s*[}\]]/g);
        if (problematicCommas) {
            this.addWarning('TRAILING_COMMA',
                `${problematicCommas.length} vírgula(s) trailing encontrada(s) - podem causar problemas em browsers antigos`
            );
        }
    }

    // Verifica uso excessivo de console
    checkConsoleUsage(code) {
        const consoleMatches = code.match(/console\.(log|warn|error|info)/g);
        if (consoleMatches && consoleMatches.length > 50) {
            this.addWarning('EXCESSIVE_CONSOLE',
                `${consoleMatches.length} chamadas de console encontradas - considere remover em produção`
            );
        }
    }

    // Verifica arrow functions problemáticas
    checkArrowFunctions(code) {
        const problematicArrows = code.match(/\(\s*\)\s*=>\s*[^{]/g);
        if (problematicArrows) {
            this.addWarning('ARROW_FUNCTION',
                `${problematicArrows.length} arrow function(s) sem chaves - verifique se estão corretas`
            );
        }
    }

    // Verifica finais de linha
    checkLineEndings(code) {
        const crlfCount = (code.match(/\r\n/g) || []).length;
        const lfCount = (code.match(/(?<!\r)\n/g) || []).length;

        if (crlfCount > 0 && lfCount > 0) {
            this.addWarning('MIXED_LINE_ENDINGS',
                'Finais de linha mistos detectados (CRLF + LF) - pode causar problemas'
            );
        }
    }

    // Adiciona erro
    addError(type, message, location = {}) {
        this.errors.push({
            type,
            message,
            location,
            level: 'error'
        });
    }

    // Adiciona aviso
    addWarning(type, message, location = {}) {
        this.warnings.push({
            type,
            message,
            location,
            level: 'warning'
        });
    }

    // Extrai informação de linha do erro
    extractLineInfo(error, code = null) {
        let lineNumber = null;
        let columnNumber = null;

        // Estratégia 1: Tentar extrair do stack
        const stackMatch = error.stack?.match(/at .*?:(\d+):(\d+)/);
        if (stackMatch) {
            lineNumber = parseInt(stackMatch[1]);
            columnNumber = parseInt(stackMatch[2]);
        }

        // Estratégia 2: Propriedades diretas do erro
        if (!lineNumber && error.lineNumber) {
            lineNumber = error.lineNumber;
        }
        if (!columnNumber && error.columnNumber) {
            columnNumber = error.columnNumber;
        }

        // Estratégia 3: Buscar no message do erro
        if (!lineNumber) {
            const messageMatch = error.message?.match(/line (\d+)/i);
            if (messageMatch) {
                lineNumber = parseInt(messageMatch[1]);
            }
        }

        // Estratégia 4: Análise manual do código se temos o código fonte
        if (!lineNumber && code && error.message) {
            lineNumber = this.findErrorLineInCode(code, error.message);
        }

        // Estratégia 5: Procurar linhas suspeitas no início do arquivo (primeiras 50 linhas)
        if (!lineNumber && code) {
            lineNumber = this.findSuspiciousLinesInBeginning(code);
        }

        const result = {
            line: lineNumber,
            column: columnNumber
        };

        // Adiciona contexto da linha se temos o código e linha
        if (code && lineNumber) {
            result.context = this.getLineContext(code, lineNumber);
        }

        return result;
    }

    // Encontra a linha do erro analisando o código manualmente
    findErrorLineInCode(code, errorMessage) {
        const lines = code.split('\n');

        // Procura por padrões específicos baseados no tipo de erro
        if (errorMessage.includes('Unexpected token')) {
            const tokenMatch = errorMessage.match(/Unexpected token[: ]+['"]?([^'"]+)['"]?/);
            if (tokenMatch) {
                const token = tokenMatch[1];

                // Procura pelo token nas linhas
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(token)) {
                        // Verifica se essa linha parece problemática
                        if (this.isLineSuspicious(lines[i])) {
                            return i + 1;
                        }
                    }
                }
            }
        }

        // Procura por linhas incompletas ou malformadas
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (this.isLineSuspicious(line)) {
                return i + 1;
            }
        }

        return null;
    }

    // Verifica se uma linha parece suspeita/problemática
    isLineSuspicious(line) {
        // Padrões que indicam problemas de sintaxe
        const suspiciousPatterns = [
            /^[^{};]*\{[^}]*$/,           // Abre chave mas não fecha
            /^[^{}]*}[^;]*$/,            // Fecha chave em local estranho
            /[^"']*["'][^"']*$/,         // String não fechada
            /^\s*var\s+\w+\s*=\s*[^;]*$/,   // Declaração var incompleta
            /^\s*function\s*[^{]*$/,      // Função sem corpo
            /[,(]\s*$/,                  // Termina com vírgula ou parêntese aberto
            /configura$/,                // Linha que termina com "configura" (detectado no source.js)
            /\{[^}]*$/,                  // Linha que abre chave mas não fecha
            /=>\s*\([^)]*$/,             // Arrow function malformada
            /^\s*var\s+\w+\s*=.*[^;}\]]\s*$/,  // Declaração var que não termina adequadamente
        ];

        return suspiciousPatterns.some(pattern => pattern.test(line));
    }

    // Procura linhas suspeitas no início do arquivo
    findSuspiciousLinesInBeginning(code, maxLines = 50) {
        const lines = code.split('\n');
        const searchLimit = Math.min(lines.length, maxLines);

        for (let i = 0; i < searchLimit; i++) {
            const line = lines[i].trim();
            if (this.isLineSuspicious(line)) {
                return i + 1; // Retorna primeira linha suspeita encontrada
            }
        }

        return null;
    }

    // Obtém contexto das linhas ao redor do erro
    getLineContext(code, lineNumber, contextSize = 3) {
        const lines = code.split('\n');
        const startLine = Math.max(0, lineNumber - contextSize - 1);
        const endLine = Math.min(lines.length - 1, lineNumber + contextSize - 1);

        const contextLines = [];
        for (let i = startLine; i <= endLine; i++) {
            const lineNum = i + 1;
            const isErrorLine = lineNum === lineNumber;
            const prefix = isErrorLine ? '>>> ' : '    ';
            const line = lines[i] || '';

            contextLines.push(`${prefix}${lineNum.toString().padStart(4)}: ${line}`);
        }

        return contextLines.join('\n');
    }

    // Mostra relatório detalhado
    showReport() {
        console.log('\n📋 RELATÓRIO DE VALIDAÇÃO');
        console.log('='.repeat(50));

        if (this.errors.length === 0 && this.warnings.length === 0) {
            console.log('✅ Nenhum problema encontrado!');
            return;
        }

        // Mostrar erros
        if (this.errors.length > 0) {
            console.log(`\n❌ ERROS (${this.errors.length}):`);
            this.errors.forEach((error, index) => {
                console.log(`\n${index + 1}. [${error.type}] ${error.message}`);
                if (error.location.line) {
                    console.log(`   📍 Linha: ${error.location.line}, Coluna: ${error.location.column || 'N/A'}`);
                }

                // Mostra contexto da linha se disponível
                if (error.location.context) {
                    console.log(`\n   📄 Contexto:`);
                    console.log(error.location.context);
                }
            });
        }

        // Mostrar avisos
        if (this.warnings.length > 0) {
            console.log(`\n⚠️  AVISOS (${this.warnings.length}):`);
            this.warnings.forEach((warning, index) => {
                console.log(`\n${index + 1}. [${warning.type}] ${warning.message}`);
                if (warning.location.line) {
                    console.log(`   📍 Linha: ${warning.location.line}`);

                    // Mostra contexto da linha se disponível
                    if (warning.location.context) {
                        console.log(`\n   📄 Contexto:`);
                        console.log(warning.location.context);
                    }
                }
            });
        }
    }

    // Sugere correções
    suggestFixes() {
        if (this.errors.length === 0) return;

        console.log('\n💡 SUGESTÕES DE CORREÇÃO:');
        console.log('-'.repeat(30));

        this.errors.forEach(error => {
            switch (error.type) {
                case 'SYNTAX_ERROR':
                    if (error.message.includes('Unexpected token')) {
                        console.log('• Verifique parênteses, chaves ou vírgulas perdidas');
                        console.log('• Verifique se todas as strings estão fechadas');
                        console.log('• Erro pode estar em linhas anteriores - verifique linhas incompletas');
                    }
                    if (error.message.includes('Unexpected end of input')) {
                        console.log('• Verifique se há parênteses ou chaves não fechadas');
                    }
                    break;
            }
        });
    }

    // Análise adicional para identificar problemas específicos
    performAdditionalAnalysis(code) {
        console.log('\n🔍 ANÁLISE ADICIONAL DE PROBLEMAS:');
        console.log('-'.repeat(40));

        const lines = code.split('\n');
        let foundIssues = false;

        // Verificar primeiras 10 linhas especificamente
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            const line = lines[i];
            const lineNum = i + 1;

            if (this.isLineSuspicious(line.trim())) {
                console.log(`⚠️  Linha ${lineNum} suspeita:`);
                console.log(`    ${line}`);

                // Análises específicas
                if (line.includes('configura') && !line.includes('configuracao')) {
                    console.log('    → Linha parece estar incompleta (termina com "configura")');
                }
                if (line.match(/=.*\{[^}]*$/)) {
                    console.log('    → Objeto ou função não fechada adequadamente');
                }
                if (line.match(/var\s+\w+\s*=.*[^;]\s*$/)) {
                    console.log('    → Declaração var pode estar incompleta');
                }

                foundIssues = true;
            }
        }

        if (!foundIssues) {
            console.log('✅ Nenhum problema óbvio detectado nas primeiras linhas');
        }
    }

    // Valida arquivo
    async validateFile(filePath) {
        const absolutePath = path.resolve(filePath);

        if (!fs.existsSync(absolutePath)) {
            console.error(`❌ Arquivo não encontrado: ${filePath}`);
            return false;
        }

        console.log(`🔍 Validando arquivo: ${absolutePath}`);

        try {
            const code = fs.readFileSync(absolutePath, 'utf8');
            const isValid = this.validateSyntax(code, path.basename(filePath));

            this.showReport();

            if (!isValid) {
                this.suggestFixes();

                // Análise adicional para erros de sintaxe
                if (this.errors.some(error => error.type === 'SYNTAX_ERROR')) {
                    this.performAdditionalAnalysis(code);
                }

                console.log('\n❌ Validação falhou!');
                return false;
            }

            console.log('\n✅ Validação bem-sucedida!');
            return true;

        } catch (error) {
            console.error(`❌ Erro ao ler arquivo: ${error.message}`);
            return false;
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
🔍 JavaScript Validator - Validador de Sintaxe JS

Uso:
    node js-validator.js [arquivo]          # Valida arquivo específico
    node js-validator.js                    # Valida source.js (padrão)
    node js-validator.js --help             # Mostra esta ajuda

Funcionalidades:
    ✅ Validação de sintaxe JavaScript
    ✅ Detecção de parênteses não balanceados
    ✅ Verificação de vírgulas problemáticas
    ✅ Análise de arrow functions
    ✅ Detecção de finais de linha mistos
    ✅ Sugestões de correção

Exemplos:
    node js-validator.js source.js
    node js-validator.js patches/definitions/config-system.js
`);
        process.exit(0);
    }

    const validator = new JavaScriptValidator();
    const fileName = args[0] || 'source.js';

    const isValid = await validator.validateFile(fileName);
    process.exit(isValid ? 0 : 1);
}

// Exportar para uso como módulo
module.exports = JavaScriptValidator;

// Executar CLI se chamado diretamente
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Erro fatal:', error.message);
        process.exit(1);
    });
}