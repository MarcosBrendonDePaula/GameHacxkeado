/**
 * Super Cast Speed Patch
 *
 * Modifica os delays do sistema de super cast para velocidades rápidas customizadas.
 * Baseado nos padrões para delays de 100ms-300ms identificados no CLAUDE.md.
 */

module.exports = {
    name: "Super Cast Speed",
    description: "Modifica delays do super cast para velocidades ultra-rápidas",
    version: "1.0.0",
    author: "GameHacxkeado",

    // Configurações de velocidade para super cast
    config: {
        speed: 'fast', // slow, normal, fast, ultra_fast, instant
        customDelay: 100, // usado quando speed = 'custom'

        // Presets específicos para super cast (delays menores)
        presets: {
            slow: 300,
            normal: 200,
            fast: 100,
            ultra_fast: 50,
            instant: 10
        }
    },

    // Padrões regex que funcionam mesmo com minificação
    patterns: {
        // Padrão 1: audioManager.playTileTapSound() seguido de toggleTileFished e delay
        // Esses nomes de função não mudam na minificação
        tapSoundWithToggle: /audioManager\.playTileTapSound\(\)[\s\S]{1,150}?toggleTileFished[\s\S]{1,100}?},\s*(\d+)\);/g,

        // Padrão 2: setInterval com delay pequeno em contexto do super cast
        // Procura por setInterval(() => { ... toggleTileFished ... }, DELAY);
        supercastInterval: /setInterval\(\(\)\s*=>\s*\{[\s\S]{1,500}?toggleTileFished[\s\S]{1,200}?},\s*(\d+)\);/g,

        // Padrão 3: Delay após rotateBoatToTile e audioManager.playTileTapSound()
        boatRotateWithSound: /rotateBoatToTile[\s\S]{1,100}?audioManager\.playTileTapSound\(\)[\s\S]{1,100}?},\s*(\d+)\);/g,

        // Padrão 4: Qualquer delay pequeno (50-500ms) após toggleTileFished
        toggleFishedDelay: /toggleTileFished\([^)]+\)[\s\S]{0,50}?\);?\s*},\s*(\d{1,3})\);/g,

        // Padrão 5: useEffect com setInterval e delay pequeno (específico do super cast)
        useEffectSmallInterval: /reactExports\.useEffect\(\(\)\s*=>\s*\{[\s\S]{1,300}?setInterval\([\s\S]{1,500}?},\s*(\d{1,3})\);/g
    },

    // Função principal de aplicação
    async apply(content) {
        const targetDelay = this.getTargetDelay();
        let modifiedContent = content;
        let modificationsCount = 0;

        console.log(`[super-cast-speed] Aplicando velocidade: ${this.config.speed} (${targetDelay}ms)`);

        // Aplica cada padrão
        for (const [patternName, pattern] of Object.entries(this.patterns)) {
            const matches = [...modifiedContent.matchAll(pattern)];

            for (const match of matches) {
                const currentDelay = parseInt(match[1]);

                // Verifica se é um delay de super cast (100-300ms)
                if (this.isSupercastDelay(currentDelay)) {
                    const replacement = this.createReplacement(match, targetDelay, patternName);
                    if (replacement !== match[0]) {
                        modifiedContent = modifiedContent.replace(match[0], replacement);
                        modificationsCount++;

                        console.log(`[super-cast-speed] ${patternName}: ${currentDelay}ms → ${targetDelay}ms`);
                    }
                }
            }
        }

        // Padrão específico mais agressivo para super cast
        modifiedContent = this.applySpecificSupercastPattern(modifiedContent, targetDelay);

        if (modificationsCount === 0) {
            console.log('[super-cast-speed] Nenhum delay de super cast encontrado para modificar');
        } else {
            console.log(`[super-cast-speed] ${modificationsCount} delays modificados para ${targetDelay}ms`);
        }

        return modifiedContent;
    },

    // Aplica padrão específico conhecido do super cast
    applySpecificSupercastPattern(content, targetDelay) {
        // Padrão específico baseado no código típico do jogo
        const specificPattern = /(audioManager\.playTileTapSound\(\)[^}]*?xe\.current\.toggleTileFished[^}]*?},\s*)(\d+)(\);\s*return)/g;

        return content.replace(specificPattern, (match, before, delay, after) => {
            const currentDelay = parseInt(delay);
            if (this.isSupercastDelay(currentDelay)) {
                console.log(`[super-cast-speed] Padrão específico: ${currentDelay}ms → ${targetDelay}ms`);
                return `${before}${targetDelay} /* Modified by super-cast-speed patch */${after}`;
            }
            return match;
        });
    },

    // Determina o delay alvo baseado na configuração
    getTargetDelay() {
        if (this.config.speed === 'custom') {
            return this.config.customDelay;
        }

        return this.config.presets[this.config.speed] || this.config.presets.fast;
    },

    // Verifica se o delay é de super cast (range típico)
    isSupercastDelay(delay) {
        return delay >= 50 && delay <= 500; // Range mais amplo para capturar super cast
    },

    // Cria replacement baseado no padrão encontrado
    createReplacement(match, targetDelay, patternName) {
        const fullMatch = match[0];
        const originalDelay = match[1];

        switch (patternName) {
            case 'tapSoundDelay':
                return fullMatch.replace(
                    `}, ${originalDelay});`,
                    `}, ${targetDelay}); // Modified by super-cast-speed patch`
                );

            case 'toggleFishedDelay':
                return fullMatch.replace(
                    `}, ${originalDelay});`,
                    `}, ${targetDelay}); // Modified by super-cast-speed patch`
                );

            case 'supercastContext':
                return fullMatch.replace(
                    `}, ${originalDelay});`,
                    `}, ${targetDelay}); // Modified by super-cast-speed patch`
                );

            case 'smallTimeouts':
                return fullMatch.replace(
                    `, ${originalDelay})`,
                    `, ${targetDelay}) // Modified by super-cast-speed patch`
                );

            case 'superContext':
                // Para este caso, substitui apenas se for um número isolado
                if (fullMatch.match(/\d+ms/)) {
                    return fullMatch.replace(originalDelay + 'ms', targetDelay + 'ms');
                }
                return fullMatch.replace(originalDelay, targetDelay);

            default:
                return fullMatch.replace(originalDelay, targetDelay);
        }
    },

    // Função de remoção
    async remove(content) {
        // Remove comentários do patch
        const patchComments = /\/\/ Modified by super-cast-speed patch|\s*\/\* Modified by super-cast-speed patch \*\//g;
        let modifiedContent = content.replace(patchComments, '');

        console.log('[super-cast-speed] Patch removido - comentários de modificação limpos');
        console.log('[super-cast-speed] ATENÇÃO: Para restaurar delays originais, use restore de um backup');

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
        if (typeof delay !== 'number' || delay < 1 || delay > 1000) {
            throw new Error('Delay customizado deve ser um número entre 1 e 1000ms');
        }
        this.config.customDelay = delay;
        this.config.speed = 'custom';
    },

    // Buscar delays atuais no código
    findCurrentDelays(content) {
        const found = [];

        for (const [patternName, pattern] of Object.entries(this.patterns)) {
            const matches = [...content.matchAll(pattern)];
            for (const match of matches) {
                const delay = parseInt(match[1]);
                if (this.isSupercastDelay(delay)) {
                    found.push({
                        pattern: patternName,
                        delay: delay,
                        context: match[0].substring(0, 100) + '...'
                    });
                }
            }
        }

        return found;
    },

    // Status atual
    getStatus() {
        const targetDelay = this.getTargetDelay();
        return {
            speed: this.config.speed,
            targetDelay: targetDelay,
            customDelay: this.config.customDelay,
            presets: this.config.presets,
            type: 'super-cast'
        };
    }
};