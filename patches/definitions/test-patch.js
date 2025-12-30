/**
 * Test Patch - Simples patch para testar o sistema
 */

module.exports = {
    name: "Test Patch",
    description: "Patch simples para testar o sistema",
    version: "1.0.0",
    author: "GameHacxkeado",

    // Função principal de aplicação
    async apply(content) {
        console.log('[test-patch] Aplicando patch de teste...');

        // Adiciona comentário simples no início do arquivo
        const testComment = '\n// ===== TEST PATCH APLICADO COM SUCESSO =====\n';

        const modifiedContent = testComment + content;

        console.log('[test-patch] Patch de teste aplicado com sucesso!');
        return modifiedContent;
    },

    // Função de remoção
    async remove(content) {
        console.log('[test-patch] Removendo patch de teste...');

        const testComment = '\n// ===== TEST PATCH APLICADO COM SUCESSO =====\n';
        const modifiedContent = content.replace(testComment, '');

        console.log('[test-patch] Patch de teste removido com sucesso!');
        return modifiedContent;
    }
};