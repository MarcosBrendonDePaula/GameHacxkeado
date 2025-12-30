#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Find Durability Lines
Script para encontrar as linhas específicas do playerState onde inserir código de monitoramento

Encontra pontos estratégicos para monitorar:
- Onde playerState é atualizado
- Onde durabilidade é verificada
- Onde casts são processados
"""

import re
import os
import argparse
from typing import List, Dict, Any


class DurabilityLineFinder:
    """Classe para encontrar linhas específicas para monitoramento"""

    def __init__(self, source_file: str = "source.js"):
        self.source_file = source_file
        self.source_code = ""
        self.patterns = self._create_patterns()

    def _create_patterns(self) -> Dict[str, List[str]]:
        """Cria padrões regex para encontrar pontos de inserção"""
        return {
            # Pontos onde playerState é atualizado/definido
            "playerstate_updates": [
                # Padrão 1: Linha onde playerState é retornado pelo hook
                r"playerState:\s*O,",

                # Padrão 2: Onde playerState é setado (setPlayerStateFromDecoded)
                r"setPlayerStateFromDecoded.*_e",

                # Padrão 3: Atualização direta do playerState
                r"U\(\{\s*owner.*currentDurability.*maxDurability",

                # Padrão 4: Fetch do playerState
                r"await\s+b\.account\.playerState\.fetch\(.*\)",
            ],

            # Pontos onde durabilidade é verificada/usada
            "durability_checks": [
                # Padrão 1: Verificação se pode fazer cast
                r"dr\.currentDurability.*<=\s*0",

                # Padrão 2: Cálculo de durabilidade esperada
                r"calculateExpectedDurability\(.*dr\.maxDurability.*\)",

                # Padrão 3: Verificação de reparo
                r"dr\.currentDurability.*dr\.maxDurability.*0\.2",

                # Padrão 4: Display de durabilidade
                r"dr\.currentDurability\.toLocaleString\(\)",
            ],

            # Pontos onde casts são processados
            "cast_processing": [
                # Padrão 1: Processamento de cast
                r"\.castLine\(",

                # Padrão 2: Record catch
                r"\.recordCatch\(",

                # Padrão 3: Auto cast trigger
                r"xe\.current\.toggleTileFished",

                # Padrão 4: Manual cast
                r"audioManager\.playTileTapSound\(\)",
            ],

            # Pontos críticos para monitoramento
            "monitoring_points": [
                # Padrão 1: Início da função usePlayerState
                r"const usePlayerState = \(\) => \{",

                # Padrão 2: Linha de refresh do playerState
                r"refresh:\s*ue,",

                # Padrão 3: Constante dr = usePlayerState
                r"const.*=.*usePlayerState\(\)",

                # Padrão 4: Destructuring do playerState
                r"\{\s*globalState.*playerState.*\}\s*=.*usePlayerState",
            ]
        }

    def load_source_code(self) -> bool:
        """Carrega o código fonte"""
        try:
            if not os.path.exists(self.source_file):
                print(f"ERRO: Arquivo {self.source_file} não encontrado!")
                return False

            with open(self.source_file, 'r', encoding='utf-8', errors='ignore') as f:
                self.source_code = f.read()

            print(f"Código carregado: {len(self.source_code):,} caracteres")
            return True

        except Exception as e:
            print(f"ERRO: {e}")
            return False

    def find_durability_lines(self) -> Dict[str, List[Dict[str, Any]]]:
        """Encontra todas as linhas relevantes para monitoramento"""
        print("\nProcurando linhas para inserir monitoramento...\n")

        results = {
            "playerstate_updates": [],
            "durability_checks": [],
            "cast_processing": [],
            "monitoring_points": []
        }

        for category, patterns in self.patterns.items():
            print(f"=== {category.replace('_', ' ').upper()} ===")

            for i, pattern in enumerate(patterns):
                matches = re.finditer(pattern, self.source_code, re.MULTILINE | re.DOTALL)

                for match in matches:
                    line_number = self.source_code[:match.start()].count('\n') + 1

                    # Pegar linha completa
                    line_start = self.source_code.rfind('\n', 0, match.start()) + 1
                    line_end = self.source_code.find('\n', match.end())
                    if line_end == -1:
                        line_end = len(self.source_code)

                    full_line = self.source_code[line_start:line_end].strip()
                    context = self._get_context_lines(line_number, 3)

                    result = {
                        "pattern": i + 1,
                        "line": line_number,
                        "match": match.group(0),
                        "full_line": full_line,
                        "context": context,
                        "insertion_point": self._suggest_insertion_point(category, full_line, line_number)
                    }

                    results[category].append(result)

                    print(f"  [OK] Padrao {i + 1}: Linha {line_number}")
                    # Limitar match para evitar problemas de encoding
                    match_text = match.group(0)[:50].replace('\n', ' ').strip()
                    match_text = ''.join(c for c in match_text if ord(c) < 127 or c.isspace())
                    print(f"       Match: {match_text}...")
                    # Limitar linha para evitar problemas de encoding
                    clean_line = full_line[:80].replace('\n', ' ').strip()
                    # Remover caracteres não-ASCII problemáticos
                    clean_line = ''.join(c for c in clean_line if ord(c) < 127 or c.isspace())
                    print(f"       Linha completa: {clean_line}...")
                    print(f"       Ponto de insercao: {result['insertion_point']}")
                    print()

        return results

    def _get_context_lines(self, line_number: int, context_size: int = 3) -> List[str]:
        """Obtém linhas de contexto ao redor da linha alvo"""
        lines = self.source_code.split('\n')
        start_line = max(0, line_number - context_size - 1)
        end_line = min(len(lines), line_number + context_size)

        context = []
        for i in range(start_line, end_line):
            prefix = ">>>" if i == line_number - 1 else "   "
            context.append(f"{prefix} {i + 1:4d}: {lines[i]}")

        return context

    def _suggest_insertion_point(self, category: str, full_line: str, line_number: int) -> str:
        """Sugere onde inserir o código de monitoramento"""
        if category == "playerstate_updates":
            if "playerState: O," in full_line:
                return f"APÓS linha {line_number} - inserir logo após definir playerState"
            elif "setPlayerStateFromDecoded" in full_line:
                return f"APÓS linha {line_number} - inserir após atualização do state"
            elif "fetch(" in full_line:
                return f"APÓS linha {line_number} - inserir após fetch do playerState"
            else:
                return f"PRÓXIMO à linha {line_number}"

        elif category == "durability_checks":
            return f"ANTES da linha {line_number} - inserir antes da verificação"

        elif category == "cast_processing":
            return f"APÓS linha {line_number} - inserir após processamento do cast"

        elif category == "monitoring_points":
            if "usePlayerState" in full_line:
                return f"DENTRO da função, após linha {line_number}"
            else:
                return f"PRÓXIMO à linha {line_number}"

        return f"Linha {line_number}"

    def generate_insertion_guide(self, results: Dict[str, List[Dict[str, Any]]]) -> str:
        """Gera um guia de onde inserir código de monitoramento"""
        guide = """
