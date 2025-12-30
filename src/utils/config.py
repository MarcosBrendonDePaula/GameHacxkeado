"""
Configurações para os tools de modificação do jogo
"""

# Configurações padrão dos delays
DEFAULT_DELAYS = {
    "auto_cast_normal": 1000,  # 1 segundo
    "super_cast": 100,         # 0.1 segundo
}

# Configurações alternativas de velocidade
SPEED_PRESETS = {
    "slow": {
        "auto_cast_normal": 2000,  # 2 segundos
        "super_cast": 300,         # 0.3 segundos
    },
    "normal": {
        "auto_cast_normal": 1000,  # 1 segundo
        "super_cast": 200,         # 0.2 segundos
    },
    "fast": {
        "auto_cast_normal": 500,   # 0.5 segundos
        "super_cast": 100,         # 0.1 segundos
    },
    "ultra_fast": {
        "auto_cast_normal": 200,   # 0.2 segundos
        "super_cast": 50,          # 0.05 segundos
    }
}

# Arquivos padrão
DEFAULT_FILES = {
    "source": "source.js",
    "output_json": "autocast_delays_results.json",
    "backup": "source.js.backup"
}

# Padrões regex mais específicos
ADVANCED_PATTERNS = {
    "auto_cast_contexts": [
        # Contextos específicos onde o auto cast pode estar
        r"(?:autocast|auto.cast|autoCast)[\s\S]{1,500}?(\d+(?:e\d+)?)",
        r"(?:ft\s*&&|ft\s*\|\|)[\s\S]{1,300}?(\d+(?:e\d+)?)",
        r"setInterval[\s\S]{1,100}?},\s*(\d+(?:e\d+)?)\)",
    ],

    "super_cast_contexts": [
        # Contextos específicos do super cast
        r"(?:supercast|super.cast|superCast)[\s\S]{1,500}?(\d+)",
        r"(?:ct\s*&&|ct\s*\|\|)[\s\S]{1,300}?(\d+)",
        r"SUPERCAST[\s\S]{1,800}?},\s*(\d+)\);",
    ]
}