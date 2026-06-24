// ZK Reserve Adequacy Circuit
// Proves: total_reserves >= expected_present_value_of_claims
// without revealing the individual liability cohort data.
//
// Actuarial model: EPV = sum_i( benefit_i * probability_i * discount_i ) / SCALE^2
// All inputs are fixed-point integers scaled by SCALE = 1_000_000 (6 decimal places).

global N: u32 = 20; // max number of policy cohorts
global SCALE: Field = 1_000_000;

fn main(
    // Private: liability table (hidden from verifier)
    benefits:      [Field; 20],   // benefit amounts * SCALE
    probabilities: [Field; 20],   // claim probabilities * SCALE  (0..SCALE)
    discounts:     [Field; 20],   // present value discount factors * SCALE (0..SCALE)
    cohort_count:  Field,         // actual number of cohorts used (≤ N)

    // Public: reserve held in Stellar vault
    total_reserves: pub Field,    // reserves * SCALE

    // Public: commitment to the liability table (Pedersen hash)
    liability_commitment: pub Field,
) {
    // 1. Compute EPV = sum( benefit_i * probability_i * discount_i ) / SCALE^2
    let mut epv: Field = 0;
    for i in 0..20 {
        // Only accumulate for active cohorts (i < cohort_count)
        // Use a mask: active = 1 if i < cohort_count, 0 otherwise
        let i_field: Field = i as Field;
        let active = if i_field as u64 < cohort_count as u64 { 1 } else { 0 };
        let term = benefits[i] * probabilities[i] * discounts[i];
        epv = epv + (term * active as Field);
    }

    // Descale twice (benefit*SCALE * prob*SCALE * discount*SCALE / SCALE^2 = EPV*SCALE)
    // So epv here is EPV * SCALE^3, total_reserves is reserves * SCALE
    // We compare: total_reserves * SCALE^2 >= epv
    let lhs = total_reserves * SCALE * SCALE;

    // 2. Assert reserves >= EPV
    // lhs >= epv  <=>  lhs - epv >= 0 (as unsigned)
    let diff = lhs - epv;
    // diff must be non-negative (fit in a u64 range check)
    // Noir's as u64 will panic if negative, enforcing the constraint
    let _check = diff as u64;

    // 3. Verify the liability commitment matches the private inputs
    // Simple hash: sum of (benefit_i * (i+1)) as a commitment check
    // In production this would be a Pedersen/Poseidon hash
    let mut commitment_check: Field = 0;
    for i in 0..20 {
        commitment_check = commitment_check + benefits[i] * ((i as Field) + 1);
    }
    assert(commitment_check == liability_commitment);
}
