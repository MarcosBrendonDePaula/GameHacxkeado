#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script principal para encontrar delays do auto cast
Interface simples para usar as utilitárias
"""

import os
import sys
from utils.find_autocast_delays import AutoCastDelayFinder
from utils.config import SPEED_PRESETS, DEFAULT_FILES


def show_menu():
    """Mostra o menu principal"""
    print("Auto Cast Delay Finder - Menu Principal")
    print("=" * 45)
    print()
    print("1. Apenas encontrar delays atuais")
    print("2. Aplicar preset de velocidade")
    print("3. Aplicar delays customizados")
    print("4. Mostrar presets disponíveis")
    print("5. Sair")
    print()


def show_presets():
    """Mostra os presets de velocidade disponíveis"""
    print("\nPresets de Velocidade Disponíveis:")
    print("-" * 40)

    for name, settings in SPEED_PRESETS.items():
        auto_delay = settings["auto_cast_normal"]
        super_delay = settings["super_cast"]

        print(f"{name.upper()}:")
        print(f"   Auto Cast:  {auto_delay}ms ({auto_delay/1000}s)")
        print(f"   Super Cast: {super_delay}ms ({super_delay/1000}s)")
        print()


def apply_preset(preset_name: str, finder: AutoCastDelayFinder) -> bool:
    """Aplica um preset de velocidade"""
    if preset_name not in SPEED_PRESETS:
        print(f"ERRO: Preset '{preset_name}' não encontrado!")
        return False

    settings = SPEED_PRESETS[preset_name]
    auto_delay = settings["auto_cast_normal"]
    super_delay = settings["super_cast"]

    print(f"\nAplicando preset: {preset_name.upper()}")
    print(f"   Auto Cast: {auto_delay}ms")
    print(f"   Super Cast: {super_delay}ms")
    print()

    return finder.apply_modifications(auto_delay, super_delay)


def get_source_file_path() -> str:
    """Encontra o caminho do arquivo source.js"""
    # Tentar diferentes localizações
    possible_paths = [
        "source.js",  # Na pasta atual
        "../source.js",  # Na pasta pai
        "../../source.js",  # Duas pastas acima
        os.path.join(os.path.dirname(__file__), "..", "source.js"),  # Relativo ao script
    ]

    for path in possible_paths:
        if os.path.exists(path):
            return os.path.abspath(path)

    return "source.js"  # Fallback


def main():
    """Função principal"""
    print("Game Auto Cast Modifier")
    print("Versão: 1.0")
    print()

    # Encontrar arquivo source.js
    source_file = get_source_file_path()
    print(f"Arquivo: {source_file}")

    if not os.path.exists(source_file):
        print(f"ERRO: Arquivo source.js não encontrado!")
        print(f"   Procurado em: {source_file}")
        print("   Certifique-se de que o arquivo existe.")
        return 1

    # Criar instância do finder
    finder = AutoCastDelayFinder(source_file)

    # Carregar código fonte
    if not finder.load_source_code():
        return 1

    # Loop principal do menu
    while True:
        show_menu()

        try:
            choice = input("Escolha uma opção (1-5): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\nSaindo...")
            break

        if choice == "1":
            # Apenas encontrar delays
            print("\nProcurando delays atuais...\n")
            results = finder.find_delays()
            commands = finder.generate_modification_commands()

            if not results["auto_cast_normal"] and not results["super_cast"]:
                print("AVISO: Nenhum delay encontrado. O arquivo pode ter sido modificado.")
            else:
                print("\nBusca concluída!")

            input("\nPressione Enter para continuar...")

        elif choice == "2":
            # Aplicar preset
            show_presets()
            preset_name = input("Digite o nome do preset (slow/normal/fast/ultra_fast): ").strip().lower()

            if preset_name in SPEED_PRESETS:
                # Primeiro encontrar os delays
                print("\nEncontrando delays atuais...")
                finder.find_delays()

                # Aplicar preset
                if apply_preset(preset_name, finder):
                    print("Preset aplicado com sucesso!")
                else:
                    print("ERRO: Erro ao aplicar preset!")
            else:
                print("ERRO: Preset inválido!")

            input("\nPressione Enter para continuar...")

        elif choice == "3":
            # Delays customizados
            try:
                print("\nDelays Customizados:")
                auto_delay = int(input("Auto Cast delay (ms): "))
                super_delay = int(input("Super Cast delay (ms): "))

                print(f"\nEncontrando delays atuais...")
                finder.find_delays()

                print(f"Aplicando delays customizados...")
                if finder.apply_modifications(auto_delay, super_delay):
                    print("Delays customizados aplicados!")
                else:
                    print("ERRO: Erro ao aplicar delays!")

            except ValueError:
                print("ERRO: Por favor, digite apenas números!")

            input("\nPressione Enter para continuar...")

        elif choice == "4":
            # Mostrar presets
            show_presets()
            input("Pressione Enter para continuar...")

        elif choice == "5":
            # Sair
            print("\nSaindo...")
            break

        else:
            print("ERRO: Opção inválida! Digite um número de 1 a 5.")
            input("\nPressione Enter para continuar...")

    return 0


if __name__ == "__main__":
    exit(main())