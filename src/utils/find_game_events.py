#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Game Events Mapper
Script para mapear todos os eventos, hooks e padrões do jogo
Para uso futuro em mod loader e sistema de injeção de código

Mapeia:
- Eventos DOM (addEventListener, dispatchEvent)
- Eventos customizados (CustomEvent, Event)
- React Hooks (useEffect, useState, useCallback)
- Lifecycle events
- State management
- Callback patterns
- Game-specific events
"""

import re
import os
import json
import argparse
from typing import List, Dict, Any, Set


class GameEventsMapper:
    """Classe para mapear eventos e padrões do jogo"""

    def __init__(self, source_file: str = "source.js"):
        self.source_file = source_file
        self.source_code = ""
        self.patterns = self._create_patterns()
        self.events_found = {
            "dom_events": [],
            "custom_events": [],
            "react_hooks": [],
            "state_management": [],
            "game_events": [],
            "callback_patterns": [],
            "lifecycle_events": []
        }

    def _create_patterns(self) -> Dict[str, List[str]]:
        """Cria padrões regex para encontrar eventos e hooks"""
        return {
            # Eventos DOM padrão
            "dom_events": [
                # addEventListener
                r"\.addEventListener\s*\(\s*['\"]([^'\"]+)['\"]",

                # removeEventListener
                r"\.removeEventListener\s*\(\s*['\"]([^'\"]+)['\"]",

                # Event handlers (onClick, onLoad, etc)
                r"on([A-Z][a-zA-Z]+)\s*[=:]",

                # dispatchEvent
                r"\.dispatchEvent\s*\(",
            ],

            # Eventos customizados
            "custom_events": [
                # new CustomEvent
                r"new\s+CustomEvent\s*\(\s*['\"]([^'\"]+)['\"]",

                # new Event
                r"new\s+Event\s*\(\s*['\"]([^'\"]+)['\"]",

                # window.dispatchEvent com eventos customizados
                r"window\.dispatchEvent\s*\(\s*new\s+(?:CustomEvent|Event)\s*\(\s*['\"]([^'\"]+)['\"]",

                # Emitters customizados
                r"\.emit\s*\(\s*['\"]([^'\"]+)['\"]",
                r"\.trigger\s*\(\s*['\"]([^'\"]+)['\"]",
            ],

            # React Hooks
            "react_hooks": [
                # useState
                r"useState\s*\(",

                # useEffect
                r"useEffect\s*\(",

                # useCallback
                r"useCallback\s*\(",

                # useMemo
                r"useMemo\s*\(",

                # useRef
                r"useRef\s*\(",

                # Custom hooks
                r"use([A-Z][a-zA-Z]+)\s*\(",
            ],

            # State management
            "state_management": [
                # setState calls
                r"set([A-Z][a-zA-Z]*)\s*\(",

                # State updates
                r"\.current\s*=",

                # Redux-like patterns
                r"dispatch\s*\(",

                # Global state
                r"globalState|playerState|gameState",

                # localStorage
                r"localStorage\.(get|set|remove)Item",
            ],

            # Game-specific events
            "game_events": [
                # Audio events
                r"audioManager\.\w+",

                # Game actions
                r"(cast|fish|catch|repair|upgrade)\w*\s*\(",

                # Modal events
                r"(Modal|Popup|Dialog)\w*",

                # Session events
                r"session\w*\.",

                # Player actions
                r"player\w*\.",

                # UI events
                r"(show|hide|toggle|open|close)\w*\s*\(",
            ],

            # Callback patterns
            "callback_patterns": [
                # onSuccess/onError
                r"on(Success|Error|Complete|Fail)\s*[=:]",

                # then/catch
                r"\.(then|catch)\s*\(",

                # async/await patterns
                r"await\s+\w+\.\w+\(",

                # Promises
                r"new\s+Promise\s*\(",

                # setTimeout/setInterval
                r"set(Timeout|Interval)\s*\(",
            ],

            # Lifecycle events
            "lifecycle_events": [
                # Component lifecycle
                r"componentDidMount|componentWillUnmount",

                # useEffect cleanup
                r"return\s*\(\s*\)\s*=>\s*\{",

                # Window events
                r"window\.(onload|onbeforeunload|onresize)",

                # Document events
                r"document\.(DOMContentLoaded|readystatechange)",

                # React lifecycle
                r"useEffect\s*\([^,]*,\s*\[\]",  # Mount only
                r"useEffect\s*\([^,]*,\s*\[[^\]]+\]",  # Dependencies
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

    def find_all_events(self) -> Dict[str, List[Dict[str, Any]]]:
        """Encontra todos os eventos e padrões"""
        print("\nMapeando eventos e padrões do jogo...\n")

        for category, patterns in self.patterns.items():
            print(f"=== {category.replace('_', ' ').upper()} ===")

            category_events = []

            for i, pattern in enumerate(patterns):
                matches = re.finditer(pattern, self.source_code, re.MULTILINE | re.IGNORECASE)

                for match in matches:
                    line_number = self.source_code[:match.start()].count('\n') + 1

                    # Extrair informações específicas do match
                    event_info = self._extract_event_info(category, match, line_number)

                    if event_info:
                        category_events.append(event_info)

            # Remover duplicatas e ordenar
            unique_events = self._deduplicate_events(category_events)
            self.events_found[category] = unique_events

            print(f"   {len(unique_events)} eventos únicos encontrados")

        return self.events_found

    def _extract_event_info(self, category: str, match: re.Match, line_number: int) -> Dict[str, Any]:
        """Extrai informações específicas do evento"""
        full_match = match.group(0)
        context = self._get_context_lines(line_number, 2)

        # Limpar texto para evitar problemas de encoding
        clean_match = self._clean_text(full_match)
        clean_context = [self._clean_text(line) for line in context]

        event_info = {
            "line": line_number,
            "match": clean_match,
            "context": clean_context,
            "category": category,
            "type": self._classify_event_type(category, clean_match),
            "injection_point": self._suggest_injection_point(category, clean_match, line_number)
        }

        # Extrair dados específicos por categoria
        if category == "dom_events":
            event_info["event_name"] = self._extract_event_name(clean_match)
        elif category == "custom_events":
            event_info["event_name"] = self._extract_custom_event_name(clean_match)
        elif category == "react_hooks":
            event_info["hook_name"] = self._extract_hook_name(clean_match)
        elif category == "game_events":
            event_info["action"] = self._extract_game_action(clean_match)

        return event_info

    def _clean_text(self, text: str) -> str:
        """Limpa texto para evitar problemas de encoding"""
        if not text:
            return ""

        # Remover caracteres não-ASCII problemáticos
        cleaned = ''.join(c for c in text if ord(c) < 127 or c.isspace())
        # Limitar tamanho e remover quebras de linha
        return cleaned[:100].replace('\n', ' ').strip()

    def _extract_event_name(self, match: str) -> str:
        """Extrai nome do evento DOM"""
        event_match = re.search(r"['\"]([^'\"]+)['\"]", match)
        return event_match.group(1) if event_match else "unknown"

    def _extract_custom_event_name(self, match: str) -> str:
        """Extrai nome do evento customizado"""
        return self._extract_event_name(match)

    def _extract_hook_name(self, match: str) -> str:
        """Extrai nome do hook React"""
        hook_match = re.search(r"(use[A-Z][a-zA-Z]*)", match)
        return hook_match.group(1) if hook_match else "unknown"

    def _extract_game_action(self, match: str) -> str:
        """Extrai ação do jogo"""
        action_match = re.search(r"(cast|fish|catch|repair|upgrade|audio)\w*", match, re.IGNORECASE)
        return action_match.group(0) if action_match else "unknown"

    def _classify_event_type(self, category: str, match: str) -> str:
        """Classifica o tipo de evento"""
        if category == "dom_events":
            if "click" in match.lower():
                return "user_interaction"
            elif any(e in match.lower() for e in ["load", "resize", "scroll"]):
                return "lifecycle"
            else:
                return "dom_standard"

        elif category == "custom_events":
            if any(g in match.lower() for g in ["cast", "fish", "catch", "repair"]):
                return "game_action"
            else:
                return "custom_general"

        elif category == "react_hooks":
            if "useEffect" in match:
                return "lifecycle"
            elif "useState" in match:
                return "state"
            else:
                return "react_utility"

        elif category == "game_events":
            if "audio" in match.lower():
                return "audio"
            elif any(a in match.lower() for a in ["cast", "fish"]):
                return "gameplay"
            elif any(u in match.lower() for u in ["modal", "show", "hide"]):
                return "ui"
            else:
                return "game_general"

        return "other"

    def _suggest_injection_point(self, category: str, match: str, line_number: int) -> str:
        """Sugere ponto de injeção para mod loader"""
        if category == "dom_events":
            return f"ANTES linha {line_number} - interceptar evento DOM"
        elif category == "custom_events":
            return f"APÓS linha {line_number} - hook evento customizado"
        elif category == "react_hooks":
            if "useEffect" in match:
                return f"DENTRO useEffect linha {line_number} - adicionar side effects"
            else:
                return f"APÓS linha {line_number} - extender hook"
        elif category == "game_events":
            return f"ANTES/APÓS linha {line_number} - mod gameplay"
        else:
            return f"Próximo linha {line_number}"

    def _get_context_lines(self, line_number: int, context_size: int = 2) -> List[str]:
        """Obtém linhas de contexto"""
        lines = self.source_code.split('\n')
        start_line = max(0, line_number - context_size - 1)
        end_line = min(len(lines), line_number + context_size)

        context = []
        for i in range(start_line, end_line):
            prefix = ">>>" if i == line_number - 1 else "   "
            line_content = lines[i][:80] if len(lines[i]) > 80 else lines[i]
            context.append(f"{prefix} {i + 1:4d}: {line_content}")

        return context

    def _deduplicate_events(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicatas baseado na linha e match"""
        seen = set()
        unique_events = []

        for event in events:
            key = (event["line"], event["match"])
            if key not in seen:
                seen.add(key)
                unique_events.append(event)

        return sorted(unique_events, key=lambda x: x["line"])

    def generate_mod_loader_map(self) -> Dict[str, Any]:
        """Gera mapa para mod loader"""
        mod_map = {
            "metadata": {
                "generated_at": f"{__import__('datetime').datetime.now().isoformat()}",
                "source_file": self.source_file,
                "total_events": sum(len(events) for events in self.events_found.values()),
            },
            "injection_points": {},
            "event_categories": {},
            "mod_loader_hooks": []
        }

        # Organizar por pontos de injeção estratégicos
        strategic_points = {
            "game_initialization": [],
            "player_state_updates": [],
            "ui_interactions": [],
            "game_actions": [],
            "audio_events": [],
            "lifecycle_hooks": []
        }

        for category, events in self.events_found.items():
            mod_map["event_categories"][category] = {
                "count": len(events),
                "types": list(set(event.get("type", "unknown") for event in events)),
                "lines": [event["line"] for event in events[:10]]  # Top 10
            }

            # Classificar para pontos estratégicos
            for event in events:
                event_type = event.get("type", "unknown")

                if event_type == "lifecycle":
                    strategic_points["lifecycle_hooks"].append(event)
                elif "player" in event.get("match", "").lower() or category == "state_management":
                    strategic_points["player_state_updates"].append(event)
                elif event_type in ["user_interaction", "ui"]:
                    strategic_points["ui_interactions"].append(event)
                elif event_type in ["gameplay", "game_action"]:
                    strategic_points["game_actions"].append(event)
                elif event_type == "audio":
                    strategic_points["audio_events"].append(event)
                elif "init" in event.get("match", "").lower():
                    strategic_points["game_initialization"].append(event)

        # Gerar hooks para mod loader
        for point_type, events in strategic_points.items():
            if events:
                # Pegar os 3 melhores pontos de cada tipo
                top_events = sorted(events, key=lambda x: x["line"])[:3]

                for event in top_events:
                    hook = {
                        "name": f"{point_type}_{event['line']}",
                        "type": point_type,
                        "line": event["line"],
                        "description": f"Hook para {point_type.replace('_', ' ')}",
                        "injection_point": event["injection_point"],
                        "match": event["match"],
                        "context": event.get("context", [])[:2]  # Primeiras 2 linhas de contexto
                    }

                    mod_map["mod_loader_hooks"].append(hook)

        mod_map["injection_points"] = strategic_points

        return mod_map

    def save_results(self, events: Dict[str, List[Dict[str, Any]]], mod_map: Dict[str, Any],
                    output_file: str = "game_events_map.json") -> bool:
        """Salva resultados"""
        try:
            output_data = {
                "events_detailed": events,
                "mod_loader_map": mod_map
            }

            output_path = os.path.join(os.path.dirname(__file__), output_file)

            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)

            # Salvar mod map separado
            mod_map_path = output_path.replace('.json', '_mod_loader.json')
            with open(mod_map_path, 'w', encoding='utf-8') as f:
                json.dump(mod_map, f, indent=2, ensure_ascii=False)

            print(f"Eventos detalhados salvos em: {output_path}")
            print(f"Mapa do mod loader salvo em: {mod_map_path}")
            return True

        except Exception as e:
            print(f"ERRO ao salvar: {e}")
            return False

    def print_summary(self) -> None:
        """Imprime resumo dos eventos encontrados"""
        total_events = sum(len(events) for events in self.events_found.values())

        print(f"\n" + "="*60)
        print(f"RESUMO: {total_events} eventos/padrões encontrados")
        print("="*60)

        for category, events in self.events_found.items():
            if events:
                print(f"\n{category.replace('_', ' ').upper()}: {len(events)} eventos")

                # Mostrar tipos mais comuns
                types = {}
                for event in events:
                    event_type = event.get("type", "unknown")
                    types[event_type] = types.get(event_type, 0) + 1

                for event_type, count in sorted(types.items(), key=lambda x: x[1], reverse=True)[:3]:
                    print(f"  - {event_type}: {count}")

        print(f"\n" + "="*60)
        print("PRÓXIMOS PASSOS PARA MOD LOADER:")
        print("="*60)
        print("1. Revisar mod_loader_map.json para pontos de injeção")
        print("2. Implementar sistema de hooks baseado nos pontos encontrados")
        print("3. Criar API para mods interceptarem eventos específicos")
        print("4. Testar injeção de código nos pontos sugeridos")


def main():
    """Função principal"""
    parser = argparse.ArgumentParser(description="Game Events Mapper")
    parser.add_argument("--file", "-f", default="source.js", help="Arquivo source.js")
    parser.add_argument("--output", "-o", default="game_events_map.json", help="Arquivo de saída")

    args = parser.parse_args()

    print("Game Events Mapper v1.0")
    print("=" * 40)
    print("Mapeando eventos para futura implementação de mod loader...")
    print()

    # Determinar caminho do arquivo
    if not os.path.isabs(args.file):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.join(current_dir, "..", "..")
        source_path = os.path.join(project_root, args.file)

        if os.path.exists(source_path):
            args.file = source_path

    # Criar instância do mapper
    mapper = GameEventsMapper(args.file)

    # Carregar código
    if not mapper.load_source_code():
        return 1

    # Encontrar eventos
    events = mapper.find_all_events()

    # Gerar mapa para mod loader
    mod_map = mapper.generate_mod_loader_map()

    # Salvar resultados
    mapper.save_results(events, mod_map, args.output)

    # Mostrar resumo
    mapper.print_summary()

    return 0


if __name__ == "__main__":
    exit(main())