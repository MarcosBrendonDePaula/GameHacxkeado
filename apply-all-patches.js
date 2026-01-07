#!/usr/bin/env node

/**
 * Apply All Patches - Script conveniente para aplicar todos os patches de uma vez
 *
 * Este script aplica automaticamente todos os patches essenciais do GameHacxkeado:
 * - config-system: Sistema central de configurações
 * - auto-cast-speed: Modifica velocidade do auto cast
 * - super-cast-speed: Modifica velocidade do super cast
 * - auto-repair: Sistema de auto repair
 * - config-menu: Menu visual de configurações
 * - render-toggle: Controle de renderização via config system
 */

const PatchManager = require('./patch-system.js');

async function applyAllPatches() {
    console.log('🎮 GameHacxkeado - Aplicando Todos os Patches');
    console.log('='.repeat(50));

    const patchManager = new PatchManager();

    // Define patches essenciais em ordem de prioridade
    const essentialPatches = [
        'config-system',
        'auto-cast-speed',
        'super-cast-speed',
        'auto-repair',
        'config-menu',
        'render-toggle'
    ];

    try {
        // Primeiro verifica se source.js existe
        const fs = require('fs');
        const path = require('path');
        const sourceFile = path.join(process.cwd(), 'source.js');

        if (!fs.existsSync(sourceFile)) {
            console.log('❌ source.js não encontrado!');
            console.log('💡 Execute primeiro o unminify para gerar o source.js:');
            console.log('   ./unminify.sh');
            process.exit(1);
        }

        // Verifica patches disponíveis
        const available = patchManager.listAvailablePatches();
        const applied = patchManager.listAppliedPatches();

        console.log(`📦 Patches disponíveis: ${available.length}`);
        console.log(`✅ Patches já aplicados: ${applied.length}`);
        console.log('');

        // Filtra apenas patches essenciais que existem e não estão aplicados
        const patchesToApply = essentialPatches.filter(patch => {
            if (!available.includes(patch)) {
                console.log(`⚠️ Patch '${patch}' não encontrado - pulando`);
                return false;
            }
            if (applied.includes(patch)) {
                console.log(`✅ Patch '${patch}' já aplicado - pulando`);
                return false;
            }
            return true;
        });

        if (patchesToApply.length === 0) {
            console.log('🎉 Todos os patches essenciais já estão aplicados!');
            console.log('');
            console.log('📊 Status atual:');
            await patchManager.showStatus();
            return;
        }

        console.log(`🚀 Aplicando ${patchesToApply.length} patches essenciais:`);
        patchesToApply.forEach(patch => {
            console.log(`   • ${patch}`);
        });
        console.log('');

        let successCount = 0;
        let failCount = 0;

        // Aplica cada patch sequencialmente
        for (const patchName of patchesToApply) {
            console.log(`🔧 Aplicando: ${patchName}`);

            try {
                const success = await patchManager.applyPatch(patchName, {
                    verbose: false,
                    force: false
                });

                if (success) {
                    console.log(`✅ ${patchName} aplicado com sucesso!`);
                    successCount++;
                } else {
                    console.log(`⚠️ ${patchName} foi pulado`);
                }

            } catch (error) {
                console.log(`❌ ${patchName} falhou: ${error.message}`);
                failCount++;
            }

            console.log(''); // Linha em branco para separar
        }

        // Relatório final
        console.log('='.repeat(50));
        console.log('📋 RELATÓRIO FINAL');
        console.log('='.repeat(50));
        console.log(`✅ Aplicados com sucesso: ${successCount}`);
        console.log(`❌ Falharam: ${failCount}`);
        console.log(`⚠️ Pulados: ${patchesToApply.length - successCount - failCount}`);
        console.log('');

        if (successCount > 0) {
            console.log('🎉 Patches aplicados com sucesso!');
            console.log('');
            console.log('💡 Próximos passos:');
            console.log('   • Use o source.js modificado no seu projeto');
            console.log('   • Pressione Ctrl+Shift+C no jogo para abrir o menu (se config-menu foi aplicado)');
            console.log('   • Use AutoRepair.enable() para ativar auto repair (se foi aplicado)');
            console.log('');
            console.log('📊 Status final:');
            await patchManager.showStatus();
        } else {
            console.log('😕 Nenhum patch foi aplicado com sucesso.');
            console.log('💡 Verifique os erros acima ou execute com --verbose para mais detalhes');
        }

    } catch (error) {
        console.error('💥 Erro fatal:', error.message);
        process.exit(1);
    }
}

// Executa se chamado diretamente
if (require.main === module) {
    applyAllPatches().catch(error => {
        console.error('💥 Erro fatal:', error.message);
        process.exit(1);
    });
}

module.exports = applyAllPatches;
