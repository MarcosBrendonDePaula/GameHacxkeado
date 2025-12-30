#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Auto Cast Delay Finder
Script para encontrar automaticamente os delays do auto cast no source.js
Funciona mesmo se o código mudar nas próximas versões

Author: Game Analyzer
Version: 1.0
"""

import re
import os
import json
import argparse
from typing import List, Dict, Any, Tuple


class AutoCastDelayFinder:
    """Classe para encontrar e modificar delays do auto cast"""

    def __init__(self, source_file: str = "source.js"):
        self.source_file = source_file
        self.source_code = ""
        self.patterns = self._create_patterns()
        self.results = {
            "auto_cast_normal": [],
            "super_cast": []
        }

    def _create_patterns(self) -> Dict[str, List[str]]:
        """Cria os padrões regex para encontrar os delays"""
        return {
            # Auto Cast Normal (delay principal - geralmente 500ms-2000ms)
            "auto_cast_normal": [
                # Padrão 1: Declaração da constante com delay
                r"const\s+(\w+)\s*=\s*(\d+(?:e\d+)?),?\s*(?://.*?)?\s*\w+\s*=\s*50",

                # Padrão 2: Contexto específico do auto cast
                r"if\s*\(!ft\s*\|\|\s*!xe\.current\)[\s\S]*?const\s+(\w+)\s*=\s*(\d+(?:e\d+)?)",

                # Padrão 3: SetInterval que usa a variável de delay
                r"const\s+(\w+)\s*=\s*(\d+(?:e\d+)?),[\s\S]{1,200}?setInterval\([^,]*?,\s*\1\)",

                # Padrão 4: Busca direta por delays próximos ao auto cast
                r"(?:auto|cast|ft)[\s\S]{1,300}?(\w+)\s*=\s*(\d+(?:e\d+)?),",
            ],

            # Super Cast (delay rápido - geralmente 100ms-300ms)
            "super_cast": [
                # Padrão 1: Delay após som de tap
                r"audioManager\.playTileTapSound\(\)[\s\S]{1,100}?},\s*(\d+)\);",

                # Padrão 2: Contexto do toggleTileFished
                r"toggleTileFished[\s\S]{1,100}?},\s*(\d+)\);\s*return\s*\(\)\s*=>",

                # Padrão 3: Contexto de SUPERCAST
                r"SUPERCAST[\s\S]{1,500}?},\s*(\d+)\);",

                # Padrão 4: Busca por delays baixos em contexto de super cast
                r"(?:super|fast|quick)[\s\S]{1,200}?},\s*(\d+)\);",
            ]
        }

    def load_source_code(self) -> bool:
        """Carrega o código fonte do arquivo"""
        try:
            if not os.path.exists(self.source_file):
                print(f"ERRO: Arquivo {self.source_file} não encontrado!")
                return False

            with open(self.source_file, 'r', encoding='utf-8', errors='ignore') as f:
                self.source_code = f.read()

            print(f"Código carregado: {len(self.source_code):,} caracteres")
            return True

        except Exception as e:
            print(f"ERRO: Erro ao carregar arquivo: {e}")
            return False

    def _get_line_number(self, position: int) -> int:
        """Retorna o número da linha para uma posição no texto"""
        return self.source_code[:position].count('\n') + 1

    def _parse_delay_value(self, delay_str: str) -> int:
        """Converte string de delay para millisegundos"""
        if 'e' in delay_str.lower():
            return int(float(delay_str))
        return int(delay_str)

    def find_delays(self) -> Dict[str, List[Dict[str, Any]]]:
        """Encontra todos os delays do auto cast"""
        print("\nProcurando delays do Auto Cast...\n")

        # Buscar Auto Cast Normal
        print("Auto Cast Normal (delay principal):")
        for i, pattern in enumerate(self.patterns["auto_cast_normal"]):
            matches = re.finditer(pattern, self.source_code, re.MULTILINE | re.DOTALL)

            for match in matches:
                line_number = self._get_line_number(match.start())

                # Determinar qual grupo contém o delay
                delay = None
                for group_num in range(1, len(match.groups()) + 1):
                    if match.group(group_num) and re.match(r'\d+(?:e\d+)?', match.group(group_num)):
                        delay = match.group(group_num)
                        break

                if delay:
                    delay_ms = self._parse_delay_value(delay)
                    context = match.group(0)[:100] + "..." if len(match.group(0)) > 100 else match.group(0)

                    result = {
                        "pattern": i + 1,
                        "line": line_number,
                        "delay": delay,
                        "delay_ms": delay_ms,
                        "context": context,
                        "full_match": match.group(0)
                    }

                    self.results["auto_cast_normal"].append(result)

                    print(f"  [OK] Padrão {i + 1}: Linha {line_number} - Delay: {delay} ({delay_ms}ms)")
                    print(f"       Contexto: {context}")

        # Buscar Super Cast
        print("\nSuper Cast (delay rápido):")
        for i, pattern in enumerate(self.patterns["super_cast"]):
            matches = re.finditer(pattern, self.source_code, re.MULTILINE | re.DOTALL)

            for match in matches:
                line_number = self._get_line_number(match.start())
                delay = match.group(1) if match.group(1) else match.group(2)
                delay_ms = self._parse_delay_value(delay)
                context = match.group(0)[:100] + "..." if len(match.group(0)) > 100 else match.group(0)

                result = {
                    "pattern": i + 1,
                    "line": line_number,
                    "delay": delay,
                    "delay_ms": delay_ms,
                    "context": context,
                    "full_match": match.group(0)
                }

                self.results["super_cast"].append(result)

                print(f"  [OK] Padrão {i + 1}: Linha {line_number} - Delay: {delay} ({delay_ms}ms)")
                print(f"       Contexto: {context}")

        return self.results

    def generate_modification_commands(self) -> Dict[str, str]:
        """Gera comandos para modificar os delays"""
        print("\nComandos para modificar os delays:\n")

        commands = {}

        if self.results["auto_cast_normal"]:
            # Pegar o delay mais relevante (menor valor, provavelmente o ativo)
            auto_cast_delays = sorted(self.results["auto_cast_normal"], key=lambda x: x["delay_ms"])
            best_match = auto_cast_delays[0]

            print("Auto Cast Normal:")
            print(f"   Linha {best_match['line']}: Alterar '{best_match['delay']}' para '1000' (1000ms)")

            commands["auto_cast"] = {
                "line": best_match['line'],
                "old_value": best_match['delay'],
                "new_value": "1000",
                "command": f"sed -i '{best_match['line']}s/{best_match['delay']}/1000/g' source.js"
            }

        if self.results["super_cast"]:
            # Pegar o delay mais relevante
            super_cast_delays = sorted(self.results["super_cast"], key=lambda x: x["delay_ms"])
            best_match = super_cast_delays[0]

            print("Super Cast:")
            print(f"   Linha {best_match['line']}: Alterar '{best_match['delay']}' para '100' (100ms)")

            commands["super_cast"] = {
                "line": best_match['line'],
                "old_value": best_match['delay'],
                "new_value": "100",
                "command": f"sed -i '{best_match['line']}s/}}, {best_match['delay']});/}}, 100);/g' source.js"
            }

        return commands

    def apply_modifications(self, auto_cast_delay: int = 1000, super_cast_delay: int = 100) -> bool:
        """Aplica as modificações diretamente no arquivo"""
        print(f"\nAplicando modificações...")
        print(f"   Auto Cast: {auto_cast_delay}ms")
        print(f"   Super Cast: {super_cast_delay}ms")

        try:
            new_content = self.source_code

            # Modificar Auto Cast Normal
            if self.results["auto_cast_normal"]:
                auto_cast_delays = sorted(self.results["auto_cast_normal"], key=lambda x: x["delay_ms"])
                best_match = auto_cast_delays[0]

                old_pattern = best_match['delay']
                new_content = new_content.replace(old_pattern, str(auto_cast_delay), 1)
                print(f"[OK] Auto Cast alterado de {old_pattern} para {auto_cast_delay}ms")

            # Modificar Super Cast
            if self.results["super_cast"]:
                super_cast_delays = sorted(self.results["super_cast"], key=lambda x: x["delay_ms"])
                best_match = super_cast_delays[0]

                old_pattern = f"}}, {best_match['delay']});"
                new_pattern = f"}}, {super_cast_delay});"
                new_content = new_content.replace(old_pattern, new_pattern, 1)
                print(f"[OK] Super Cast alterado de {best_match['delay']} para {super_cast_delay}ms")

            # Salvar arquivo
            with open(self.source_file, 'w', encoding='utf-8') as f:
                f.write(new_content)

            print(f"Arquivo {self.source_file} atualizado com sucesso!")
            return True

        except Exception as e:
            print(f"ERRO: Erro ao aplicar modificações: {e}")
            return False

    def save_results(self, output_file: str = "autocast_delays_results.json") -> bool:
        """Salva os resultados em um arquivo JSON"""
        try:
            output_path = os.path.join(os.path.dirname(__file__), output_file)

            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(self.results, f, indent=2, ensure_ascii=False)

            print(f"Resultados salvos em: {output_path}")
            return True

        except Exception as e:
            print(f"ERRO: Erro ao salvar resultados: {e}")
            return False


def main():
    """Função principal"""
    parser = argparse.ArgumentParser(description="Auto Cast Delay Finder")
    parser.add_argument("--file", "-f", default="source.js", help="Arquivo source.js")
    parser.add_argument("--apply", "-a", action="store_true", help="Aplicar modificações")
    parser.add_argument("--auto-delay", type=int, default=1000, help="Delay do auto cast (ms)")
    parser.add_argument("--super-delay", type=int, default=100, help="Delay do super cast (ms)")
    parser.add_argument("--output", "-o", default="autocast_delays_results.json", help="Arquivo de saída")

    args = parser.parse_args()

    print("Auto Cast Delay Finder v1.0 (Python)")
    print("=" * 45)
    print()

    # Determinar caminho do arquivo source.js
    if not os.path.isabs(args.file):
        # Se não for caminho absoluto, procurar na pasta raiz do projeto
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.join(current_dir, "..", "..")
        source_path = os.path.join(project_root, args.file)

        if os.path.exists(source_path):
            args.file = source_path

    # Criar instância do finder
    finder = AutoCastDelayFinder(args.file)

    # Carregar código fonte
    if not finder.load_source_code():
        return 1

    # Encontrar delays
    results = finder.find_delays()

    # Gerar comandos de modificação
    commands = finder.generate_modification_commands()

    # Aplicar modificações se solicitado
    if args.apply:
        if finder.apply_modifications(args.auto_delay, args.super_delay):
            print("\nModificações aplicadas com sucesso!")
        else:
            return 1

    # Salvar resultados
    finder.save_results(args.output)

    # Mostrar instruções de uso
    print("\nExemplos de uso:")
    print("   Apenas encontrar:     python find_autocast_delays.py")
    print("   Aplicar mudanças:     python find_autocast_delays.py --apply")
    print("   Delays customizados:  python find_autocast_delays.py --apply --auto-delay 800 --super-delay 150")
    print("   Arquivo específico:   python find_autocast_delays.py --file /path/to/source.js")

    return 0


if __name__ == "__main__":
    exit(main())