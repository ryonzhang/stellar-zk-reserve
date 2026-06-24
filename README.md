# ZK Reserve — Actuarial Reserve Attestation on Stellar

> Prove an insurance vault meets actuarial reserve requirements **without revealing the liability table.**

## The Problem

Insurance regulators require proof that an insurer's vault holds enough reserves to cover expected claims. Today, this means handing over the full liability table — exposing proprietary pricing data and policyholder information.

## The Solution

ZK Reserve generates a **zero-knowledge proof** that:

```
vault_reserves ≥ Σ( benefit_i × probability_i × PV_discount_i )
```

…without revealing any individual cohort's benefit amounts, claim probabilities, or policy counts. A **Soroban smart contract on Stellar** verifies the proof on-chain and stores the attestation permanently.

## How It Works

```
 Private Inputs (hidden)          Public Inputs (on-chain)
 ┌─────────────────────┐          ┌──────────────────────────┐
 │ benefit_i  (×20)    │          │ total_reserves           │
 │ probability_i (×20) │ ──Noir──▶│ liability_commitment     │
 │ discount_i  (×20)   │  circuit │                          │
 │ cohort_count        │          └────────────┬─────────────┘
 └─────────────────────┘                       │
                                         UltraHonk proof
                                               │
                                    ┌──────────▼──────────┐
                                    │  Soroban contract   │
                                    │  verify_reserve()   │
                                    │  ✅ ATTESTED        │
                                    └─────────────────────┘
```

1. **Actuarial engine** (TypeScript) computes EPV of claims across 10 policy cohorts
2. **Noir circuit** proves `reserves ≥ EPV` using fixed-point arithmetic (6 decimal places)
3. **bb.js** generates a compact UltraHonk proof (~2KB)
4. **Soroban contract** verifies the proof using Stellar Protocol 26 BN254 host functions and stores the attestation

## Actuarial Model

The circuit encodes the **Expected Present Value** formula:

```
EPV = Σᵢ [ benefit_i × P(claim_i) × (1/(1+r)^t_i) ]
```

where all values are fixed-point integers (scaled × 10⁶) to maintain ZK circuit compatibility. This is the same actuarial math used by real insurers to compute statutory reserves.

## Tech Stack

| Layer | Technology |
|---|---|
| ZK Circuit | [Noir](https://noir-lang.org/) — reserve adequacy constraint |
| Proof Backend | [bb.js](https://github.com/AztecProtocol/aztec-packages) — UltraHonk prover |
| Smart Contract | [Soroban](https://soroban.stellar.org/) (Rust) — on-chain verifier |
| Orchestrator | TypeScript + `@stellar/stellar-sdk` |
| Network | Stellar Testnet |

## Quick Start

```bash
# 1. Install dependencies
cd orchestrator && npm install

# 2. Compile the Noir circuit (requires nargo)
cd circuits && nargo compile

# 3. Run dry-run proof generation
cd orchestrator && npm run prove

# 4. Submit to Stellar testnet
export ZK_RESERVE_CONTRACT=<contract_id>
export STELLAR_SECRET_KEY=<your_secret>
export VAULT_RESERVES_USD=10000000
npm run prove
```

## Project Structure

```
circuits/       Noir ZK circuit (reserve adequacy constraint)
contracts/      Soroban verifier contract (Rust)
orchestrator/   TypeScript orchestrator
  src/
    actuarial.ts   Actuarial EPV engine
    prove.ts       Noir proof generation
    stellar.ts     Stellar testnet submission
    index.ts       CLI entrypoint
```

## Why This Matters

Stellar is the leading blockchain for real-world financial settlement — stablecoins, cross-border payments, tokenized assets. Insurance reserve attestation is a multi-trillion dollar compliance problem. ZK Reserve brings privacy-preserving solvency proofs to the Stellar ecosystem, enabling:

- **Stablecoin issuers** to prove backing without revealing reserve composition
- **Insurance protocols** to attest solvency to regulators privately
- **DeFi vaults** to prove collateralization ratios without revealing strategy

## Hackathon

[Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk/detail)
