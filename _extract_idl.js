const IDL = {
    address: "SEAyjT1FUx3JyXJnWt5NtjELDwuU9XsoZeZVPVvweU4",
    metadata: { name: "fogo_fishing", version: "0.1.0", spec: "0.1.0" },
    instructions: [
        {
            name: "admin_close_collection_grid",
            docs: [
                "ADMIN: Close a player's CollectionGrid (field guide) and return rent to authority.",
                "Only callable by program authority.",
            ],
            discriminator: [200, 19, 88, 155, 9, 66, 142, 72],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "collection_grid",
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [103, 114, 105, 100] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "admin_close_player",
            docs: [
                "ADMIN: Immediately close a player account and return rent to authority",
                "Use this to nuke bot accounts without waiting for them to process fish.",
                "Only callable by program authority.",
            ],
            discriminator: [25, 27, 85, 14, 60, 151, 195, 219],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "player_state",
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "admin_close_river_fish_state",
            docs: [
                "ADMIN: Close a player's RiverFishState and return rent to authority.",
                "Only callable by program authority.",
            ],
            discriminator: [195, 217, 229, 245, 146, 155, 92, 55],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "river_fish_state",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 115, 116, 97, 116, 101],
                            },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "admin_mint_fish",
            docs: [
                "TESTNET ONLY: Admin mint FISH tokens to any recipient",
                "This allows minting test tokens for QA without going through gameplay",
                "Only callable by program authority on testnet builds",
            ],
            discriminator: [155, 186, 242, 145, 253, 246, 148, 36],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                { name: "fish_mint", writable: !0 },
                { name: "recipient_ata", docs: ["The recipient's FISH token account"], writable: !0 },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
            ],
            args: [{ name: "amount", type: "u64" }],
        },
        {
            name: "admin_reset_legacy_flag",
            docs: ["TESTNET ONLY: Reset legacy_yield_claimed flag for test cycle reruns"],
            discriminator: [97, 230, 237, 43, 4, 65, 35, 101],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "player_state",
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "admin_set_player_snapshot",
            docs: ["TESTNET ONLY: Set a player's last_claim_fees_snapshot for yield testing"],
            discriminator: [155, 25, 153, 102, 238, 72, 183, 182],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "player_state",
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
            ],
            args: [
                { name: "owner", type: "pubkey" },
                { name: "new_snapshot", type: "u128" },
            ],
        },
        {
            name: "admin_set_unprocessed_fish",
            docs: [
                "ADMIN: Set a player's unprocessed_fish balance (customer support tool)",
                "Use this to grant fish to players as reimbursement or compensation.",
                "Only callable by program authority.",
            ],
            discriminator: [187, 61, 239, 27, 252, 66, 180, 184],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "player_state",
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
            ],
            args: [
                { name: "owner", type: "pubkey" },
                { name: "new_balance", type: "u64" },
            ],
        },
        {
            name: "buy_river_bait",
            docs: [
                "Buy river bait: burns FISH (difficulty-scaled) + charges a flat USDC fee (config-driven).",
                "Bait purchases add casts to the per-bait bucket; activation is separate and preserves remaining casts.",
            ],
            discriminator: [119, 241, 102, 109, 47, 24, 140, 172],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                { name: "owner_account" },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, gating flags)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "player_state",
                    docs: ["Player state for level gating"],
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                {
                    name: "river_fish_config",
                    docs: ["River fish config"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
                {
                    name: "river_fish_state",
                    docs: ["Player river fish state"],
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 115, 116, 97, 116, 101],
                            },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "fish_mint", writable: !0 },
                { name: "owner_fish_ata", docs: ["FISH tokens from OWNER (burned)"], writable: !0 },
                { name: "fogo_mint" },
                { name: "owner_fogo_ata", docs: ["USDC tokens from OWNER (fee)"], writable: !0 },
                { name: "buyback_treasury", docs: ["Buyback Treasury - receives 70% of bait USDC fees"], writable: !0 },
                {
                    name: "liquidity_treasury",
                    docs: ["Liquidity Treasury - receives 20% of bait USDC fees"],
                    writable: !0,
                },
                { name: "ops_treasury", docs: ["Ops Treasury - receives 10% of bait USDC fees"], writable: !0 },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token transfers/burns"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
            ],
            args: [
                { name: "owner", type: "pubkey" },
                { name: "bait_type", type: "u8" },
                { name: "quantity", type: "u32" },
            ],
        },
        {
            name: "buy_supercast",
            discriminator: [237, 164, 11, 46, 222, 119, 53, 237],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, gating flags)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on owner"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "fogo_mint", writable: !0 },
                {
                    name: "owner_fogo_ata",
                    docs: ["FOGO tokens from OWNER (session signer has delegated authority to spend)"],
                    writable: !0,
                },
                { name: "buyback_treasury", docs: ["Buyback Treasury - receives 50% of supercast fees"], writable: !0 },
                {
                    name: "liquidity_treasury",
                    docs: ["Liquidity Treasury - receives 10% of supercast fees"],
                    writable: !0,
                },
                { name: "ops_treasury", docs: ["Ops Treasury - receives 40% of supercast fees"], writable: !0 },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token transfers"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
            ],
            args: [
                { name: "owner", type: "pubkey" },
                { name: "tier_index", type: "u8" },
            ],
        },
        {
            name: "cast_line",
            discriminator: [16, 223, 158, 206, 88, 206, 92, 69],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, flags)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "rate_state",
                    docs: [
                        "Player-specific rate state (nonce/cooldown) - only required when capability checking is enabled",
                    ],
                },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
                { name: "slot_hashes", address: "SysvarS1otHashes111111111111111111111111111" },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on owner"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                {
                    name: "river_fish_config",
                    docs: ["Season 2 River Fish config (read-only)"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
                {
                    name: "river_fish_state",
                    docs: [
                        "Season 2 River Fish per-player state (bait remaining casts + pending catches)",
                        "Optional: If not provided (uninitialized player), Season 2 bait/catch features are skipped.",
                    ],
                    writable: !0,
                },
                { name: "system_program", address: "11111111111111111111111111111111" },
            ],
            args: [
                { name: "owner", type: "pubkey" },
                { name: "target_slot", type: "u64" },
                { name: "use_supercast", type: "bool" },
                { name: "_nonce", type: "u64" },
            ],
        },
        {
            name: "close_config",
            docs: [
                "Close the config account and return rent to authority.",
                "Used for schema migrations - close old config, then reinitialize with new schema.",
            ],
            discriminator: [145, 9, 72, 157, 95, 125, 61, 85],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["because the on-chain schema doesn't match the current code"],
                    writable: !0,
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
            ],
            args: [],
        },
        {
            name: "close_global_state",
            discriminator: [141, 150, 173, 249, 0, 50, 177, 215],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                { name: "destination", writable: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
            ],
            args: [],
        },
        {
            name: "create_fish_metadata",
            docs: [
                "Create metadata for the FISH token using the Global State PDA as mint authority.",
                "This is needed when the mint authority was transferred to the PDA before metadata was created.",
                "Only callable by the program authority.",
            ],
            discriminator: [14, 148, 239, 156, 24, 109, 34, 130],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                { name: "fish_mint", docs: ["The FISH mint account"], writable: !0 },
                { name: "metadata", docs: ["The metadata account to be created"], writable: !0 },
                { name: "token_metadata_program", address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" },
                { name: "system_program", address: "11111111111111111111111111111111" },
                { name: "rent", address: "SysvarRent111111111111111111111111111111111" },
            ],
            args: [
                { name: "name", type: "string" },
                { name: "symbol", type: "string" },
                { name: "uri", type: "string" },
            ],
        },
        {
            name: "create_referrer_info",
            docs: [
                "REFERRAL SYSTEM: Create a ReferrerInfo PDA to link a player to their referrer",
                "This is a separate PDA from PlayerState, so it can be created without modifying",
                "existing player accounts. Safe to deploy without any migration.",
                "",
                "Anyone can call this for any player who doesn't already have a ReferrerInfo.",
                "Once created, the referrer cannot be changed.",
            ],
            discriminator: [40, 154, 89, 242, 99, 85, 1, 177],
            accounts: [
                {
                    name: "fee_payer",
                    docs: ["The transaction fee payer (paymaster in production)"],
                    writable: !0,
                    signer: !0,
                },
                { name: "owner", docs: ["The player wallet who is registering a referrer"] },
                {
                    name: "referrer_info",
                    docs: ["ReferrerInfo PDA - stores the referrer relationship", 'Seeds: ["referrer", owner]'],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [114, 101, 102, 101, 114, 114, 101, 114] },
                            { kind: "account", path: "owner" },
                        ],
                    },
                },
                { name: "system_program", address: "11111111111111111111111111111111" },
            ],
            args: [{ name: "referrer", type: "pubkey" }],
        },
        {
            name: "debug_damage_rod",
            discriminator: [234, 31, 5, 5, 29, 165, 104, 111],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, gating flags)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on owner"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "fogo_mint", writable: !0 },
                {
                    name: "owner_fogo_ata",
                    docs: ["FOGO tokens from OWNER (session signer has delegated authority to spend)"],
                    writable: !0,
                },
                { name: "buyback_treasury", docs: ["Buyback Treasury - receives 50% of repair fees"], writable: !0 },
                {
                    name: "liquidity_treasury",
                    docs: ["Liquidity Treasury - receives 10% of repair fees"],
                    writable: !0,
                },
                { name: "ops_treasury", docs: ["Ops Treasury - receives 40% of repair fees"], writable: !0 },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token transfers"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "debug_repair_rod_enforced",
            docs: ["DEV ONLY: Enforce repair threshold and restore to full without token transfers."],
            discriminator: [114, 248, 33, 25, 212, 39, 173, 88],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, gating flags)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on owner"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "fogo_mint", writable: !0 },
                {
                    name: "owner_fogo_ata",
                    docs: ["FOGO tokens from OWNER (session signer has delegated authority to spend)"],
                    writable: !0,
                },
                { name: "buyback_treasury", docs: ["Buyback Treasury - receives 50% of repair fees"], writable: !0 },
                {
                    name: "liquidity_treasury",
                    docs: ["Liquidity Treasury - receives 10% of repair fees"],
                    writable: !0,
                },
                { name: "ops_treasury", docs: ["Ops Treasury - receives 40% of repair fees"], writable: !0 },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token transfers"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "debug_shift_durability_time",
            docs: ["DEV ONLY: Shift durability timestamp backwards to simulate elapsed time for regen."],
            discriminator: [148, 123, 82, 81, 134, 214, 82, 23],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, gating flags)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on owner"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "fogo_mint", writable: !0 },
                {
                    name: "owner_fogo_ata",
                    docs: ["FOGO tokens from OWNER (session signer has delegated authority to spend)"],
                    writable: !0,
                },
                { name: "buyback_treasury", docs: ["Buyback Treasury - receives 50% of repair fees"], writable: !0 },
                {
                    name: "liquidity_treasury",
                    docs: ["Liquidity Treasury - receives 10% of repair fees"],
                    writable: !0,
                },
                { name: "ops_treasury", docs: ["Ops Treasury - receives 40% of repair fees"], writable: !0 },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token transfers"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
            ],
            args: [
                { name: "owner", type: "pubkey" },
                { name: "seconds_back", type: "i64" },
            ],
        },
        {
            name: "finish_upgrade",
            docs: ["ECONOMIC REBALANCE: Finish upgrade (completes after cast requirement met)"],
            discriminator: [41, 200, 85, 131, 105, 69, 118, 105],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on owner"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "fix_river_fish_config_layout",
            docs: [
                "ADMIN: Fix RiverFishConfig data layout after realloc from 32→34 fish entries.",
                "The realloc appended zeros at the end, but fish_count/is_active/bump stayed at",
                "their old offsets (after 32 fish entries) instead of moving to after 34 entries.",
                "This one-shot migration reads the old values and writes them to the correct positions.",
            ],
            discriminator: [252, 43, 220, 229, 24, 120, 240, 184],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "river_fish_config",
                    docs: [
                        "UncheckedAccount because Anchor's typed deserialization would fail",
                        "on the old layout. The instruction handles raw data safely.",
                    ],
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
                { name: "system_program", address: "11111111111111111111111111111111" },
            ],
            args: [],
        },
        {
            name: "init_collection_grid",
            docs: ["Initialize a player's collection grid"],
            discriminator: [3, 111, 206, 24, 208, 22, 249, 54],
            accounts: [
                { name: "fee_payer", writable: !0, signer: !0 },
                { name: "signer", signer: !0 },
                {
                    name: "player_state",
                    docs: ["Player state must exist"],
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                {
                    name: "river_fish_config",
                    docs: ["River fish config (Season 2 board uses 32 slots)"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
                {
                    name: "collection_grid",
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [103, 114, 105, 100] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "system_program", address: "11111111111111111111111111111111" },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "init_river_fish_config",
            docs: [
                "ADMIN: Initialize RiverFishConfig PDA (Season 2 River Board).",
                'Seeds: ["river-fish-config"]',
                "Note: This only initializes bait definitions from the doc; fish table + fees",
                "must be configured via admin setters before activation.",
            ],
            discriminator: [230, 199, 35, 33, 115, 183, 177, 207],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "river_fish_config",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
                { name: "system_program", address: "11111111111111111111111111111111" },
            ],
            args: [{ name: "collection_mint", type: "pubkey" }],
        },
        {
            name: "init_river_fish_state",
            docs: ["Initialize a player's RiverFishState PDA."],
            discriminator: [170, 109, 127, 100, 100, 177, 64, 247],
            accounts: [
                { name: "fee_payer", writable: !0, signer: !0 },
                { name: "signer", signer: !0 },
                {
                    name: "player_state",
                    docs: ["Player state must exist"],
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                {
                    name: "river_fish_state",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 115, 116, 97, 116, 101],
                            },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "system_program", address: "11111111111111111111111111111111" },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "initialize_config",
            discriminator: [208, 127, 21, 1, 194, 190, 196, 70],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    writable: !0,
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                { name: "system_program", address: "11111111111111111111111111111111" },
            ],
            args: [
                { name: "issuer_pubkey", type: "pubkey" },
                { name: "require_capability_for_catch", type: "bool" },
                { name: "require_capability_for_spend", type: "bool" },
                { name: "require_fee_for_init", type: "bool" },
                { name: "soft_gate_mode", type: "bool" },
                { name: "basic_cooldown_ms", type: "u32" },
            ],
        },
        {
            name: "initialize_difficulty_tracker",
            docs: [
                "ADMIN ONLY: Initialize the DifficultyTracker PDA for 24h-based difficulty adjustment",
                "",
                "This creates a separate PDA that tracks fish caught per difficulty adjustment period.",
                "Once initialized, refresh_difficulty will use 24h-based calculations instead of",
                "all-time averages.",
                "",
                "Run once after program upgrade. Safe to call - will fail if already initialized.",
            ],
            discriminator: [26, 93, 181, 253, 252, 91, 226, 54],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "difficulty_tracker",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    100, 105, 102, 102, 105, 99, 117, 108, 116, 121, 45, 116, 114, 97, 99, 107, 101,
                                    114,
                                ],
                            },
                        ],
                    },
                },
                { name: "system_program", address: "11111111111111111111111111111111" },
            ],
            args: [],
        },
        {
            name: "initialize_global_state",
            discriminator: [232, 254, 209, 244, 123, 89, 154, 207],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                { name: "fish_mint", writable: !0 },
                { name: "fogo_mint" },
                { name: "fogo_treasury", writable: !0 },
                { name: "fish_burn_vault", writable: !0 },
                { name: "system_program", address: "11111111111111111111111111111111" },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
            ],
            args: [{ name: "params", type: { defined: { name: "InitializeGlobalStateParams" } } }],
        },
        {
            name: "initialize_player",
            discriminator: [79, 249, 88, 177, 220, 62, 56, 128],
            accounts: [
                {
                    name: "fee_payer",
                    docs: ["The transaction fee payer (paymaster in production)"],
                    writable: !0,
                    signer: !0,
                },
                { name: "signer", docs: ["The signer (session key)"], signer: !0 },
                {
                    name: "owner",
                    docs: ["The owner wallet (NOT a signer - this is who owns the tokens and player state)"],
                },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, gating flags)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on OWNER wallet (not signer)"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "account", path: "owner" },
                        ],
                    },
                },
                { name: "fogo_mint", writable: !0 },
                {
                    name: "owner_fogo_ata",
                    docs: [
                        "FOGO tokens from OWNER (session signer has delegated authority to spend)",
                        "init_if_needed: Creates the ATA if it doesn't exist (paymaster sponsors)",
                    ],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "account", path: "owner" },
                            {
                                kind: "const",
                                value: [
                                    6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28,
                                    180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169,
                                ],
                            },
                            { kind: "account", path: "fogo_mint" },
                        ],
                        program: {
                            kind: "const",
                            value: [
                                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131, 11, 90, 19, 153,
                                218, 255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89,
                            ],
                        },
                    },
                },
                { name: "fish_mint", writable: !0 },
                {
                    name: "owner_fish_ata",
                    docs: [
                        "FISH token account for owner - created during initialization",
                        "init_if_needed: Creates the ATA if it doesn't exist (protocol pays = fully gasless)",
                    ],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "account", path: "owner" },
                            {
                                kind: "const",
                                value: [
                                    6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28,
                                    180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169,
                                ],
                            },
                            { kind: "account", path: "fish_mint" },
                        ],
                        program: {
                            kind: "const",
                            value: [
                                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131, 11, 90, 19, 153,
                                218, 255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89,
                            ],
                        },
                    },
                },
                {
                    name: "base_treasury",
                    docs: [
                        "Base Treasury - receives 100% of boat purchases (tiers 1-3)",
                        "SECURITY: Address is hardcoded (except localnet for testing)",
                    ],
                    writable: !0,
                },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token transfers"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "associated_token_program", address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" },
                { name: "system_program", address: "11111111111111111111111111111111" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
            ],
            args: [
                { name: "boat_tier", type: "u8" },
                { name: "referrer", type: "pubkey" },
            ],
        },
        {
            name: "initialize_player_local",
            docs: [
                "TEST/LOCAL: Initialize player without payments (bypass treasuries)",
                "This instruction is intended for local testing and unit tests only.",
                "It mirrors initialize_player but skips SPL FOGO checks and transfers.",
            ],
            discriminator: [14, 17, 146, 43, 217, 76, 201, 71],
            accounts: [
                {
                    name: "fee_payer",
                    docs: ["The transaction fee payer (covers account creations)"],
                    writable: !0,
                    signer: !0,
                },
                { name: "signer", docs: ["The signer (session key or user wallet)"], signer: !0 },
                { name: "owner", docs: ["The owner wallet (NOT a signer)"] },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on OWNER wallet (not signer)"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "account", path: "owner" },
                        ],
                    },
                },
                { name: "fish_mint", writable: !0 },
                {
                    name: "owner_fish_ata",
                    docs: ["FISH token account for owner - ensure it exists"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "account", path: "owner" },
                            {
                                kind: "const",
                                value: [
                                    6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28,
                                    180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169,
                                ],
                            },
                            { kind: "account", path: "fish_mint" },
                        ],
                        program: {
                            kind: "const",
                            value: [
                                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131, 11, 90, 19, 153,
                                218, 255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89,
                            ],
                        },
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "associated_token_program", address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" },
                { name: "system_program", address: "11111111111111111111111111111111" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
            ],
            args: [{ name: "referrer", type: "pubkey" }],
        },
        {
            name: "initialize_player_with_tier",
            docs: ["Initialize player with explicit boat tier: 1=Free, 2=Mid, 3=Premium, 4=Trump"],
            discriminator: [250, 239, 254, 120, 178, 17, 238, 36],
            accounts: [
                {
                    name: "fee_payer",
                    docs: ["The transaction fee payer (paymaster in production)"],
                    writable: !0,
                    signer: !0,
                },
                { name: "signer", docs: ["The signer (session key)"], signer: !0 },
                {
                    name: "owner",
                    docs: ["The owner wallet (NOT a signer - this is who owns the tokens and player state)"],
                },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, gating flags)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on OWNER wallet (not signer)"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "account", path: "owner" },
                        ],
                    },
                },
                { name: "fogo_mint", writable: !0 },
                {
                    name: "owner_fogo_ata",
                    docs: [
                        "FOGO tokens from OWNER (session signer has delegated authority to spend)",
                        "init_if_needed: Creates the ATA if it doesn't exist (paymaster sponsors)",
                    ],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "account", path: "owner" },
                            {
                                kind: "const",
                                value: [
                                    6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28,
                                    180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169,
                                ],
                            },
                            { kind: "account", path: "fogo_mint" },
                        ],
                        program: {
                            kind: "const",
                            value: [
                                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131, 11, 90, 19, 153,
                                218, 255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89,
                            ],
                        },
                    },
                },
                { name: "fish_mint", writable: !0 },
                {
                    name: "owner_fish_ata",
                    docs: [
                        "FISH token account for owner - created during initialization",
                        "init_if_needed: Creates the ATA if it doesn't exist (protocol pays = fully gasless)",
                    ],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "account", path: "owner" },
                            {
                                kind: "const",
                                value: [
                                    6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28,
                                    180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169,
                                ],
                            },
                            { kind: "account", path: "fish_mint" },
                        ],
                        program: {
                            kind: "const",
                            value: [
                                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131, 11, 90, 19, 153,
                                218, 255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89,
                            ],
                        },
                    },
                },
                {
                    name: "base_treasury",
                    docs: [
                        "Base Treasury - receives 100% of boat purchases (tiers 1-3)",
                        "SECURITY: Address is hardcoded (except localnet for testing)",
                    ],
                    writable: !0,
                },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token transfers"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "associated_token_program", address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" },
                { name: "system_program", address: "11111111111111111111111111111111" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
            ],
            args: [
                { name: "boat_tier", type: "u8" },
                { name: "referrer", type: "pubkey" },
            ],
        },
        {
            name: "migrate_collection_grid",
            docs: [
                "ADMIN: Migrate a CollectionGrid account to the current layout (113 data bytes).",
                "Handles migration from pre-specimens_submitted (79 bytes) or pre-34-fish (111 bytes).",
                "Extends the account and zeros new bytes. Safe to call multiple times — no-ops",
                "if the account is already the right size.",
            ],
            discriminator: [150, 190, 131, 204, 101, 216, 53, 174],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "collection_grid",
                    docs: [
                        "UncheckedAccount because Anchor's normal deserialization would fail",
                        "on the old 87-byte layout. The instruction handles raw data safely.",
                    ],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [103, 114, 105, 100] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "system_program", address: "11111111111111111111111111111111" },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "mint_river_fish_nft",
            docs: [
                "Mint the next caught river fish NFT from the player's pending queue.",
                "This is intentionally separate from `cast_line` (no Metaplex CPI in hot path).",
            ],
            discriminator: [248, 123, 11, 104, 225, 111, 101, 176],
            accounts: [
                { name: "fee_payer", docs: ["Pays for new accounts (mint, ATAs, metadata)"], writable: !0, signer: !0 },
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                { name: "owner_account" },
                {
                    name: "global_state",
                    docs: ["Global state PDA used as mint + metadata update authority"],
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "player_state",
                    docs: ["Player state for verification"],
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                {
                    name: "river_fish_config",
                    docs: ["River fish config"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
                {
                    name: "river_fish_state",
                    docs: ["Player river fish state (pending queue is mutated)"],
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 115, 116, 97, 116, 101],
                            },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                {
                    name: "nft_mint",
                    docs: ["New NFT mint (created for this fish). Nonce allows retry on PDA collision."],
                    writable: !0,
                },
                {
                    name: "owner_nft_ata",
                    docs: ["Owner's NFT token account (ATA) receiving the minted fish"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "account", path: "owner_account" },
                            {
                                kind: "const",
                                value: [
                                    6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28,
                                    180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169,
                                ],
                            },
                            { kind: "account", path: "nft_mint" },
                        ],
                        program: {
                            kind: "const",
                            value: [
                                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131, 11, 90, 19, 153,
                                218, 255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89,
                            ],
                        },
                    },
                },
                {
                    name: "river_fish_mint_record",
                    docs: ["Record PDA proving this mint corresponds to a Season 2 river fish"],
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 109, 105, 110, 116],
                            },
                            { kind: "account", path: "nft_mint" },
                        ],
                    },
                },
                { name: "nft_metadata", writable: !0 },
                { name: "nft_master_edition", writable: !0 },
                {
                    name: "collection_mint",
                    docs: ["The collection NFT mint (verified at runtime via VerifySizedCollectionItem CPI)"],
                },
                { name: "collection_metadata", writable: !0 },
                { name: "collection_master_edition" },
                { name: "token_metadata_program", address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "associated_token_program", address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" },
                { name: "system_program", address: "11111111111111111111111111111111" },
                { name: "rent", address: "SysvarRent111111111111111111111111111111111" },
            ],
            args: [
                { name: "owner", type: "pubkey" },
                { name: "pending_offset", type: "u8" },
                { name: "expected_fish_id", type: "u8" },
                { name: "expected_cast_count", type: "u64" },
                { name: "uri", type: "string" },
                { name: "nonce", type: "u8" },
            ],
        },
        {
            name: "admin_clear_pending_catches",
            docs: [
                "ADMIN: Clear all pending catches from a player's RiverFishState queue.",
                "Used to unstick players whose pending mints collided or expired.",
            ],
            discriminator: [85, 53, 170, 128, 15, 130, 176, 106],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                { name: "global_state" },
                { name: "river_fish_state", writable: !0 },
            ],
            args: [{ name: "_player", type: "pubkey" }],
        },
        {
            name: "place_on_grid",
            docs: [
                "Submit a specimen toward a field guide entry (burns 1 NFT per call).",
                "",
                "Multi-specimen system: each species requires SPECIMENS_REQUIRED[fish_id]",
                "NFTs to be submitted before the entry completes. Each call burns 1 NFT and",
                "increments the on-chain counter. On the FINAL submission (when the count",
                "reaches the requirement), the FISH mount cost is charged and the slot is",
                "marked complete.",
                "",
                "This creates an engaging progression loop:",
                '- Players see "3/25 Bluegills submitted" and want to keep going',
                "- NFTs are burned one at a time (fits within Solana account limits)",
                "- The marketplace gets depth (players list extras, whales buy them)",
                "- FISH mount cost is deferred to the final submission (reward moment)",
            ],
            discriminator: [141, 40, 38, 6, 240, 190, 172, 234],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                {
                    name: "global_state",
                    docs: ["Global state (for fish_mint reference)"],
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, gating flags — needed for spend capability)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "player_state",
                    docs: ["Player state for verification"],
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                {
                    name: "collection_grid",
                    docs: ["Collection grid to update"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [103, 114, 105, 100] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                {
                    name: "river_fish_config",
                    docs: ["River fish config for validation + rarity lookup"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
                {
                    name: "river_fish_mint_record",
                    docs: ["Per-mint record proving this is a Season 2 river fish minted by the program"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 109, 105, 110, 116],
                            },
                            { kind: "account", path: "nft_mint" },
                        ],
                    },
                },
                { name: "nft_mint", docs: ["The NFT mint being placed/burned"], writable: !0 },
                { name: "owner_nft_ata", docs: ["Owner's NFT token account (will be burned from)"], writable: !0 },
                {
                    name: "nft_metadata",
                    docs: ['Address: PDA from Metaplex with seeds ["metadata", token_metadata_program, nft_mint]'],
                },
                { name: "fish_mint", docs: ["FISH mint (for burn)"], writable: !0 },
                { name: "owner_fish_ata", docs: ["Owner's FISH token account (FISH burned from here)"], writable: !0 },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token burns"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
            ],
            args: [
                { name: "owner", type: "pubkey" },
                { name: "grid_slot", type: "u8" },
            ],
        },
        {
            name: "process_fish",
            docs: [
                "PHASE 3: Process unprocessed FISH into liquid tokens (ORE Model)",
                "Players accumulate unprocessed fish from fishing which earns yield from processing fees",
                "When they process: 10% fee → distributed to remaining unprocessed fish holders",
                "Creates game theory: Hold for yield vs Process for liquidity",
            ],
            discriminator: [213, 71, 113, 44, 222, 228, 52, 74],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                { name: "owner_account" },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, gating flags)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on owner"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "fish_mint", writable: !0 },
                { name: "owner_fish_ata", writable: !0 },
                {
                    name: "referrer_info",
                    docs: [
                        "If valid, we'll pay 1% to the referrer's FISH ATA.",
                        'Seeds: ["referrer", owner] - validated in instruction logic.',
                    ],
                },
                {
                    name: "referrer_fish_ata",
                    docs: [
                        "If player has no referrer (no ReferrerInfo PDA), this can be any account (unused).",
                        "Validated in instruction logic to match referrer_info.referrer's ATA.",
                    ],
                    writable: !0,
                },
                { name: "fogo_mint" },
                {
                    name: "owner_fogo_ata",
                    docs: ["USDC tokens from OWNER (session signer has delegated authority to spend)"],
                    writable: !0,
                },
                {
                    name: "buyback_treasury",
                    docs: ["Buyback Treasury - receives 70% of processing fees"],
                    writable: !0,
                },
                {
                    name: "liquidity_treasury",
                    docs: ["Liquidity Treasury - receives 20% of processing fees"],
                    writable: !0,
                },
                { name: "ops_treasury", docs: ["Ops Treasury - receives 10% of processing fees"], writable: !0 },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token transfers/burns"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "associated_token_program", address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" },
                { name: "system_program", address: "11111111111111111111111111111111" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
                {
                    name: "difficulty_tracker",
                    docs: [
                        'If this is the valid tracker PDA (seeds: ["difficulty-tracker"]), use v3 calculation.',
                        "If not (e.g., system program passed as placeholder), fall back to legacy calculation.",
                        "This allows backward compatibility - existing clients can pass SystemProgram.programId.",
                    ],
                    writable: !0,
                },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "realloc_river_fish_config",
            docs: [
                "ADMIN: Reallocate the RiverFishConfig account to match the current program layout.",
                "Required after RIVER_FISH_COUNT increases (e.g., 32→34). The account was originally",
                "created with space for 32 fish entries; this extends it to hold RIVER_FISH_COUNT entries.",
                "Safe to call multiple times — no-ops if already the correct size.",
                "New bytes are zero-initialized (default RiverFishTypeConfig).",
            ],
            discriminator: [124, 4, 250, 186, 179, 67, 126, 171],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "river_fish_config",
                    docs: [
                        "UncheckedAccount because Anchor's typed deserialization would fail",
                        "on the old layout. The instruction handles raw data safely.",
                    ],
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
                { name: "system_program", address: "11111111111111111111111111111111" },
            ],
            args: [],
        },
        {
            name: "record_catch",
            docs: [
                "Record catch delta for a player to keep global totals accurate without a keeper.",
                "Permissionless and idempotent: anyone can call; computes delta from on-chain state.",
            ],
            discriminator: [36, 14, 58, 242, 96, 105, 45, 233],
            accounts: [
                { name: "signer", docs: ["Any signer (payer); permissionless"], signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "player_state",
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "refresh_difficulty",
            discriminator: [239, 15, 255, 193, 71, 249, 29, 100],
            accounts: [
                { name: "authority", signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
            ],
            args: [],
        },
        {
            name: "refresh_difficulty_if_due",
            discriminator: [211, 130, 130, 108, 162, 134, 101, 219],
            accounts: [
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
            ],
            args: [],
        },
        {
            name: "refresh_difficulty_if_due_v3",
            docs: [
                "V3: Permissionless refresh difficulty using 24h period-based calculation",
                "",
                "Anyone can call this once the 24h epoch has elapsed.",
                "Uses the DifficultyTracker PDA for period-based calculations.",
            ],
            discriminator: [149, 221, 73, 3, 45, 114, 116, 67],
            accounts: [
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "difficulty_tracker",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    100, 105, 102, 102, 105, 99, 117, 108, 116, 121, 45, 116, 114, 97, 99, 107, 101,
                                    114,
                                ],
                            },
                        ],
                    },
                },
            ],
            args: [],
        },
        {
            name: "refresh_difficulty_v3",
            docs: [
                "V3: Admin refresh difficulty using 24h period-based calculation",
                "",
                "This uses the DifficultyTracker PDA to calculate difficulty based on",
                "fish caught in the current 24h period, instead of all-time average.",
                "Much more responsive to recent activity changes.",
            ],
            discriminator: [54, 144, 54, 10, 142, 9, 159, 11],
            accounts: [
                { name: "authority", signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "difficulty_tracker",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    100, 105, 102, 102, 105, 99, 117, 108, 116, 121, 45, 116, 114, 97, 99, 107, 101,
                                    114,
                                ],
                            },
                        ],
                    },
                },
            ],
            args: [],
        },
        {
            name: "repair_rod",
            discriminator: [165, 110, 183, 42, 82, 7, 135, 155],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, gating flags)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on owner"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "fogo_mint", writable: !0 },
                {
                    name: "owner_fogo_ata",
                    docs: ["FOGO tokens from OWNER (session signer has delegated authority to spend)"],
                    writable: !0,
                },
                { name: "buyback_treasury", docs: ["Buyback Treasury - receives 50% of repair fees"], writable: !0 },
                {
                    name: "liquidity_treasury",
                    docs: ["Liquidity Treasury - receives 10% of repair fees"],
                    writable: !0,
                },
                { name: "ops_treasury", docs: ["Ops Treasury - receives 40% of repair fees"], writable: !0 },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token transfers"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "reset_halving_count",
            docs: ["ADMIN ONLY: Reset halving count (emergency fix for incorrect halvings)"],
            discriminator: [0, 245, 239, 192, 227, 156, 115, 45],
            accounts: [
                { name: "authority", signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
            ],
            args: [{ name: "new_count", type: "u8" }],
        },
        {
            name: "set_active_river_bait",
            docs: [
                "Set active river bait (one active at a time; toggling preserves remaining casts).",
                "`bait_type = 0` clears the active bait.",
            ],
            discriminator: [107, 218, 75, 118, 236, 101, 107, 28],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                {
                    name: "player_state",
                    docs: ["Player state for gating"],
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                {
                    name: "river_fish_config",
                    docs: ["River fish config"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
                {
                    name: "river_fish_state",
                    docs: ["Player river fish state"],
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 115, 116, 97, 116, 101],
                            },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
            ],
            args: [
                { name: "owner", type: "pubkey" },
                { name: "bait_type", type: "u8" },
            ],
        },
        {
            name: "set_daily_target_emission",
            docs: [
                "ADMIN ONLY: Directly set daily target emission",
                "Use to fix incorrect halving or adjust emission targets",
            ],
            discriminator: [184, 24, 189, 150, 165, 98, 160, 94],
            accounts: [
                { name: "authority", signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
            ],
            args: [{ name: "new_target", type: "u64" }],
        },
        {
            name: "set_difficulty",
            docs: [
                "ADMIN ONLY: Directly set difficulty to a specific value",
                "Use with caution - this bypasses the normal difficulty adjustment formula",
                "Also resets the DifficultyTracker to start a fresh 24h period",
            ],
            discriminator: [240, 249, 174, 217, 65, 121, 195, 104],
            accounts: [
                { name: "authority", signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "difficulty_tracker",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    100, 105, 102, 102, 105, 99, 117, 108, 116, 121, 45, 116, 114, 97, 99, 107, 101,
                                    114,
                                ],
                            },
                        ],
                    },
                },
            ],
            args: [{ name: "new_difficulty", type: "u64" }],
        },
        {
            name: "set_game_paused",
            docs: [
                "MAINTENANCE PAUSE: Toggle the game pause flag on or off.",
                "When paused, cast_line, record_catch, and process_fish are blocked.",
                "Only callable by the program authority.",
            ],
            discriminator: [106, 68, 231, 254, 64, 221, 70, 59],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
            ],
            args: [{ name: "paused", type: "bool" }],
        },
        {
            name: "set_honeypot",
            docs: [
                "HONEYPOT: Flag a player account for burning on next process_fish",
                "Only callable by program authority. Flagged accounts will have their",
                "entire FISH wallet balance burned when they call process_fish.",
            ],
            discriminator: [13, 21, 55, 106, 63, 85, 235, 174],
            accounts: [
                { name: "authority", signer: !0 },
                {
                    name: "global_state",
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "player_state",
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
            ],
            args: [
                { name: "owner", type: "pubkey" },
                { name: "enabled", type: "bool" },
            ],
        },
        {
            name: "set_river_bait_usdc_fee",
            docs: ["ADMIN: Set per-bait USDC fee (6 decimals). Required before activation."],
            discriminator: [31, 86, 103, 37, 115, 100, 65, 110],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "river_fish_config",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
            ],
            args: [
                { name: "bait_type", type: "u8" },
                { name: "usdc_fee", type: "u64" },
            ],
        },
        {
            name: "set_river_bait_fish_cost",
            docs: [
                "ADMIN: Update a bait's FISH cost at reference difficulty (6 decimals).",
                "Allows tuning bait economics post-init without a program redeploy.",
            ],
            discriminator: [150, 134, 114, 19, 123, 131, 45, 152],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "river_fish_config",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
            ],
            args: [
                { name: "bait_type", type: "u8" },
                { name: "fish_cost_at_ref_difficulty", type: "u64" },
            ],
        },
        {
            name: "set_river_fish_active",
            docs: ["ADMIN: Activate or deactivate the River Fish system."],
            discriminator: [222, 82, 166, 135, 122, 234, 145, 77],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "river_fish_config",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
            ],
            args: [{ name: "is_active", type: "bool" }],
        },
        {
            name: "set_river_fish_collection_mint",
            docs: ["ADMIN: Update the collection mint stored in RiverFishConfig."],
            discriminator: [114, 46, 13, 87, 177, 63, 182, 218],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "river_fish_config",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
            ],
            args: [{ name: "new_collection_mint", type: "pubkey" }],
        },
        {
            name: "set_river_fish_count",
            docs: ["ADMIN: Set fish_count (must be 32 before activation)."],
            discriminator: [70, 7, 38, 1, 224, 239, 104, 111],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "river_fish_config",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
            ],
            args: [{ name: "fish_count", type: "u8" }],
        },
        {
            name: "set_river_fish_entry",
            docs: ["ADMIN: Set a fish table entry."],
            discriminator: [157, 84, 19, 243, 3, 238, 137, 34],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "river_fish_config",
                    writable: !0,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    114, 105, 118, 101, 114, 45, 102, 105, 115, 104, 45, 99, 111, 110, 102, 105, 103,
                                ],
                            },
                        ],
                    },
                },
            ],
            args: [
                { name: "fish_id", type: "u8" },
                { name: "required_bait", type: "u8" },
                { name: "rarity_tier", type: "u8" },
                { name: "catch_rate_ppb", type: "u64" },
            ],
        },
        {
            name: "set_yield_gate",
            docs: [
                "S2 YIELD GATE: Toggle the yield level-gate on or off.",
                "When active, post-S2 yield is multiplied by (rod_level/MAX_ROD_LEVEL)^2.",
                "Only callable by the program authority.",
            ],
            discriminator: [111, 4, 182, 236, 31, 210, 98, 67],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
            ],
            args: [{ name: "active", type: "bool" }],
        },
        {
            name: "skip_upgrade_timer",
            docs: ["ECONOMIC REBALANCE: Skip upgrade timer (instantly completes for FOGO payment)"],
            discriminator: [141, 215, 245, 3, 116, 212, 120, 119],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, gating flags)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on owner"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "fogo_mint", writable: !0 },
                {
                    name: "owner_fogo_ata",
                    docs: ["FOGO tokens from OWNER (session signer has delegated authority to spend)"],
                    writable: !0,
                },
                { name: "buyback_treasury", docs: ["Buyback Treasury - receives 50% of skip fees"], writable: !0 },
                { name: "liquidity_treasury", docs: ["Liquidity Treasury - receives 10% of skip fees"], writable: !0 },
                { name: "ops_treasury", docs: ["Ops Treasury - receives 40% of skip fees"], writable: !0 },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token transfers"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
            ],
            args: [{ name: "owner", type: "pubkey" }],
        },
        {
            name: "start_upgrade",
            docs: ["ECONOMIC REBALANCE: Start upgrade (burns FISH+FOGO, starts cast timer)"],
            discriminator: [134, 190, 143, 225, 188, 141, 38, 116],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "config",
                    docs: ["Global config (issuer key, gating flags)"],
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on owner"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "fish_mint", writable: !0 },
                { name: "owner_fish_ata", docs: ["FISH tokens from OWNER's account"], writable: !0 },
                { name: "fogo_mint", writable: !0 },
                {
                    name: "owner_fogo_ata",
                    docs: ["FOGO tokens from OWNER (session signer has delegated authority to spend)"],
                    writable: !0,
                },
                { name: "buyback_treasury", docs: ["Buyback Treasury - receives 50% of upgrade fees"], writable: !0 },
                {
                    name: "liquidity_treasury",
                    docs: ["Liquidity Treasury - receives 10% of upgrade fees"],
                    writable: !0,
                },
                { name: "ops_treasury", docs: ["Ops Treasury - receives 40% of upgrade fees"], writable: !0 },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token transfers"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { name: "instructions_sysvar", address: "Sysvar1nstructions1111111111111111111111111" },
            ],
            args: [
                { name: "owner", type: "pubkey" },
                { name: "target_level", type: "u8" },
            ],
        },
        {
            name: "update_config",
            discriminator: [29, 158, 252, 191, 10, 83, 219, 99],
            accounts: [
                { name: "authority", signer: !0 },
                {
                    name: "config",
                    writable: !0,
                    pda: { seeds: [{ kind: "const", value: [99, 111, 110, 102, 105, 103] }] },
                },
            ],
            args: [
                { name: "issuer_pubkey", type: { option: "pubkey" } },
                { name: "require_capability_for_catch", type: { option: "bool" } },
                { name: "require_capability_for_spend", type: { option: "bool" } },
                { name: "require_fee_for_init", type: { option: "bool" } },
                { name: "soft_gate_mode", type: { option: "bool" } },
                { name: "basic_cooldown_ms", type: { option: "u32" } },
            ],
        },
        {
            name: "update_fish_metadata",
            docs: [
                "Update metadata for the FISH token using the Global State PDA as update authority.",
                "Only callable by the program authority.",
            ],
            discriminator: [202, 94, 120, 133, 194, 38, 99, 213],
            accounts: [
                { name: "authority", writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                { name: "fish_mint", docs: ["The FISH mint account"] },
                { name: "metadata", docs: ["The metadata account to update"], writable: !0 },
                { name: "token_metadata_program", address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" },
            ],
            args: [
                { name: "name", type: "string" },
                { name: "symbol", type: "string" },
                { name: "uri", type: "string" },
            ],
        },
        {
            name: "upgrade_rod",
            docs: [
                "DEPRECATED: This instant upgrade bypasses cast gates and breaks economy.",
                "Use start_upgrade + finish_upgrade (or skip_upgrade_timer) instead.",
                "This function will always fail to prevent exploitation.",
            ],
            discriminator: [18, 73, 23, 60, 255, 5, 83, 206],
            accounts: [
                { name: "signer", docs: ["The signer (session key or user wallet)"], writable: !0, signer: !0 },
                {
                    name: "global_state",
                    writable: !0,
                    pda: {
                        seeds: [{ kind: "const", value: [103, 108, 111, 98, 97, 108, 45, 115, 116, 97, 116, 101] }],
                    },
                },
                {
                    name: "player_state",
                    docs: ["Player state PDA based on owner"],
                    writable: !0,
                    pda: {
                        seeds: [
                            { kind: "const", value: [112, 108, 97, 121, 101, 114] },
                            { kind: "arg", path: "owner" },
                        ],
                    },
                },
                { name: "fish_mint", writable: !0 },
                { name: "owner_fish_ata", docs: ["FISH tokens from OWNER's account"], writable: !0 },
                { name: "fogo_mint", writable: !0 },
                {
                    name: "owner_fogo_ata",
                    docs: ["FOGO tokens from OWNER (session signer has delegated authority to spend)"],
                    writable: !0,
                },
                {
                    name: "buyback_treasury",
                    docs: [
                        "Buyback Treasury - receives 50% of upgrade fees",
                        "SECURITY: Address is hardcoded (except localnet for testing)",
                    ],
                    writable: !0,
                },
                {
                    name: "liquidity_treasury",
                    docs: [
                        "Liquidity Treasury - receives 10% of upgrade fees",
                        "SECURITY: Address is hardcoded (except localnet for testing)",
                    ],
                    writable: !0,
                },
                {
                    name: "ops_treasury",
                    docs: [
                        "Ops Treasury - receives 40% of upgrade fees",
                        "SECURITY: Address is hardcoded (except localnet for testing)",
                    ],
                    writable: !0,
                },
                {
                    name: "program_signer",
                    docs: ["Program signer PDA for Fogo Sessions token transfers"],
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [
                                    102, 111, 103, 111, 95, 115, 101, 115, 115, 105, 111, 110, 95, 112, 114, 111, 103,
                                    114, 97, 109, 95, 115, 105, 103, 110, 101, 114,
                                ],
                            },
                        ],
                    },
                },
                { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
            ],
            args: [{ name: "_owner", type: "pubkey" }],
        },
    ],
    accounts: [
        { name: "CollectionGrid", discriminator: [151, 11, 27, 184, 66, 20, 139, 161] },
        { name: "Config", discriminator: [155, 12, 170, 224, 30, 250, 204, 130] },
        { name: "DifficultyTracker", discriminator: [47, 230, 7, 21, 179, 122, 54, 104] },
        { name: "GlobalState", discriminator: [163, 46, 74, 168, 216, 123, 133, 98] },
        { name: "PlayerState", discriminator: [56, 3, 60, 86, 174, 16, 244, 195] },
        { name: "ReferrerInfo", discriminator: [203, 91, 231, 132, 39, 147, 137, 21] },
        { name: "RiverFishConfig", discriminator: [214, 72, 177, 45, 29, 159, 151, 179] },
        { name: "RiverFishMintRecord", discriminator: [186, 214, 230, 74, 39, 1, 233, 0] },
        { name: "RiverFishState", discriminator: [152, 7, 28, 157, 133, 254, 23, 144] },
    ],
    types: [
        {
            name: "CollectionGrid",
            docs: ["Collection grid progress per player", 'Seeds: ["grid", owner.key()]'],
            type: {
                kind: "struct",
                fields: [
                    { name: "owner", type: "pubkey" },
                    { name: "grid_version", type: "u8" },
                    { name: "slots_completed", type: { array: ["u8", 32] } },
                    { name: "total_slots", type: "u8" },
                    { name: "completed_sets", type: "u8" },
                    { name: "nfts_placed", type: "u16" },
                    { name: "last_placement_ts", type: "i64" },
                    { name: "rewards_claimed", type: "bool" },
                    { name: "bump", type: "u8" },
                    {
                        name: "specimens_submitted",
                        docs: [
                            "Per-slot specimen submission counter. Tracks how many NFTs have been",
                            "burned toward each field guide entry. When specimens_submitted[slot]",
                            "reaches SPECIMENS_REQUIRED[slot], the entry completes and FISH mount",
                            "cost is charged. Added in multi-specimen update (Season 2.1).",
                            "Expanded from 32 to 34 for Silver Arowana (fishId 32) + Old Boot (fishId 33).",
                        ],
                        type: { array: ["u8", 34] },
                    },
                ],
            },
        },
        {
            name: "Config",
            type: {
                kind: "struct",
                fields: [
                    { name: "authority", type: "pubkey" },
                    { name: "issuer_pubkey", type: "pubkey" },
                    { name: "require_capability_for_catch", type: "bool" },
                    {
                        name: "require_capability_for_spend",
                        docs: [
                            "When true, all FOGO/USDC-spending instructions (upgrades, repairs,",
                            "supercast, process_fish fees, paid initialize) must present a valid",
                            "CAP_MODE_SPEND capability.",
                        ],
                        type: "bool",
                    },
                    {
                        name: "require_fee_for_init",
                        docs: [
                            "When true, initialize_player / initialize_player_with_tier additionally",
                            "require a recent fee payment from `owner` (see require_recent_fee_payment).",
                            "Default should be false to preserve free onboarding; enable only as",
                            "an emergency throttle during active paymaster DoS.",
                        ],
                        type: "bool",
                    },
                    { name: "soft_gate_mode", type: "bool" },
                    { name: "basic_cooldown_ms", type: "u32" },
                    { name: "bump", type: "u8" },
                    { name: "_reserved", type: { array: ["u8", 0] } },
                ],
            },
        },
        {
            name: "DifficultyTracker",
            docs: [
                "Separate PDA for 24h difficulty tracking",
                "This allows us to add new difficulty tracking without changing GlobalState size.",
                'Seeds: ["difficulty-tracker"]',
            ],
            type: {
                kind: "struct",
                fields: [
                    {
                        name: "period_start_fish_count",
                        docs: ["Total fish (unprocessed + minted) at the start of the current tracking period"],
                        type: "u64",
                    },
                    {
                        name: "period_start_timestamp",
                        docs: ["Timestamp when the current period started"],
                        type: "i64",
                    },
                    {
                        name: "authority",
                        docs: ["Authority that can update this (should match GlobalState authority)"],
                        type: "pubkey",
                    },
                    { name: "bump", type: "u8" },
                    { name: "_reserved", type: { array: ["u8", 7] } },
                ],
            },
        },
        {
            name: "FishCaught",
            type: {
                kind: "struct",
                fields: [
                    { name: "player", type: "pubkey" },
                    { name: "rarity", type: { defined: { name: "FishRarity" } } },
                    { name: "amount", type: "u64" },
                    { name: "cast_count", type: "u64" },
                    { name: "timestamp", type: "i64" },
                ],
            },
        },
        {
            name: "FishRarity",
            type: {
                kind: "enum",
                variants: [
                    { name: "Common" },
                    { name: "Uncommon" },
                    { name: "Rare" },
                    { name: "Mythical" },
                    { name: "Legendary" },
                    { name: "Lunker" },
                    { name: "Fabled" },
                    { name: "Ancient" },
                    { name: "Dino" },
                    { name: "RiverSpirit" },
                ],
            },
        },
        {
            name: "GlobalState",
            type: {
                kind: "struct",
                fields: [
                    { name: "authority", type: "pubkey" },
                    { name: "fish_mint", type: "pubkey" },
                    { name: "fogo_mint", type: "pubkey" },
                    { name: "fogo_treasury", type: "pubkey" },
                    { name: "fish_burn_vault", type: "pubkey" },
                    { name: "current_difficulty", type: "u64" },
                    { name: "total_network_power", type: "u64" },
                    { name: "last_difficulty_adjustment", type: "i64" },
                    { name: "base_emission_rate", type: "u64" },
                    { name: "emission_decay_rate", type: "u64" },
                    { name: "daily_target_emission", type: "u64" },
                    { name: "total_fogo_collected", type: "u128" },
                    { name: "total_fish_minted", type: "u64" },
                    { name: "total_unprocessed_fish", type: "u64" },
                    { name: "accumulated_processing_fees", type: "u64" },
                    { name: "fees_per_unprocessed_fish", type: "u128" },
                    { name: "bump", type: "u8" },
                    { name: "halving_count", type: "u8" },
                    { name: "yield_gate_active", type: "u8" },
                    { name: "game_paused", type: "u8" },
                    { name: "_reserved", type: { array: ["u8", 4] } },
                ],
            },
        },
        {
            name: "InitializeGlobalStateParams",
            type: {
                kind: "struct",
                fields: [
                    { name: "base_emission_rate", type: "u64" },
                    { name: "emission_decay_rate", type: "u64" },
                    { name: "daily_target_emission", type: "u64" },
                    { name: "initial_difficulty", type: "u64" },
                ],
            },
        },
        {
            name: "PendingRiverFishCatch",
            docs: ["Pending river fish catch entry created during `cast_line` and minted later."],
            type: {
                kind: "struct",
                fields: [
                    { name: "fish_id", type: "u8" },
                    { name: "cast_count", type: "u64" },
                    { name: "timestamp", type: "i64" },
                ],
            },
        },
        {
            name: "PlayerState",
            type: {
                kind: "struct",
                fields: [
                    { name: "owner", type: "pubkey" },
                    { name: "rod_level", type: "u8" },
                    { name: "boat_tier", type: "u8" },
                    { name: "bump", type: "u8" },
                    { name: "cast_count", type: "u64" },
                    { name: "fish_caught_all_time", type: "u64" },
                    { name: "power", type: "u64" },
                    { name: "max_durability", type: "u32" },
                    { name: "current_durability", type: "u32" },
                    { name: "supercast_remaining_casts", type: "u32" },
                    { name: "last_durability_ts", type: "i64" },
                    { name: "unprocessed_fish", type: "u64" },
                    { name: "last_claim_fees_snapshot", type: "u128" },
                    { name: "last_recorded_unprocessed", type: "u64" },
                    { name: "upgrade_in_progress", type: "bool" },
                    { name: "upgrade_target_level", type: "u8" },
                    { name: "upgrade_casts_at_start", type: "u64" },
                    { name: "last_ata_creation_slot", type: "u64" },
                    { name: "last_cast_slot", type: "u64" },
                    { name: "ata_subsidy_claimed", type: "bool" },
                    { name: "is_honeypot", type: "bool" },
                    { name: "first_process_fee_paid", type: "bool" },
                    { name: "legacy_yield_claimed", type: "u8" },
                    { name: "_reserved", type: { array: ["u8", 3] } },
                ],
            },
        },
        {
            name: "ReferrerInfo",
            docs: [
                "REFERRAL SYSTEM: Separate PDA storing referrer relationship",
                "This is a standalone account created when a player registers with a referrer.",
                "Using a separate PDA avoids any migration risk to existing PlayerState accounts.",
                'Seeds: ["referrer", player_wallet]',
            ],
            type: {
                kind: "struct",
                fields: [
                    { name: "player", docs: ["The player wallet this referrer info belongs to"], type: "pubkey" },
                    {
                        name: "referrer",
                        docs: ["The wallet that referred this player (receives 1% of processing fees)"],
                        type: "pubkey",
                    },
                    { name: "bump", docs: ["PDA bump seed"], type: "u8" },
                ],
            },
        },
        {
            name: "RiverBaitDef",
            docs: ["Definition of a single bait type."],
            type: {
                kind: "struct",
                fields: [
                    { name: "unlock_level", type: "u8" },
                    { name: "casts_per_unit", type: "u32" },
                    {
                        name: "fish_cost_at_ref_difficulty",
                        docs: ["FISH cost in lamports (6 decimals) at difficulty_ref (e.g. D=500)."],
                        type: "u64",
                    },
                    {
                        name: "usdc_fee",
                        docs: ["Flat USDC fee in lamports (6 decimals) charged per purchase (config-driven)."],
                        type: "u64",
                    },
                ],
            },
        },
        {
            name: "RiverFishConfig",
            docs: ["Global config PDA for the Season 2 River Fish system.", 'Seeds: ["river-fish-config"]'],
            type: {
                kind: "struct",
                fields: [
                    { name: "authority", type: "pubkey" },
                    { name: "collection_mint", type: "pubkey" },
                    {
                        name: "difficulty_ref",
                        docs: ["Reference difficulty used for `fish_cost_at_ref_difficulty` (doc uses D=500)."],
                        type: "u64",
                    },
                    { name: "baits", type: { array: [{ defined: { name: "RiverBaitDef" } }, 10] } },
                    { name: "fish", type: { array: [{ defined: { name: "RiverFishTypeConfig" } }, 34] } },
                    { name: "fish_count", type: "u8" },
                    { name: "is_active", type: "bool" },
                    { name: "bump", type: "u8" },
                ],
            },
        },
        {
            name: "RiverFishMintRecord",
            docs: [
                "Per-mint record proving the NFT was minted by this program as a Season 2 river fish.",
                'Seeds: ["river-fish-mint", nft_mint]',
            ],
            type: {
                kind: "struct",
                fields: [
                    { name: "mint", type: "pubkey" },
                    { name: "fish_id", type: "u8" },
                    { name: "season", type: "u8" },
                    { name: "bump", type: "u8" },
                ],
            },
        },
        {
            name: "RiverFishState",
            docs: ["Per-player state PDA for the Season 2 River Fish system.", 'Seeds: ["river-fish-state", owner]'],
            type: {
                kind: "struct",
                fields: [
                    { name: "owner", type: "pubkey" },
                    { name: "active_bait", type: "u8" },
                    {
                        name: "remaining_casts",
                        docs: ["Remaining casts per bait type (10 buckets). Index = bait_id-1."],
                        type: { array: ["u32", 10] },
                    },
                    {
                        name: "pending",
                        docs: ["Fixed-size ring buffer of pending fish catches."],
                        type: { array: [{ defined: { name: "PendingRiverFishCatch" } }, 8] },
                    },
                    { name: "pending_head", type: "u8" },
                    { name: "pending_len", type: "u8" },
                    { name: "bump", type: "u8" },
                ],
            },
        },
        {
            name: "RiverFishTypeConfig",
            docs: [
                "Definition of a single river fish NFT type.",
                "Catch rates are per cast, conditional on the required bait being active.",
            ],
            type: {
                kind: "struct",
                fields: [
                    { name: "fish_id", type: "u8" },
                    { name: "required_bait", type: "u8" },
                    { name: "rarity_tier", type: "u8" },
                    {
                        name: "catch_rate_ppb",
                        docs: ["Catch probability per cast in parts-per-billion (ppb), i.e. 1e9 = 100%."],
                        type: "u64",
                    },
                ],
            },
        },
    ]
};
console.log(JSON.stringify(IDL, null, 2));
