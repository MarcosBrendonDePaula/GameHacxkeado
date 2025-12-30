#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Injection Patterns Finder
Script para encontrar padrões específicos onde código pode ser injetado
Complementa o game events mapper para mod loader

Encontra:
- Function declarations (pontos para wrapper/hook)
- Class constructors (pontos para extend/override)
- Import/export statements (pontos para module injection)
- Global variable assignments (pontos para state injection)
- Configuration objects (pontos para config override)
- API call patterns (pontos para interceptação)
"""

import re
import os
import json
from typing import Dict, List, Any


class InjectionPatternsFinder:
    """Classe para encontrar padrões de injeção"""

    def __init__(self, source_file: str = "source.js"):
        self.source_file = source_file
        self.source_code = ""
        self.patterns = self._create_patterns()

    def _create_patterns(self) -> Dict[str, List[str]]:
        """Cria padrões para pontos de injeção"""
        return {
            # Declarações de função - pontos para wrapper/hook
            "function_declarations": [
                r"function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(",
                r"const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>",
                r"([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*function\s*\(",
                r"([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\([^)]*\)\s*=>",
            ],

            # Construtores e classes
            "class_patterns": [
                r"class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)",
                r"constructor\s*\(",
                r"new\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(",
            ],

            # Atribuições de variáveis globais importantes
            "global_assignments": [
                r"(window|global|globalThis)\[?['\"]?([a-zA-Z_$][a-zA-Z0-9_$]*)['\"]?\]?\s*=",
                r"const\s+(GAME_CONFIG|CONFIG|SETTINGS|API_)\w*\s*=",
                r"let\s+(game|player|state|config)\w*\s*=",
            ],

            # Objetos de configuração
            "config_objects": [
                r"(\w*[Cc]onfig\w*)\s*[=:]\s*\{",
                r"(\w*[Ss]ettings\w*)\s*[=:]\s*\{",
                r"(\w*[Oo]ptions\w*)\s*[=:]\s*\{",
                r"(DEFAULT_\w+)\s*[=:]\s*\{",
            ],

            # Padrões de API e rede
            "api_patterns": [
                r"fetch\s*\(",
                r"axios\.(get|post|put|delete)",
                r"\.methods\.\w+\(",
                r"\.account\.\w+\.",
                r"async\s+function.*\w*(api|fetch|request)\w*",
            ],

            # Padrões de inicialização
            "initialization_patterns": [
                r"(init|setup|start|begin)\w*\s*[=:]\s*(?:function|\()",
                r"document\.addEventListener\s*\(\s*['\"]DOMContentLoaded['\"]",
                r"window\.addEventListener\s*\(\s*['\"]load['\"]",
                r"useEffect\s*\([^,]*,\s*\[\]\s*\)",  # useEffect com deps vazias
            ],

            # Padrões de estado/store
            "state_patterns": [
                r"(state|store|redux|context)\w*\s*[=:]\s*",
                r"useState\s*\(",
                r"useContext\s*\(",
                r"createContext\s*\(",
                r"Provider\s*>",
            ],

            # Handlers e callbacks importantes
            "handler_patterns": [
                r"on([A-Z]\w+)\s*[=:]\s*(?:function|\()",
                r"handle([A-Z]\w+)\s*[=:]\s*(?:function|\()",
                r"\.then\s*\(",
                r"\.catch\s*\(",
            ],

            # Import/Export para module injection
            "module_patterns": [
                r"import\s+.*from\s+['\"]([^'\"]+)['\"]",
                r"export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)",
                r"module\.exports\s*=",
                r"require\s*\(\s*['\"]([^'\"]+)['\"]",
            ]
        }

    def load_source_code(self) -> bool:
        """Carrega código fonte"""
        try:
            if not os.path.exists(self.source_file):
                print(f"ERRO: Arquivo {self.source_file} não encontrado!")
                return False

            with open(self.source_file, 'r', encoding='utf-8', errors='ignore') as f:
                self.source_code = f.read()

            print(f"Código carregado para análise de padrões: {len(self.source_code):,} caracteres")
            return True

        except Exception as e:
            print(f"ERRO: {e}")
            return False

    def find_injection_patterns(self) -> Dict[str, List[Dict[str, Any]]]:
        """Encontra todos os padrões de injeção"""
        print("\nAnalisando padrões de injeção...\n")

        results = {}

        for category, patterns in self.patterns.items():
            print(f"=== {category.replace('_', ' ').upper()} ===")

            category_results = []

            for i, pattern in enumerate(patterns):
                matches = re.finditer(pattern, self.source_code, re.MULTILINE | re.IGNORECASE)

                for match in matches:
                    line_number = self.source_code[:match.start()].count('\n') + 1

                    # Extrair informações
                    pattern_info = {
                        "pattern_id": i + 1,
                        "line": line_number,
                        "match": self._clean_text(match.group(0)),
                        "extracted_name": self._extract_name(match),
                        "injection_type": self._determine_injection_type(category, match.group(0)),
                        "mod_potential": self._assess_mod_potential(category, match.group(0)),
                        "context": self._get_context(line_number, 1)
                    }

                    category_results.append(pattern_info)

            # Deduplicate e limite
            unique_results = self._deduplicate_patterns(category_results)
            results[category] = unique_results[:20]  # Top 20 por categoria

            print(f"   {len(unique_results)} padrões únicos encontrados")

        return results

    def _clean_text(self, text: str) -> str:
        """Limpa texto removendo caracteres problemáticos"""
        if not text:
            return ""

        cleaned = ''.join(c for c in text if ord(c) < 127 or c.isspace())
        return cleaned[:80].replace('\n', ' ').strip()

    def _extract_name(self, match: re.Match) -> str:
        """Extrai nome da função/variável/classe"""
        groups = match.groups()
        if groups:
            for group in groups:
                if group and re.match(r'^[a-zA-Z_$][a-zA-Z0-9_$]*$', group):
                    return group
        return "unknown"

    def _determine_injection_type(self, category: str, match_text: str) -> str:
        """Determina tipo de injeção possível"""
        if category == "function_declarations":
            if any(keyword in match_text.lower() for keyword in ["cast", "fish", "repair", "upgrade"]):
                return "game_action_wrapper"
            elif "use" in match_text.lower():
                return "hook_wrapper"
            else:
                return "function_wrapper"

        elif category == "class_patterns":
            return "class_extension"

        elif category == "global_assignments":
            return "global_variable_override"

        elif category == "config_objects":
            return "config_injection"

        elif category == "api_patterns":
            return "api_interceptor"

        elif category == "initialization_patterns":
            return "init_hook"

        elif category == "state_patterns":
            return "state_injection"

        elif category == "handler_patterns":
            return "event_interceptor"

        elif category == "module_patterns":
            return "module_injection"

        return "generic"

    def _assess_mod_potential(self, category: str, match_text: str) -> str:
        """Avalia potencial para modding"""
        # Game-specific high-value targets
        game_keywords = ["cast", "fish", "catch", "repair", "upgrade", "player", "durability", "audio"]

        if any(keyword in match_text.lower() for keyword in game_keywords):
            return "HIGH"

        # UI and state management
        if category in ["state_patterns", "handler_patterns"]:
            return "MEDIUM"

        # Configuration and initialization
        if category in ["config_objects", "initialization_patterns"]:
            return "MEDIUM"

        # API and network - good for cheat detection avoidance
        if category == "api_patterns":
            return "HIGH"

        return "LOW"

    def _get_context(self, line_number: int, context_size: int = 1) -> List[str]:
        """Obtém contexto da linha"""
        lines = self.source_code.split('\n')
        start = max(0, line_number - context_size - 1)
        end = min(len(lines), line_number + context_size)

        context = []
        for i in range(start, end):
            if i < len(lines):
                cleaned_line = self._clean_text(lines[i])
                context.append(f"{i + 1:4d}: {cleaned_line}")

        return context

    def _deduplicate_patterns(self, patterns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicatas"""
        seen = set()
        unique = []

        for pattern in patterns:
            key = (pattern["line"], pattern["match"])
            if key not in seen:
                seen.add(key)
                unique.append(pattern)

        return sorted(unique, key=lambda x: x["line"])

    def generate_mod_loader_spec(self, patterns: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Gera especificação para mod loader"""
        spec = {
            "mod_loader_version": "1.0",
            "injection_points": {},
            "priority_targets": [],
            "mod_categories": {
                "game_mechanics": [],
                "ui_enhancement": [],
                "api_modification": [],
                "state_management": [],
                "audio_visual": []
            }
        }

        # Processar padrões por prioridade
        high_priority = []
        medium_priority = []

        for category, pattern_list in patterns.items():
            for pattern in pattern_list:
                target = {
                    "name": f"{category}_{pattern['line']}",
                    "category": category,
                    "line": pattern["line"],
                    "function_name": pattern["extracted_name"],
                    "injection_type": pattern["injection_type"],
                    "potential": pattern["mod_potential"],
                    "description": f"{pattern['injection_type']} at line {pattern['line']}"
                }

                if pattern["mod_potential"] == "HIGH":
                    high_priority.append(target)
                elif pattern["mod_potential"] == "MEDIUM":
                    medium_priority.append(target)

                # Categorizar por tipo de mod
                if any(keyword in pattern["match"].lower() for keyword in ["cast", "fish", "repair"]):
                    spec["mod_categories"]["game_mechanics"].append(target)
                elif any(keyword in pattern["match"].lower() for keyword in ["modal", "show", "hide"]):
                    spec["mod_categories"]["ui_enhancement"].append(target)
                elif "api" in pattern["match"].lower() or "fetch" in pattern["match"].lower():
                    spec["mod_categories"]["api_modification"].append(target)
                elif "state" in pattern["match"].lower() or "use" in pattern["match"].lower():
                    spec["mod_categories"]["state_management"].append(target)
                elif "audio" in pattern["match"].lower():
                    spec["mod_categories"]["audio_visual"].append(target)

        spec["priority_targets"] = sorted(high_priority + medium_priority,
                                        key=lambda x: (x["potential"], -x["line"]))[:50]

        # Pontos de injeção recomendados
        spec["injection_points"] = {
            "game_initialization": [t for t in spec["priority_targets"] if "init" in t["injection_type"]],
            "function_wrappers": [t for t in spec["priority_targets"] if "wrapper" in t["injection_type"]],
            "state_interceptors": [t for t in spec["priority_targets"] if "state" in t["injection_type"]],
            "api_interceptors": [t for t in spec["priority_targets"] if "api" in t["injection_type"]]
        }

        return spec

    def save_results(self, patterns: Dict[str, List[Dict[str, Any]]], spec: Dict[str, Any],
                    output_file: str = "injection_patterns.json") -> bool:
        """Salva resultados"""
        try:
            output_data = {
                "generated_at": f"{__import__('datetime').datetime.now().isoformat()}",
                "patterns": patterns,
                "mod_loader_spec": spec,
                "summary": {
                    "total_patterns": sum(len(p) for p in patterns.values()),
                    "high_priority": len([t for t in spec["priority_targets"] if t["potential"] == "HIGH"]),
                    "categories": {cat: len(targets) for cat, targets in spec["mod_categories"].items()}
                }
            }

            output_path = os.path.join(os.path.dirname(__file__), output_file)

            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)

            # Salvar spec separada
            spec_path = output_path.replace('.json', '_spec.json')
            with open(spec_path, 'w', encoding='utf-8') as f:
                json.dump(spec, f, indent=2, ensure_ascii=False)

            print(f"\nPadrões salvos em: {output_path}")
            print(f"Spec do mod loader salva em: {spec_path}")
            return True

        except Exception as e:
            print(f"ERRO ao salvar: {e}")
            return False


def main():
    print("Injection Patterns Finder v1.0")
    print("=" * 40)
    print()

    # Caminho do arquivo
    current_dir = os.path.dirname(os.path.abspath(__file__))
    source_path = os.path.join(current_dir, "..", "..", "source.js")

    finder = InjectionPatternsFinder(source_path)

    if not finder.load_source_code():
        return 1

    # Encontrar padrões
    patterns = finder.find_injection_patterns()

    # Gerar spec
    spec = finder.generate_mod_loader_spec(patterns)

    # Salvar
    finder.save_results(patterns, spec, "injection_patterns.json")

    # Resumo
    total = sum(len(p) for p in patterns.values())
    high_priority = len([t for t in spec["priority_targets"] if t["potential"] == "HIGH"])

    print(f"\n" + "="*50)
    print(f"RESUMO: {total} padrões de injeção encontrados")
    print(f"Alvos de alta prioridade: {high_priority}")
    print("="*50)

    print("\nCategorias principais:")
    for cat, targets in spec["mod_categories"].items():
        if targets:
            print(f"  {cat}: {len(targets)} alvos")

    return 0


if __name__ == "__main__":
    exit(main())