=== GUIA DE INSERÇÃO DE CÓDIGO DE MONITORAMENTO ===

Este guia mostra os melhores locais para inserir código que monitore a durabilidade da vara.

"""

        # Priorizar pontos mais importantes
        priority_order = [
            ("playerstate_updates", "ATUALIZAÇÃO DO PLAYERSTATE"),
            ("monitoring_points", "PONTOS DE MONITORAMENTO"),
            ("durability_checks", "VERIFICAÇÕES DE DURABILIDADE"),
            ("cast_processing", "PROCESSAMENTO DE CASTS")
        ]

        for category, title in priority_order:
            if category in results and results[category]:
                guide += f"\n{title}:\n" + "="*50 + "\n"

                for result in results[category][:3]:  # Top 3 de cada categoria
                    guide += f"""
Linha {result['line']}: {result['insertion_point']}
Código encontrado: {result['match']}
Linha completa: {result['full_line'][:80]}...

Contexto:
"""
                    for context_line in result['context']:
                        guide += f"  {context_line}\n"

                    guide += f"""
SUGESTÃO DE CÓDIGO:
```javascript
// Monitoramento de durabilidade - inserir {result['insertion_point'].lower()}
console.log('DURABILITY:', {{
    current: dr?.currentDurability || 0,
    max: dr?.maxDurability || 0,
    percentage: Math.round((dr?.currentDurability || 0) / (dr?.maxDurability || 1) * 100),
    timestamp: Date.now(),
    lastUpdate: dr?.lastDurabilityTs || '0'
}});
```

