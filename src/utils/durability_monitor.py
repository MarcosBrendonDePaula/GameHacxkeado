#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Durability Monitor
Script para monitorar e analisar a durabilidade da vara de pescar

Monitora:
- currentDurability (durabilidade atual)
- maxDurability (durabilidade máxima)
- lastDurabilityTs (timestamp da última atualização)
- Taxa de regeneração
- Previsão de tempo para reparo
"""

import re
import os
import json
import time
import datetime
from typing import List, Dict, Any, Optional, Tuple


class DurabilityMonitor:
    """Classe para monitorar durabilidade da vara"""

    def __init__(self, source_file: str = "source.js"):
        self.source_file = source_file
        self.source_code = ""

        # Constantes do sistema de durabilidade (extraídas do código)
        self.DURABILITY_REGEN_SECONDS_PER_CAST = 3  # linha 228307
        self.SLOW_REGEN_MULTIPLIER = 4              # linha 228308
        self.REPAIR_THRESHOLD = 0.2                 # 20% da durabilidade máxima
        self.REPAIR_COST_LAMPORTS = 990000         # linha 235006 (0.99 USDC)

        self.patterns = self._create_patterns()
        self.durability_data = {
            "current_values": {},
            "history": [],
            "stats": {}
        }

    def _create_patterns(self) -> Dict[str, List[str]]:
        """Cria padrões regex para encontrar variáveis de durabilidade"""
        return {
            # Padrões para encontrar o estado do jogador
            "player_state_usage": [
                # Padrão 1: dr.currentDurability
                r"dr\.currentDurability\s*(?:\?\?\s*\d+|\|\|\s*\d+)?",

                # Padrão 2: dr.maxDurability
                r"dr\.maxDurability\s*(?:\?\?\s*\d+|\|\|\s*\d+)?",

                # Padrão 3: dr.lastDurabilityTs
                r"dr\.lastDurabilityTs\s*(?:\?\?\s*['\"]0['\"])?",
            ],

            # Padrões para encontrar cálculos de durabilidade
            "durability_calculations": [
                # calculateExpectedDurability calls
                r"calculateExpectedDurability\([^)]+\)",

                # Verificações de durabilidade baixa
                r"currentDurability\s*[<>=]+\s*\w+\s*\*\s*0\.1",
                r"currentDurability\s*===\s*0",

                # Checks de reparo
                r"checkRepairEligibility\([^)]+\)",
            ],

            # Padrões para encontrar constantes do sistema
            "durability_constants": [
                r"DURABILITY_REGEN_SECONDS_PER_CAST\s*=\s*(\d+)",
                r"SLOW_REGEN_MULTIPLIER\s*=\s*(\d+)",
                r"REPAIR_COST_LAMPORTS\s*=\s*(\d+)",
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

    def find_durability_variables(self) -> Dict[str, List[Dict[str, Any]]]:
        """Encontra todas as variáveis e usos relacionados à durabilidade"""
        print("\nProcurando variáveis de durabilidade...\n")

        results = {
            "player_state_usage": [],
            "durability_calculations": [],
            "durability_constants": []
        }

        for category, patterns in self.patterns.items():
            print(f"{category.replace('_', ' ').title()}:")

            for i, pattern in enumerate(patterns):
                matches = re.finditer(pattern, self.source_code, re.MULTILINE | re.DOTALL)

                for match in matches:
                    line_number = self.source_code[:match.start()].count('\n') + 1
                    context = self._get_context(match.start(), 100)

                    result = {
                        "pattern": i + 1,
                        "line": line_number,
                        "match": match.group(0),
                        "context": context
                    }

                    results[category].append(result)

                    print(f"  [OK] Padrão {i + 1}: Linha {line_number}")
                    print(f"       Match: {match.group(0)}")
                    print(f"       Contexto: {context[:80]}...")

        return results

    def _get_context(self, position: int, length: int = 200) -> str:
        """Obtém contexto ao redor de uma posição no código"""
        start = max(0, position - length // 2)
        end = min(len(self.source_code), position + length // 2)
        return self.source_code[start:end].strip()

    def calculate_expected_durability(self, current: int, max_dur: int, last_ts: int) -> Dict[str, Any]:
        """Calcula a durabilidade esperada baseada na regeneração"""
        now = int(time.time())
        time_diff = now - last_ts

        if time_diff <= 0 or current >= max_dur:
            return {
                "expected_durability": current,
                "regen_amount": 0,
                "time_passed": time_diff,
                "is_regenerating": False
            }

        # Verificar se está na zona de regeneração lenta (<=20%)
        slow_threshold = int(max_dur * self.REPAIR_THRESHOLD)
        is_slow_regen = current <= slow_threshold

        # Calcular taxa de regeneração
        regen_rate = (self.DURABILITY_REGEN_SECONDS_PER_CAST *
                     self.SLOW_REGEN_MULTIPLIER if is_slow_regen
                     else self.DURABILITY_REGEN_SECONDS_PER_CAST)

        # Calcular regeneração
        regen_cycles = time_diff // regen_rate
        regen_amount = int(regen_cycles)
        expected_durability = min(current + regen_amount, max_dur)

        return {
            "expected_durability": expected_durability,
            "regen_amount": regen_amount,
            "time_passed": time_diff,
            "regen_rate_seconds": regen_rate,
            "is_slow_regen": is_slow_regen,
            "is_regenerating": regen_amount > 0,
            "time_to_full": self._calculate_time_to_full(current, max_dur, regen_rate)
        }

    def _calculate_time_to_full(self, current: int, max_dur: int, regen_rate: int) -> int:
        """Calcula tempo em segundos para atingir durabilidade máxima"""
        if current >= max_dur:
            return 0

        missing = max_dur - current
        return missing * regen_rate

    def check_repair_eligibility(self, current: int, max_dur: int, last_ts: int) -> Dict[str, Any]:
        """Verifica se a vara pode ser reparada"""
        expected_data = self.calculate_expected_durability(current, max_dur, last_ts)
        expected_durability = expected_data["expected_durability"]

        repair_threshold = int(max_dur * self.REPAIR_THRESHOLD)

        if expected_durability >= max_dur:
            return {
                "can_repair": False,
                "reason": "Vara com durabilidade máxima - não precisa reparo",
                "expected_durability": expected_durability
            }

        if expected_durability > repair_threshold:
            percentage = round((expected_durability / max_dur) * 100, 1)
            return {
                "can_repair": False,
                "reason": f"Durabilidade em {percentage}% - reparo só disponível em <=20%",
                "expected_durability": expected_durability
            }

        return {
            "can_repair": True,
            "reason": "Elegível para reparo",
            "expected_durability": expected_durability,
            "cost_usdc": 0.99
        }

    def analyze_durability_pattern(self, current: int, max_dur: int, last_ts: int) -> Dict[str, Any]:
        """Analisa padrões de uso da durabilidade"""
        now = int(time.time())

        expected_data = self.calculate_expected_durability(current, max_dur, last_ts)
        repair_data = self.check_repair_eligibility(current, max_dur, last_ts)

        # Calcular estatísticas úteis
        percentage = round((expected_data["expected_durability"] / max_dur) * 100, 1)
        time_since_update = now - last_ts

        # Determinar status
        if expected_data["expected_durability"] == 0:
            status = "BROKEN - Precisa reparo urgente"
            color = "red"
        elif expected_data["expected_durability"] <= max_dur * 0.1:
            status = "LOW - Durabilidade baixa"
            color = "orange"
        elif expected_data["expected_durability"] <= max_dur * 0.2:
            status = "MEDIUM - Pode reparar em breve"
            color = "yellow"
        else:
            status = "GOOD - Durabilidade boa"
            color = "green"

        return {
            "timestamp": now,
            "status": status,
            "color": color,
            "current_durability": current,
            "max_durability": max_dur,
            "expected_durability": expected_data["expected_durability"],
            "percentage": percentage,
            "time_since_update_hours": round(time_since_update / 3600, 1),
            "regeneration": expected_data,
            "repair": repair_data,
            "predictions": {
                "time_to_full_hours": round(expected_data["time_to_full"] / 3600, 1),
                "time_to_repair_eligible": self._time_until_repair_eligible(current, max_dur, last_ts)
            }
        }

    def _time_until_repair_eligible(self, current: int, max_dur: int, last_ts: int) -> Optional[float]:
        """Calcula tempo até poder reparar (se aplicável)"""
        repair_threshold = int(max_dur * self.REPAIR_THRESHOLD)
        expected_data = self.calculate_expected_durability(current, max_dur, last_ts)

        if expected_data["expected_durability"] <= repair_threshold:
            return 0  # Já pode reparar

        if not expected_data["is_regenerating"]:
            return None  # Não está regenerando

        # Se está regenerando para cima, nunca vai atingir o threshold
        return None

    def generate_durability_report(self, current: int, max_dur: int, last_ts: int) -> str:
        """Gera um relatório detalhado da durabilidade"""
        analysis = self.analyze_durability_pattern(current, max_dur, last_ts)

        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        report = f"""
