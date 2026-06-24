// Actuarial engine: computes Expected Present Value of claims
// All values are fixed-point scaled by SCALE = 1_000_000

export const SCALE = 1_000_000n;
export const N = 20; // max cohorts (must match circuit)

export interface PolicyCohort {
  name: string;
  benefit: number;        // benefit amount (USD)
  probability: number;    // annual claim probability (0..1)
  discountRate: number;   // annual discount rate (0..1)
  years: number;          // years to expected claim
}

export interface ActuarialInputs {
  benefits: bigint[];
  probabilities: bigint[];
  discounts: bigint[];
  cohortCount: bigint;
  epv: bigint;            // expected present value (scaled)
  liabilityCommitment: bigint;
}

export function computeActuarialInputs(cohorts: PolicyCohort[]): ActuarialInputs {
  if (cohorts.length > N) throw new Error(`Max ${N} cohorts`);

  const benefits: bigint[] = [];
  const probabilities: bigint[] = [];
  const discounts: bigint[] = [];

  let epv = 0n;

  for (const c of cohorts) {
    const b = BigInt(Math.round(c.benefit * Number(SCALE)));
    const p = BigInt(Math.round(c.probability * Number(SCALE)));
    // PV discount factor = 1 / (1 + r)^t  scaled
    const pvFactor = 1 / Math.pow(1 + c.discountRate, c.years);
    const d = BigInt(Math.round(pvFactor * Number(SCALE)));

    benefits.push(b);
    probabilities.push(p);
    discounts.push(d);

    // EPV contribution = benefit * prob * discount / SCALE^2
    epv += (b * p * d) / (SCALE * SCALE);
  }

  // Pad to N with zeros
  while (benefits.length < N) {
    benefits.push(0n);
    probabilities.push(0n);
    discounts.push(0n);
  }

  // Compute liability commitment = sum(benefit_i * (i+1))
  let liabilityCommitment = 0n;
  for (let i = 0; i < N; i++) {
    liabilityCommitment += benefits[i] * BigInt(i + 1);
  }

  return {
    benefits,
    probabilities,
    discounts,
    cohortCount: BigInt(cohorts.length),
    epv,
    liabilityCommitment,
  };
}

// Sample liability table for demo
export const DEMO_COHORTS: PolicyCohort[] = [
  { name: "Term Life 30-39",   benefit: 500_000, probability: 0.0015, discountRate: 0.05, years: 15 },
  { name: "Term Life 40-49",   benefit: 500_000, probability: 0.0035, discountRate: 0.05, years: 10 },
  { name: "Term Life 50-59",   benefit: 500_000, probability: 0.0080, discountRate: 0.05, years: 5  },
  { name: "Whole Life 30-39",  benefit: 250_000, probability: 0.0020, discountRate: 0.05, years: 30 },
  { name: "Whole Life 40-49",  benefit: 250_000, probability: 0.0045, discountRate: 0.05, years: 20 },
  { name: "Critical Illness",  benefit: 100_000, probability: 0.0120, discountRate: 0.05, years: 8  },
  { name: "Disability Income", benefit:  60_000, probability: 0.0200, discountRate: 0.05, years: 5  },
  { name: "Annuity Pool A",    benefit:  24_000, probability: 0.9500, discountRate: 0.04, years: 1  },
  { name: "Annuity Pool B",    benefit:  24_000, probability: 0.8000, discountRate: 0.04, years: 5  },
  { name: "Group Health",      benefit:  15_000, probability: 0.1500, discountRate: 0.04, years: 1  },
];
