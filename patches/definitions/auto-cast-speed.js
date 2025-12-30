/**
 * Auto Cast Speed Patch
 *
 * Modifica os delays do sistema de auto cast para permitir velocidades customizadas.
 * Baseado nos padrões identificados no CLAUDE.md para encontrar delays de 500ms-2000ms.
 */

module.exports = {
    name: "Auto Cast Speed",
    description: "Modifica delays do auto cast para velocidades personalizadas",
    version: "1.0.0",
    author: "GameHacxkeado",

    // Configurações de velocidade
    config: {
        speed: 'custom', // slow, normal, fast, ultra_fast, custom
        customDelay: 100, // usado quando speed = 'custom'

        // Presets de velocidade
        presets: {
            slow: 2000,
            normal: 1000,
            fast: 500,
            ultra_fast: 200,
            instant: 50
        }
    },

    // Padrões regex que funcionam mesmo com minificação e comentários anteriores
    patterns: {
        // Padrão 1: const varname = DELAY (com possível comentário), outraVar = 50
        // Lida com comentários de patches anteriores e quebras de linha
        autocastWithFiftyRobust: /const\s+(\w+)\s*=\s*(\d+(?:e\d+)?)(?:\s*,?\s*\/\/[^\n]*)?[\s\n]*(\w+)\s*=\s*50/g,

        // Padrão 2: useEffect com setInterval seguido de delay em ms
        // Estrutura do React não muda na minificação
        reactUseEffectInterval: /reactExports\.useEffect\(\(\)\s*=>\s*\{[\s\S]{1,500}?const\s+\w+\s*=\s*(\d+(?:e\d+)?),[\s\S]{1,300}?setInterval/g,

        // Padrão 3: Busca por delay seguido de quebra de linha e "= 50"
        // Lida com quebras de linha entre delay e "= 50"
        fiftyPatternMultiline: /=\s*(\d+(?:e\d+)?)(?:\s*,?\s*\/\/[^\n]*)?[\s\n]*\w+\s*=\s*50/g,

        // Padrão 4: Delay em contexto de fishing/casting (mais tolerante)
        fishingContextRobust: /const\s+\w+\s*=\s*(\d+(?:e\d+)?)(?:[^\n]*\n)*[\s\S]{0,300}?(?:rotateBoatToTile|toggleTileFished)/g,

        // Padrão 5: Simples busca por número seguido de comentário de patch
        modifiedByPatch: /(\d+)(?:\s*,?\s*)?\/\/[^\n]*Modified by auto-cast-speed patch/g
    },

    modifications: [
        {
            type: 'regex',
            pattern: 'const\\s+(\\w+)\\s*=\\s*(\\d+(?:e\\d+)?),?\\s*(?:\\/\\/.*?)?\\s*\\w+\\s*=\\s*50',
            replacement: function(match, varName, delay) {
                const newDelay = module.exports.getTargetDelay(parseInt(delay));
                return `const ${varName} = ${newDelay}, // Modified by auto-cast-speed patch\n    zr = 50`;
            },
            flags: 'g'
        }
    ],

    // Função principal de aplicação
    async apply(content) {
        const targetDelay = this.getTargetDelay();
        let modifiedContent = content;
        let modificationsCount = 0;

        // Aplica cada padrão
        for (const [patternName, pattern] of Object.entries(this.patterns)) {
            const matches = [...modifiedContent.matchAll(pattern)];

            for (const match of matches) {
                const currentDelay = Number(match[2]); // Suporta notação científica como 2e3

                // Verifica se é um delay de auto cast (500-2000ms)
                if (this.isAutocastDelay(currentDelay)) {
                    const replacement = this.createReplacement(match, targetDelay, patternName);
                    modifiedContent = modifiedContent.replace(match[0], replacement);
                    modificationsCount++;

                    console.log(`[auto-cast-speed] ${patternName}: ${currentDelay}ms → ${targetDelay}ms`);
                }
            }
        }

        if (modificationsCount === 0) {
            console.log('[auto-cast-speed] Nenhum delay de auto cast encontrado para modificar');
        } else {
            console.log(`[auto-cast-speed] ${modificationsCount} delays modificados para ${targetDelay}ms`);
        }

        return modifiedContent;
    },

    // Determina o delay alvo baseado na configuração
    getTargetDelay(originalDelay = null) {
        if (this.config.speed === 'custom') {
            return this.config.customDelay;
        }

        return this.config.presets[this.config.speed] || this.config.presets.fast;
    },

    // Verifica se é um delay de auto cast (range expandido para incluir valores já modificados)
    isAutocastDelay(delay) {
        return delay >= 50 && delay <= 3000; // Aceita delays já modificados e originais
    },

    // Cria replacement baseado no padrão encontrado
    createReplacement(match, targetDelay, patternName) {
        const fullMatch = match[0];
        const varName = match[1];
        const originalDelay = match[2];

        switch (patternName) {
            case 'autocastConstant':
                return fullMatch.replace(originalDelay, targetDelay);

            case 'autocastContext':
                return fullMatch.replace(originalDelay, targetDelay);

            case 'autocastInterval':
                return fullMatch.replace(originalDelay, targetDelay);

            case 'genericDelay':
                return fullMatch.replace(originalDelay, targetDelay);

            default:
                return fullMatch.replace(originalDelay, targetDelay);
        }
    },

    // Função de remoção (restaura delays originais)
    async remove(content) {
        // Busca por comentários do patch para identificar modificações
        const patchComments = /\/\/ Modified by auto-cast-speed patch/g;
        let modifiedContent = content;

        // Remove comentários do patch
        modifiedContent = modifiedContent.replace(patchComments, '');

        console.log('[auto-cast-speed] Patch removido - comentários de modificação limpos');
        console.log('[auto-cast-speed] ATENÇÃO: Para restaurar delays originais, use restore de um backup');

        return modifiedContent;
    },

    // Configurar speed preset
    setSpeed(speed) {
        if (speed === 'custom') {
            this.config.speed = 'custom';
        } else if (this.config.presets.hasOwnProperty(speed)) {
            this.config.speed = speed;
        } else {
            throw new Error(`Speed preset inválido: ${speed}. Use: ${Object.keys(this.config.presets).join(', ')}`);
        }
    },

    // Configurar delay customizado
    setCustomDelay(delay) {
        if (typeof delay !== 'number' || delay < 1 || delay > 10000) {
            throw new Error('Delay customizado deve ser um número entre 1 e 10000ms');
        }
        this.config.customDelay = delay;
        this.config.speed = 'custom';
    },

    // Status atual
    getStatus() {
        const targetDelay = this.getTargetDelay();
        return {
            speed: this.config.speed,
            targetDelay: targetDelay,
            customDelay: this.config.customDelay,
            presets: this.config.presets
        };
    }
};