=== RELATÓRIO DE DURABILIDADE DA VARA ===
Gerado em: {timestamp}

STATUS ATUAL: {analysis['status']}
Durabilidade: {analysis['current_durability']:,} / {analysis['max_durability']:,} ({analysis['percentage']}%)
Durabilidade Esperada: {analysis['expected_durability']:,} ({analysis['percentage']:.1f}%)

REGENERAÇÃO:
- Taxa atual: {analysis['regeneration']['regen_rate_seconds']} seg/ponto
- Regeneração lenta: {'Sim' if analysis['regeneration']['is_slow_regen'] else 'Não'}
- Pontos regenerados: {analysis['regeneration']['regen_amount']:,}
- Tempo para 100%: {analysis['predictions']['time_to_full_hours']:.1f} horas

REPARO:
- Pode reparar: {'Sim' if analysis['repair']['can_repair'] else 'Não'}
- Razão: {analysis['repair']['reason']}
- Custo: ${'0.99 USDC' if analysis['repair']['can_repair'] else 'N/A'}

SISTEMA:
- Última atualização: {analysis['time_since_update_hours']:.1f} horas atrás
- Threshold reparo: {int(max_dur * self.REPAIR_THRESHOLD):,} ({self.REPAIR_THRESHOLD * 100}%)
- Taxa normal: {self.DURABILITY_REGEN_SECONDS_PER_CAST} seg/ponto
- Taxa lenta: {self.DURABILITY_REGEN_SECONDS_PER_CAST * self.SLOW_REGEN_MULTIPLIER} seg/ponto
"""

        return report

    def save_analysis(self, analysis: Dict[str, Any], filename: str = "durability_analysis.json") -> bool:
        """Salva análise em arquivo JSON"""
        try:
            output_path = os.path.join(os.path.dirname(__file__), filename)

            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(analysis, f, indent=2, ensure_ascii=False)

            print(f"Análise salva em: {output_path}")
            return True

        except Exception as e:
            print(f"ERRO ao salvar análise: {e}")
            return False


def main():
    """Função principal"""
    print("Durability Monitor v1.0")
    print("=" * 40)
    print()

    # Exemplo de uso com valores simulados
    # Em implementação real, estes valores viriam do playerState

    monitor = DurabilityMonitor()

    print("=== EXEMPLO DE ANÁLISE ===")
    print()

    # Cenário 1: Vara com durabilidade baixa
    print("Cenário 1: Vara precisando de reparo")
    current_dur = 2880  # 10% de 28800
    max_dur = 28800
    last_ts = int(time.time()) - 7200  # 2 horas atrás

    analysis = monitor.analyze_durability_pattern(current_dur, max_dur, last_ts)
    report = monitor.generate_durability_report(current_dur, max_dur, last_ts)

    print(report)

    # Salvar análise
    monitor.save_analysis(analysis, "durability_example.json")

    print("\n" + "="*50)

    # Cenário 2: Vara regenerando
    print("Cenário 2: Vara regenerando")
    current_dur = 15000  # ~52%
    max_dur = 28800
    last_ts = int(time.time()) - 3600  # 1 hora atrás

    analysis2 = monitor.analyze_durability_pattern(current_dur, max_dur, last_ts)
    report2 = monitor.generate_durability_report(current_dur, max_dur, last_ts)

    print(report2)

    print("\n=== INSTRUCOES DE USO ===")
    print("1. Para usar com dados reais, integre com o playerState")
    print("2. Chame analyze_durability_pattern() com:")
    print("   - dr.currentDurability")
    print("   - dr.maxDurability")
    print("   - parseInt(dr.lastDurabilityTs)")
    print("3. Use generate_durability_report() para relatórios")


if __name__ == "__main__":
    main()