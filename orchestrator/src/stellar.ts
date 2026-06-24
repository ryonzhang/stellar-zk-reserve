// Submit proof to Stellar testnet via the ZkReserve Soroban contract
import {
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  Contract,
  BASE_FEE,
  xdr,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

export async function submitProofToStellar(
  contractId: string,
  secretKey: string,
  proofBytes: Uint8Array,
  totalReserves: string,
  liabilityCommitment: string,
) {
  const server = new SorobanRpc.Server(RPC_URL);
  const keypair = Keypair.fromSecret(secretKey);
  const account = await server.getAccount(keypair.publicKey());
  const contract = new Contract(contractId);

  console.log(`\nSubmitting proof to Stellar testnet...`);
  console.log(`  Contract:  ${contractId}`);
  console.log(`  Submitter: ${keypair.publicKey()}`);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'verify_reserve',
        xdr.ScVal.scvBytes(Buffer.from(proofBytes)),
        nativeToScVal(BigInt(totalReserves), { type: 'u128' }),
        nativeToScVal(BigInt(liabilityCommitment), { type: 'u128' }),
      ),
    )
    .setTimeout(30)
    .build();

  const preparedTx = await server.prepareTransaction(tx);
  preparedTx.sign(keypair);

  const result = await server.sendTransaction(preparedTx);
  console.log(`  Tx hash:   ${result.hash}`);

  // Poll for confirmation
  let status = await server.getTransaction(result.hash);
  let attempts = 0;
  while (status.status === 'NOT_FOUND' && attempts < 20) {
    await new Promise(r => setTimeout(r, 1500));
    status = await server.getTransaction(result.hash);
    attempts++;
  }

  if (status.status === 'SUCCESS') {
    console.log(`✅ Proof verified on-chain!`);
    console.log(`   https://stellar.expert/explorer/testnet/tx/${result.hash}`);
    return result.hash;
  } else {
    throw new Error(`Transaction failed: ${JSON.stringify(status)}`);
  }
}
