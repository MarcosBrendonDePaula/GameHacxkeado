// IDL extraído do jogo Fogo Fishing
// Contém apenas as partes necessárias para o bot funcionar

export const FOGO_FISHING_IDL = {
  "address": "SEAyjT1FUx3JyXJnWt5NtjELDwuU9XsoZeZVPVvweU4",
  "metadata": {
    "name": "fogo_fishing",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "cast_line",
      "discriminator": [16, 223, 158, 206, 88, 206, 92, 69],
      "accounts": [
        {
          "name": "signer",
          "docs": ["The signer (session key or user wallet)"],
          "writable": true,
          "signer": true
        },
        {
          "name": "global_state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101]
              }
            ]
          }
        },
        {
          "name": "config",
          "docs": ["Global config (issuer key, flags)"],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [99, 111, 110, 102, 105, 103]
              }
            ]
          }
        },
        {
          "name": "rate_state",
          "docs": [
            "Player-specific rate state (nonce/cooldown) - only required when capability checking is enabled"
          ]
        },
        {
          "name": "instructions_sysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "slot_hashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "player_state",
          "docs": ["Player state PDA based on owner"],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [112, 108, 97, 121, 101, 114]
              },
              {
                "kind": "arg",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "owner",
          "type": "pubkey"
        },
        {
          "name": "target_slot",
          "type": "u64"
        },
        {
          "name": "use_supercast",
          "type": "bool"
        },
        {
          "name": "_nonce",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "GlobalState",
      "discriminator": [163, 46, 74, 168, 216, 123, 133, 98]
    },
    {
      "name": "PlayerState",
      "discriminator": [56, 3, 60, 86, 174, 16, 244, 195]
    },
    {
      "name": "Config",
      "discriminator": [155, 12, 170, 224, 30, 250, 204, 130]
    }
  ],
  "types": [
    {
      "name": "PlayerState",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "owner", "type": "pubkey" },
          { "name": "rod_level", "type": "u8" },
          { "name": "boat_tier", "type": "u8" },
          { "name": "bump", "type": "u8" },
          { "name": "cast_count", "type": "u64" },
          { "name": "fish_caught_all_time", "type": "u64" },
          { "name": "power", "type": "u64" },
          { "name": "max_durability", "type": "u32" },
          { "name": "current_durability", "type": "u32" },
          { "name": "supercast_remaining_casts", "type": "u32" },
          { "name": "last_durability_ts", "type": "i64" },
          { "name": "unprocessed_fish", "type": "u64" },
          { "name": "last_claim_fees_snapshot", "type": "u128" },
          { "name": "last_recorded_unprocessed", "type": "u64" },
          { "name": "upgrade_in_progress", "type": "bool" },
          { "name": "upgrade_target_level", "type": "u8" },
          { "name": "upgrade_casts_at_start", "type": "u64" },
          { "name": "last_ata_creation_slot", "type": "u64" },
          { "name": "last_cast_slot", "type": "u64" },
          { "name": "ata_subsidy_claimed", "type": "bool" },
          { "name": "is_honeypot", "type": "bool" },
          { "name": "first_process_fee_paid", "type": "bool" }
        ]
      }
    },
    {
      "name": "GlobalState",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "pubkey" },
          { "name": "fish_mint", "type": "pubkey" },
          { "name": "fogo_mint", "type": "pubkey" },
          { "name": "fogo_treasury", "type": "pubkey" },
          { "name": "fish_burn_vault", "type": "pubkey" },
          { "name": "current_difficulty", "type": "u64" },
          { "name": "total_network_power", "type": "u64" },
          { "name": "last_difficulty_adjustment", "type": "i64" },
          { "name": "base_emission_rate", "type": "u64" },
          { "name": "emission_decay_rate", "type": "u64" },
          { "name": "daily_target_emission", "type": "u64" },
          { "name": "total_fogo_collected", "type": "u128" },
          { "name": "total_fish_minted", "type": "u64" },
          { "name": "total_unprocessed_fish", "type": "u64" },
          { "name": "accumulated_processing_fees", "type": "u64" },
          { "name": "fees_per_unprocessed_fish", "type": "u128" },
          { "name": "bump", "type": "u8" },
          { "name": "halving_count", "type": "u8" }
        ]
      }
    },
    {
      "name": "Config",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "pubkey" },
          { "name": "issuer_pubkey", "type": "pubkey" },
          { "name": "require_capability_for_catch", "type": "bool" },
          { "name": "require_capability_for_spend", "type": "bool" },
          { "name": "require_fee_for_init", "type": "bool" },
          { "name": "soft_gate_mode", "type": "bool" },
          { "name": "basic_cooldown_ms", "type": "u32" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ]
} as const;

export type FogoFishingIDL = typeof FOGO_FISHING_IDL;
