// Proof generation using @noir-lang/noir_js + @aztec/bb.js
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { computeActuarialInputs, DEMO_COHORTS, SCALE } from './actuarial.js';

const CIRCUIT_PATH = join(import.meta.dirname, '../../circuits/target/reserve_proof.json');

export async function generateProof(reservesUsd: number) {
  console.log('Loading compiled circuit...');
  const circuit = JSON.parse(readFileSync(CIRCUIT_PATH, 'utf8'));

  const backend = new UltraHonkBackend(circuit.bytecode);
  const noir = new Noir(circuit);

  const inputs = computeActuarialInputs(DEMO_COHORTS);
  const totalReservesScaled = BigInt(Math.round(reservesUsd * Number(SCALE)));

  console.log(`\nActuarial summary:`);
  console.log(`  Cohorts:          ${DEMO_COHORTS.length}`);
  console.log(`  EPV of claims:    $${Number(inputs.epv / SCALE).toLocaleString()}`);
  console.log(`  Vault reserves:   $${reservesUsd.toLocaleString()}`);
  console.log(`  Solvent:          ${totalReservesScaled >= inputs.epv ? '✅ YES' : '❌ NO'}`);

  if (totalReservesScaled < inputs.epv) {
    throw new Error('Reserves are insufficient — cannot generate valid proof');
  }

  console.log('\nGenerating ZK proof...');

  const { witness } = await noir.execute({
    benefits:             inputs.benefits.map(String),
    probabilities:        inputs.probabilities.map(String),
    discounts:            inputs.discounts.map(String),
    cohort_count:         inputs.cohortCount.toString(),
    total_reserves:       totalReservesScaled.toString(),
    liability_commitment: inputs.liabilityCommitment.toString(),
  });

  const proof = await backend.generateProof(witness);
  console.log(`✅ Proof generated (${proof.proof.length} bytes)`);

  return {
    proof,
    publicInputs: {
      total_reserves:       totalReservesScaled.toString(),
      liability_commitment: inputs.liabilityCommitment.toString(),
    },
    epvUsd: Number(inputs.epv / SCALE),
    reservesUsd,
  };
}
