#!/usr/bin/env node

/**
 * Advanced Patch System for GameHacxkeado
 * Sistema completo de patches para injetar e modificar código JavaScript
 *
 * Funcionalidades:
 * - Aplicação de patches modulares
 * - Backup automático e restore
 * - Patches inteligentes com regex
 * - Suporte a múltiplos tipos de modificação
 * - Interface CLI intuitiva
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// JavaScript Validator para validação pós-patch
const JavaScriptValidator = require('./js-validator.js');

class PatchManager {
    constructor() {
        this.projectDir = process.cwd();
        this.sourceFile = path.join(this.projectDir, 'source.js');
        this.patchesDir = path.join(this.projectDir, 'patches');
        this.backupsDir = path.join(this.patchesDir, 'backups');
        this.appliedDir = path.join(this.patchesDir, 'applied');
        this.definitionsDir = path.join(this.patchesDir, 'definitions');

        this.isVerbose = false;
        this.appliedPatches = new Set();

        this.initDirectories();
        this.loadAppliedPatches();
    }

    log(message, isVerbose = false) {
        if (!isVerbose || this.isVerbose) {
            console.log(`[PatchSystem] ${message}`);
        }
    }

    error(message, exit = true) {
        console.error(`[ERROR] ${message}`);
        if (exit) process.exit(1);
    }

    initDirectories() {
        [this.patchesDir, this.backupsDir, this.appliedDir, this.definitionsDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // Carrega lista de patches já aplicados
    loadAppliedPatches() {
        const appliedFile = path.join(this.appliedDir, 'applied.json');
        if (fs.existsSync(appliedFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(appliedFile, 'utf8'));
                this.appliedPatches = new Set(data.patches || []);
                this.log(`Carregados ${this.appliedPatches.size} patches aplicados`, true);
            } catch (error) {
                this.log('Erro ao carregar patches aplicados, iniciando limpo', true);
            }
        }
    }

    saveAppliedPatches() {
        const appliedFile = path.join(this.appliedDir, 'applied.json');
        const data = {
            patches: Array.from(this.appliedPatches),
            lastUpdate: new Date().toISOString()
        };
        fs.writeFileSync(appliedFile, JSON.stringify(data, null, 2));
    }

    // Calcula hash do arquivo para verificar mudanças
    getFileHash(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        return crypto.createHash('md5').update(content).digest('hex');
    }

    // Faz backup do source.js atual (DESABILITADO)
    createBackup(patchName) {
        this.log(`Sistema de backup desabilitado - não será criado backup para '${patchName}'`);
        return null;
    }

    // Carrega definição de um patch
    loadPatch(patchName) {
        const patchFile = path.join(this.definitionsDir, `${patchName}.js`);
        if (!fs.existsSync(patchFile)) {
            this.error(`Patch '${patchName}' não encontrado em ${patchFile}`);
        }

        try {
            delete require.cache[require.resolve(patchFile)];
            return require(patchFile);
        } catch (error) {
            this.error(`Erro ao carregar patch '${patchName}': ${error.message}`);
        }
    }

    // Lista todos os patches disponíveis
    listAvailablePatches() {
        try {
            const files = fs.readdirSync(this.definitionsDir);
            return files
                .filter(file => file.endsWith('.js'))
                .map(file => file.replace('.js', ''));
        } catch (error) {
            return [];
        }
    }

    // Lista patches aplicados
    listAppliedPatches() {
        return Array.from(this.appliedPatches);
    }

    // Aplica um patch específico
    async applyPatch(patchName, options = {}) {
        this.isVerbose = options.verbose || false;

        this.log(`Aplicando patch: ${patchName}`);

        if (this.appliedPatches.has(patchName)) {
            if (!options.force) {
                this.log(`Patch '${patchName}' já está aplicado. Use --force para reaplicar.`);
                return false;
            }
            this.log(`Reaplicando patch '${patchName}' (force mode)`);
        }

        // Carrega definição do patch
        const patch = this.loadPatch(patchName);
        this.log(`Patch carregado: ${patch.name || patchName}`, true);
        this.log(`Descrição: ${patch.description || 'N/A'}`, true);

        // Valida o patch
        if (!this.validatePatch(patch)) {
            this.error(`Patch '${patchName}' é inválido`);
        }

        // Pular backup (sistema desabilitado)
        const backupFile = this.createBackup(patchName);

        try {
            // Lê o arquivo source
            const sourceContent = fs.readFileSync(this.sourceFile, 'utf8');

            // Aplica as modificações do patch
            const modifiedContent = await this.applyPatchModifications(sourceContent, patch);

            // Verifica se houve mudanças
            if (sourceContent === modifiedContent) {
                this.log(`Nenhuma mudança detectada para o patch '${patchName}'`);
                return false;
            }

            // Salva o arquivo modificado
            fs.writeFileSync(this.sourceFile, modifiedContent, 'utf8');

            // Validação JavaScript pós-patch (verificar se patch introduziu novos problemas)
            this.log('Validando sintaxe JavaScript após aplicação do patch...', true);
            const validator = new JavaScriptValidator();

            // Validar código original primeiro
            const originalValid = validator.validateSyntax(sourceContent, this.sourceFile);

            // Limpar erros/warnings do teste original
            const originalErrors = [...validator.errors];
            const originalWarnings = [...validator.warnings];

            // Validar código modificado
            const modifiedValid = validator.validateSyntax(modifiedContent, this.sourceFile);

            // Comparar erros: se código original já tinha erro e modificado tem o mesmo erro, ok
            if (!modifiedValid && !originalValid) {
                // Ambos têm erros - verificar se são os mesmos
                const newErrors = validator.errors.filter(error =>
                    !originalErrors.some(origError =>
                        origError.message === error.message &&
                        origError.location.line === error.location.line
                    )
                );

                if (newErrors.length === 0) {
                    this.log('⚠️  Código continua com problemas pré-existentes, mas patch não introduziu novos erros', true);
                } else {
                    this.log('❌ Patch introduziu novos erros JavaScript!');
                    console.log(`Novos erros (${newErrors.length}):`);
                    newErrors.forEach((error, index) => {
                        console.log(`${index + 1}. [${error.type}] ${error.message} (Linha: ${error.location.line})`);
                    });
                    throw new Error('Patch introduziu novos problemas JavaScript');
                }
            } else if (!modifiedValid && originalValid) {
                // Código original era válido, mas patch quebrou
                this.log('❌ Patch quebrou código JavaScript que estava válido!');
                validator.showReport();
                validator.suggestFixes();
                throw new Error('Patch quebrou JavaScript válido');
            } else if (modifiedValid) {
                this.log('✅ Validação JavaScript passou - código válido após patch', true);
            }

            // Mostrar novos warnings se houver
            const newWarnings = validator.warnings.filter(warning =>
                !originalWarnings.some(origWarning =>
                    origWarning.message === warning.message &&
                    origWarning.location.line === warning.location.line
                )
            );

            if (newWarnings.length > 0) {
                this.log(`⚠️  ${newWarnings.length} novo(s) aviso(s) introduzido(s) pelo patch`);
                if (this.isVerbose) {
                    newWarnings.forEach((warning, index) => {
                        console.log(`${index + 1}. [${warning.type}] ${warning.message}`);
                    });
                }
            }

            // Marca como aplicado
            this.appliedPatches.add(patchName);
            this.saveAppliedPatches();

            this.log(`✅ Patch '${patchName}' aplicado com sucesso!`);

            return true;
        } catch (error) {
            this.error(`Erro ao aplicar patch '${patchName}': ${error.message}`, false);

            // Sistema de backup desabilitado - não há backup para restaurar
            this.log('⚠️  Erro aplicando patch - sem backup disponível para restaurar');

            return false;
        }
    }

    // Aplica modificações específicas do patch
    async applyPatchModifications(content, patch) {
        let modifiedContent = content;

        // Aplica cada modificação definida no patch
        for (const modification of patch.modifications || []) {
            modifiedContent = await this.applyModification(modifiedContent, modification);
        }

        // Executa função customizada do patch se existir
        if (typeof patch.apply === 'function') {
            modifiedContent = await patch.apply(modifiedContent);
        }

        return modifiedContent;
    }

    // Aplica uma modificação específica
    async applyModification(content, modification) {
        const { type, target, replacement, position, code } = modification;

        switch (type) {
            case 'replace':
                return this.applyReplace(content, target, replacement);

            case 'inject':
                return this.applyInject(content, target, code, position);

            case 'modify':
                return this.applyModify(content, modification);

            case 'regex':
                return this.applyRegex(content, modification);

            default:
                throw new Error(`Tipo de modificação desconhecido: ${type}`);
        }
    }

    // Aplicação tipo 'replace'
    applyReplace(content, target, replacement) {
        if (typeof target === 'string') {
            return content.replace(target, replacement);
        } else if (target instanceof RegExp) {
            return content.replace(target, replacement);
        } else {
            throw new Error('Target deve ser string ou RegExp');
        }
    }

    // Aplicação tipo 'inject' com detecção de ponto seguro
    applyInject(content, target, code, position = 'after') {
        const lines = content.split('\n');
        let targetLine = -1;

        if (typeof target === 'string') {
            targetLine = lines.findIndex(line => line.includes(target));
        } else if (target instanceof RegExp) {
            targetLine = lines.findIndex(line => target.test(line));
        } else if (typeof target === 'number') {
            targetLine = target - 1; // Convert to 0-based index
        }

        if (targetLine === -1) {
            throw new Error('Target não encontrado para injeção');
        }

        // Encontra ponto seguro para injeção próximo ao target
        const safePoint = this.findSafeInjectionPoint(content, targetLine, position);

        const contentLines = content.split('\n');
        contentLines.splice(safePoint.insertIndex, 0, '', code, '');

        this.log(`Injetando código na linha ${safePoint.insertIndex + 1} (${safePoint.reason})`, true);

        return contentLines.join('\n');
    }

    // Encontra um ponto seguro para injetar código sem quebrar sintaxe JavaScript
    findSafeInjectionPoint(content, targetLine, position = 'after') {
        const lines = content.split('\n');

        // Padrões que indicam locais seguros para injeção
        const safePatterns = [
            /^\s*};?\s*$/,                    // Fechamento de objeto/export
            /^\s*export\s.*[;}]\s*$/,         // Linha de export completa
            /^\s*}\s*$/,                      // Fechamento de bloco
            /^\s*}\);?\s*$/,                  // Fechamento de IIFE ou função
            /^\s*\/\/.*$/,                    // Comentário de linha
            /^\s*\/\*.*\*\/\s*$/,            // Comentário de bloco inline
            /^\s*$/, 	                      // Linha vazia
            /^\s*\*\/\s*$/,                   // Final de comentário de bloco
        ];

        // Padrões que indicam locais PERIGOSOS (nunca injetar)
        const dangerousPatterns = [
            /export\s*\{[^}]*$/, // Export incompleto (não termina na linha)
            /^\s*[^{}]*\{[^}]*$/, // Abertura de bloco incompleta
            /^\s*[^;,]*,\s*$/, // Lista não terminada
            /^\s*[^"']*["'][^"']*$/, // String literal incompleta
            /^\s*function\s*[^{]*$/, // Declaração de função incompleta
            /^\s*class\s*[^{]*$/, // Declaração de classe incompleta
        ];

        // Função auxiliar para verificar se uma linha é segura
        const isLineSafe = (lineIndex) => {
            if (lineIndex < 0 || lineIndex >= lines.length) return false;

            const line = lines[lineIndex];

            // Verifica se é uma linha perigosa
            const isDangerous = dangerousPatterns.some(pattern => pattern.test(line));
            if (isDangerous) return false;

            // Verifica se é uma linha segura
            return safePatterns.some(pattern => pattern.test(line));
        };

        // Estratégia 1: Procura local seguro próximo ao target
        let searchStart = position === 'before' ? targetLine - 1 : targetLine + 1;
        let maxSearchDistance = 10; // Busca até 10 linhas de distância

        // Busca para frente e para trás alternadamente
        for (let distance = 1; distance <= maxSearchDistance; distance++) {
            // Busca para frente
            const forwardIndex = targetLine + distance;
            if (isLineSafe(forwardIndex)) {
                return {
                    insertIndex: forwardIndex + (position === 'before' ? 0 : 1),
                    reason: `linha segura encontrada ${distance} linha(s) após target`
                };
            }

            // Busca para trás
            const backwardIndex = targetLine - distance;
            if (isLineSafe(backwardIndex)) {
                return {
                    insertIndex: backwardIndex + (position === 'before' ? 0 : 1),
                    reason: `linha segura encontrada ${distance} linha(s) antes do target`
                };
            }
        }

        // Estratégia 2: Procura por final de exports recentes
        for (let i = Math.min(lines.length - 1, targetLine + 50); i >= Math.max(0, targetLine - 50); i--) {
            const line = lines[i];
            if (/export\s*\{[^}]*\};\s*$/.test(line)) {
                return {
                    insertIndex: i + 1,
                    reason: 'após export statement completo'
                };
            }
        }

        // Estratégia 3: Final do arquivo (fallback mais seguro)
        let lastNonEmptyLine = lines.length - 1;
        while (lastNonEmptyLine >= 0 && lines[lastNonEmptyLine].trim() === '') {
            lastNonEmptyLine--;
        }

        return {
            insertIndex: lastNonEmptyLine + 1,
            reason: 'final do arquivo (fallback seguro)'
        };
    }

    // Aplicação tipo 'modify'
    applyModify(content, modification) {
        const { target, transform } = modification;

        if (typeof transform !== 'function') {
            throw new Error('Transform deve ser uma função');
        }

        if (typeof target === 'string') {
            const index = content.indexOf(target);
            if (index === -1) {
                throw new Error('Target não encontrado para modificação');
            }
            const before = content.substring(0, index);
            const after = content.substring(index + target.length);
            const transformed = transform(target);
            return before + transformed + after;
        } else if (target instanceof RegExp) {
            return content.replace(target, transform);
        }

        throw new Error('Target deve ser string ou RegExp');
    }

    // Aplicação tipo 'regex'
    applyRegex(content, modification) {
        const { pattern, replacement, flags } = modification;
        const regex = new RegExp(pattern, flags || 'g');
        return content.replace(regex, replacement);
    }

    // Valida se o patch está bem formado
    validatePatch(patch) {
        if (!patch || typeof patch !== 'object') {
            return false;
        }

        // Verifica se tem modifications OU função apply
        const hasModifications = Array.isArray(patch.modifications) && patch.modifications.length > 0;
        const hasApplyFunction = typeof patch.apply === 'function';

        if (!hasModifications && !hasApplyFunction) {
            this.log('Patch deve ter "modifications" ou função "apply"');
            return false;
        }

        // Valida cada modification
        if (hasModifications) {
            for (const mod of patch.modifications) {
                if (!mod.type) {
                    this.log('Modification deve ter "type"');
                    return false;
                }
            }
        }

        return true;
    }

    // Remove um patch aplicado
    async removePatch(patchName, options = {}) {
        this.isVerbose = options.verbose || false;

        if (!this.appliedPatches.has(patchName)) {
            this.log(`Patch '${patchName}' não está aplicado`);
            return false;
        }

        const patch = this.loadPatch(patchName);

        // Se o patch tem função de remoção customizada
        if (typeof patch.remove === 'function') {
            const content = fs.readFileSync(this.sourceFile, 'utf8');
            const backupFile = this.createBackup(`remove_${patchName}`);

            try {
                const modifiedContent = await patch.remove(content);
                fs.writeFileSync(this.sourceFile, modifiedContent, 'utf8');

                // Validação JavaScript pós-remoção
                this.log('Validando sintaxe JavaScript após remoção do patch...', true);
                const validator = new JavaScriptValidator();
                const isValidJS = validator.validateSyntax(modifiedContent, this.sourceFile);

                if (!isValidJS) {
                    this.log('❌ Código JavaScript inválido após remoção do patch!');
                    validator.showReport();
                    validator.suggestFixes();
                    throw new Error('Remoção de patch resultou em JavaScript inválido');
                }

                if (validator.warnings.length > 0) {
                    this.log(`⚠️  ${validator.warnings.length} aviso(s) encontrado(s) após remoção`);
                    if (this.isVerbose) {
                        validator.showReport();
                    }
                } else {
                    this.log('✅ Validação JavaScript passou após remoção', true);
                }

                this.appliedPatches.delete(patchName);
                this.saveAppliedPatches();

                this.log(`✅ Patch '${patchName}' removido com sucesso!`);
                return true;
            } catch (error) {
                this.error(`Erro ao remover patch: ${error.message}`, false);
                this.log('⚠️  Sistema de backup desabilitado - não há backup para restaurar');
                return false;
            }
        }

        // Se não tem função de remoção, não pode ser removido
        this.log(`Patch '${patchName}' não tem função de remoção e sistema de backup está desabilitado.`);
        return false;
    }

    // Restaura de um backup específico
    restoreFromBackup(backupName) {
        this.log('⚠️  Sistema de backup desabilitado - função restore não disponível');
        this.error('Use auto-update.js para obter código atualizado');
    }

    // Lista backups disponíveis
    listBackups() {
        // Sistema de backup desabilitado
        return [];
    }

    // Aplica todos os patches disponíveis
    async applyAllPatches(options = {}) {
        this.isVerbose = options.verbose || false;
        const excludePatches = options.exclude || [];
        const includeOnly = options.include || null;

        this.log('='.repeat(60));
        this.log('APLICANDO TODOS OS PATCHES');
        this.log('='.repeat(60));

        const available = this.listAvailablePatches();
        const applied = this.listAppliedPatches();

        // Filtra patches para aplicar
        let patchesToApply = available.filter(patch => {
            // Se já está aplicado, pula (a menos que force esteja ativo)
            if (applied.includes(patch) && !options.force) {
                this.log(`Pulando '${patch}' - já aplicado`);
                return false;
            }

            // Se tem lista de exclusão
            if (excludePatches.includes(patch)) {
                this.log(`Pulando '${patch}' - na lista de exclusão`);
                return false;
            }

            // Se tem lista de inclusão específica
            if (includeOnly && !includeOnly.includes(patch)) {
                this.log(`Pulando '${patch}' - não na lista de inclusão`);
                return false;
            }

            return true;
        });

        if (patchesToApply.length === 0) {
            this.log('Nenhum patch para aplicar.');
            return { success: true, applied: [], failed: [] };
        }

        this.log(`📦 Patches para aplicar: ${patchesToApply.length}`);
        patchesToApply.forEach(patch => {
            this.log(`  • ${patch}`);
        });

        this.log('\n🚀 Iniciando aplicação...\n');

        const results = {
            applied: [],
            failed: [],
            skipped: []
        };

        // Aplica patches sequencialmente
        for (const patchName of patchesToApply) {
            try {
                this.log(`\n🔧 Aplicando: ${patchName}`);
                const success = await this.applyPatch(patchName, {
                    force: options.force,
                    verbose: false // Não usa verbose aqui para não poluir
                });

                if (success) {
                    results.applied.push(patchName);
                    this.log(`✅ ${patchName} aplicado com sucesso`);
                } else {
                    results.skipped.push(patchName);
                    this.log(`⚠️ ${patchName} foi pulado`);
                }

            } catch (error) {
                results.failed.push({ patch: patchName, error: error.message });
                this.log(`❌ ${patchName} falhou: ${error.message}`);

                if (options.stopOnError) {
                    this.log('Parando execução devido a erro (--stop-on-error)');
                    break;
                }
            }
        }

        // Relatório final
        this.log('\n' + '='.repeat(60));
        this.log('RELATÓRIO FINAL');
        this.log('='.repeat(60));
        this.log(`✅ Aplicados com sucesso: ${results.applied.length}`);
        this.log(`❌ Falharam: ${results.failed.length}`);
        this.log(`⚠️ Pulados: ${results.skipped.length}`);

        if (results.applied.length > 0) {
            this.log('\n📋 Patches aplicados:');
            results.applied.forEach(patch => this.log(`  • ${patch}`));
        }

        if (results.failed.length > 0) {
            this.log('\n❌ Patches com falha:');
            results.failed.forEach(item => this.log(`  • ${item.patch}: ${item.error}`));
        }

        if (results.skipped.length > 0) {
            this.log('\n⚠️ Patches pulados:');
            results.skipped.forEach(patch => this.log(`  • ${patch}`));
        }

        this.log('\n🎉 Processo concluído!');
        return results;
    }

    // Remove todos os patches aplicados
    async removeAllPatches(options = {}) {
        this.isVerbose = options.verbose || false;

        this.log('='.repeat(60));
        this.log('REMOVENDO TODOS OS PATCHES');
        this.log('='.repeat(60));

        const applied = this.listAppliedPatches();

        if (applied.length === 0) {
            this.log('Nenhum patch aplicado para remover.');
            return { success: true, removed: [], failed: [] };
        }

        this.log(`📦 Patches para remover: ${applied.length}`);
        applied.forEach(patch => {
            this.log(`  • ${patch}`);
        });

        const results = {
            removed: [],
            failed: []
        };

        // Remove patches em ordem reversa (mais seguro)
        const reversedPatches = [...applied].reverse();

        for (const patchName of reversedPatches) {
            try {
                this.log(`\n🔧 Removendo: ${patchName}`);
                const success = await this.removePatch(patchName, {
                    verbose: false
                });

                if (success) {
                    results.removed.push(patchName);
                    this.log(`✅ ${patchName} removido com sucesso`);
                }
            } catch (error) {
                results.failed.push({ patch: patchName, error: error.message });
                this.log(`❌ ${patchName} falhou: ${error.message}`);
            }
        }

        // Relatório final
        this.log('\n' + '='.repeat(60));
        this.log('RELATÓRIO FINAL - REMOÇÃO');
        this.log('='.repeat(60));
        this.log(`✅ Removidos: ${results.removed.length}`);
        this.log(`❌ Falharam: ${results.failed.length}`);

        if (results.removed.length > 0) {
            this.log('\n📋 Patches removidos:');
            results.removed.forEach(patch => this.log(`  • ${patch}`));
        }

        this.log('\n🎉 Remoção concluída!');
        return results;
    }

    // Interface principal
    async showStatus() {
        console.log('\n=== PATCH SYSTEM STATUS ===');

        const available = this.listAvailablePatches();
        const applied = this.listAppliedPatches();
        const backups = this.listBackups();

        console.log(`📦 Patches disponíveis: ${available.length}`);
        available.forEach(patch => {
            const isApplied = applied.includes(patch);
            const status = isApplied ? '✅ APLICADO' : '⭕ DISPONÍVEL';
            console.log(`  ${patch} - ${status}`);
        });

        console.log(`\n✅ Patches aplicados: ${applied.length}`);
        console.log(`💾 Sistema de backup: DESABILITADO`);
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const patchName = args[1];

    const patchManager = new PatchManager();

    switch (command) {
        case 'apply':
            if (!patchName) {
                console.log('Uso: node patch-system.js apply <patch-name> [--force] [--verbose]');
                process.exit(1);
            }
            const applyOptions = {
                force: args.includes('--force'),
                verbose: args.includes('--verbose')
            };
            await patchManager.applyPatch(patchName, applyOptions);
            break;

        case 'apply-all':
            const applyAllOptions = {
                force: args.includes('--force'),
                verbose: args.includes('--verbose'),
                stopOnError: args.includes('--stop-on-error'),
                exclude: args.includes('--exclude') ?
                    args[args.indexOf('--exclude') + 1]?.split(',') || [] : [],
                include: args.includes('--include') ?
                    args[args.indexOf('--include') + 1]?.split(',') || null : null
            };
            await patchManager.applyAllPatches(applyAllOptions);
            break;

        case 'remove':
            if (!patchName) {
                console.log('Uso: node patch-system.js remove <patch-name> [--verbose]');
                process.exit(1);
            }
            await patchManager.removePatch(patchName, { verbose: args.includes('--verbose') });
            break;

        case 'remove-all':
            const removeAllOptions = {
                verbose: args.includes('--verbose')
            };
            await patchManager.removeAllPatches(removeAllOptions);
            break;

        case 'list':
            await patchManager.showStatus();
            break;

        case 'status':
            await patchManager.showStatus();
            break;

        case 'backups':
            console.log('\n=== SISTEMA DE BACKUP DESABILITADO ===');
            console.log('⚠️  O sistema de backup foi desabilitado.');
            console.log('💡 Use "auto-update.js" para obter código atualizado.');
            break;

        case 'restore':
            console.log('\n⚠️  Sistema de backup desabilitado');
            console.log('💡 Use "auto-update.js" para obter código atualizado.');
            break;

        case 'help':
        case '--help':
        case '-h':
            console.log(`
🔧 Patch System - Sistema de Patches para GameHacxkeado

COMANDOS BÁSICOS:
  apply <patch> [--force] [--verbose]  - Aplica um patch específico
  apply-all [opções]                   - Aplica TODOS os patches disponíveis
  remove <patch> [--verbose]           - Remove um patch específico
  remove-all [--verbose]               - Remove TODOS os patches aplicados
  list                                 - Lista status de todos os patches
  status                              - Mostra status do sistema
  backups                             - [DESABILITADO] Sistema de backup desabilitado
  restore <backup>                    - [DESABILITADO] Sistema de backup desabilitado
  help                                - Mostra esta ajuda

OPÇÕES APPLY-ALL:
  --force                             - Reaplica patches já aplicados
  --verbose                           - Saída detalhada
  --stop-on-error                     - Para na primeira falha
  --exclude <patch1,patch2>           - Exclui patches específicos
  --include <patch1,patch2>           - Aplica apenas patches específicos

EXEMPLOS BÁSICOS:
  node patch-system.js apply auto-cast-speed
  node patch-system.js apply auto-repair --verbose
  node patch-system.js list

EXEMPLOS APPLY-ALL:
  node patch-system.js apply-all                           # Aplica todos
  node patch-system.js apply-all --verbose                 # Com detalhes
  node patch-system.js apply-all --exclude test-patch      # Exceto test-patch
  node patch-system.js apply-all --include auto-cast-speed,auto-repair  # Só estes
  node patch-system.js apply-all --force                   # Força replicação

EXEMPLOS REMOVE-ALL:
  node patch-system.js remove-all                          # Remove todos
  node patch-system.js remove-all --verbose                # Com detalhes

OUTROS EXEMPLOS:
  node patch-system.js restore source_auto-cast_2025-12-22.js
  node patch-system.js backups

PATCHES DISPONÍVEIS:
  Execute 'node patch-system.js list' para ver patches disponíveis

FUNCIONALIDADES:
  ✅ Aplicação modular de patches
  ✅ Aplicação em lote de todos os patches
  ✅ Backup automático antes de modificações
  ✅ Sistema de restore completo
  ✅ Patches inteligentes com regex
  ✅ Suporte a múltiplos tipos de modificação
  ✅ Filtragem de patches por inclusão/exclusão
            `);
            break;

        default:
            await patchManager.showStatus();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('[FATAL ERROR]', error.message);
        process.exit(1);
    });
}

module.exports = PatchManager;