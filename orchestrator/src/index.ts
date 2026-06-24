#!/usr/bin/env node
// ZK Reserve CLI — generate proof and submit to Stellar testnet
import { generateProof } from './prove.js';
import { submitProofToStellar } from './stellar.js';

const CONTRACT_ID = process.env.ZK_RESERVE_CONTRACT ?? '';
const SECRET_KEY  = process.env.STELLAR_SECRET_KEY ?? '';
const RESERVES    = Number(process.env.VAULT_RESERVES_USD ?? '10000000'); // $10M default

async function main() {
  console.log('='.repeat(60));
  console.log('  ZK Reserve — Actuarial Reserve Attestation on Stellar');
  console.log('='.repeat(60));

  const result = await generateProof(RESERVES);

  if (CONTRACT_ID && SECRET_KEY) {
    const txHash = await submitProofToStellar(
      CONTRACT_ID,
      SECRET_KEY,
      result.proof.proof,
      result.publicInputs.total_reserves,
      result.publicInputs.liability_commitment,
    );
    console.log('\n✅ Complete!');
    console.log(`   EPV of claims:  $${result.epvUsd.toLocaleString()}`);
    console.log(`   Vault reserves: $${result.reservesUsd.toLocaleString()}`);
    console.log(`   On-chain tx:    https://stellar.expert/explorer/testnet/tx/${txHash}`);
  } else {
    console.log('\n[dry-run] Set ZK_RESERVE_CONTRACT + STELLAR_SECRET_KEY to submit on-chain.');
    console.log(`   EPV of claims:  $${result.epvUsd.toLocaleString()}`);
    console.log(`   Vault reserves: $${result.reservesUsd.toLocaleString()}`);
    console.log(`   Proof size:     ${result.proof.proof.length} bytes`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