"""

        guide += """
=== EXEMPLO DE USO COMPLETO ===

Para monitorar durabilidade em tempo real, insira este código após as atualizações do playerState:

```javascript
// Monitor de durabilidade
if (dr?.currentDurability !== undefined) {
    const durabilityInfo = {
        current: dr.currentDurability,
        max: dr.maxDurability,
        percentage: Math.round((dr.currentDurability / dr.maxDurability) * 100),
        canRepair: dr.currentDurability <= (dr.maxDurability * 0.2),
        needsRepair: dr.currentDurability === 0,
        timestamp: Date.now(),
        lastUpdate: parseInt(dr.lastDurabilityTs || '0')
    };

    // Log para console
    console.log('🔧 DURABILITY UPDATE:', durabilityInfo);

    // Salvar no localStorage para análise
    localStorage.setItem('durabilityLog', JSON.stringify(durabilityInfo));

    // Trigger custom event para outros scripts
    window.dispatchEvent(new CustomEvent('durabilityUpdate', { detail: durabilityInfo }));
}
```

=== DICAS IMPORTANTES ===

1. Insira o código APÓS as atualizações do playerState, não antes
2. Use dr?.currentDurability para evitar erros se dr for null
3. Considere usar console.log apenas para debug, não em produção
4. localStorage pode ser usado para persistir dados entre sessões
5. Custom events permitem comunicação com outros scripts
"""

        return guide

    def save_results(self, results: Dict[str, List[Dict[str, Any]]], guide: str,
                    output_file: str = "durability_insertion_points.json") -> bool:
        """Salva resultados e guia"""
        try:
            import json

            output_data = {
                "generated_at": f"{__import__('datetime').datetime.now().isoformat()}",
                "source_file": self.source_file,
                "insertion_points": results,
                "guide": guide
            }

            output_path = os.path.join(os.path.dirname(__file__), output_file)

            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)

            # Salvar guia em arquivo separado
            guide_path = output_path.replace('.json', '_guide.txt')
            with open(guide_path, 'w', encoding='utf-8') as f:
                f.write(guide)

            print(f"Resultados salvos em: {output_path}")
            print(f"Guia salvo em: {guide_path}")
            return True

        except Exception as e:
            print(f"ERRO ao salvar: {e}")
            return False


def main():
    """Função principal"""
    parser = argparse.ArgumentParser(description="Find Durability Lines")
    parser.add_argument("--file", "-f", default="source.js", help="Arquivo source.js")
    parser.add_argument("--output", "-o", default="durability_insertion_points.json", help="Arquivo de saída")

    args = parser.parse_args()

    print("Find Durability Lines v1.0")
    print("=" * 40)
    print()

    # Determinar caminho do arquivo
    if not os.path.isabs(args.file):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.join(current_dir, "..", "..")
        source_path = os.path.join(project_root, args.file)

        if os.path.exists(source_path):
            args.file = source_path

    # Criar instância do finder
    finder = DurabilityLineFinder(args.file)

    # Carregar código
    if not finder.load_source_code():
        return 1

    # Encontrar linhas
    results = finder.find_durability_lines()

    # Gerar guia
    guide = finder.generate_insertion_guide(results)

    # Mostrar resumo
    total_points = sum(len(points) for points in results.values())
    print(f"\nResumo: {total_points} pontos de inserção encontrados")

    for category, points in results.items():
        if points:
            print(f"  {category}: {len(points)} pontos")

    # Salvar resultados
    finder.save_results(results, guide, args.output)

    print(f"\nUse os pontos encontrados para inserir código de monitoramento!")
    print("Consulte o arquivo _guide.txt para instruções detalhadas.")

    return 0


if __name__ == "__main__":
    exit(main())