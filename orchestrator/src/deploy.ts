// Deploy zk_reserve.wasm to Stellar testnet using JS SDK
import {
  Keypair,
  Networks,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  Operation,
} from '@stellar/stellar-sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const FRIENDBOT = 'https://friendbot.stellar.org';
const NETWORK = Networks.TESTNET;
const WASM_PATH = join(import.meta.dirname, '../../contracts/target/wasm32-unknown-unknown/release/zk_reserve.wasm');

async function fundAccount(publicKey: string) {
  const res = await fetch(`${FRIENDBOT}?addr=${publicKey}`);
  if (!res.ok) {
    const text = await res.text();
    if (!text.includes('already funded') && !text.includes('createAccountAlreadyExist')) {
      throw new Error(`Friendbot failed: ${text}`);
    }
  }
  console.log(`  Funded: ${publicKey}`);
}

async function deploy() {
  const server = new SorobanRpc.Server(RPC_URL);

  // Generate or load keypair
  const keypair = process.env.STELLAR_SECRET_KEY
    ? Keypair.fromSecret(process.env.STELLAR_SECRET_KEY)
    : Keypair.random();

  console.log('\n='.repeat(50));
  console.log('  ZK Reserve — Stellar Testnet Deploy');
  console.log('='.repeat(50));
  console.log(`  Public key:  ${keypair.publicKey()}`);
  console.log(`  Secret key:  ${keypair.secret()}`);

  // Fund via Friendbot
  console.log('\nFunding account via Friendbot...');
  await fundAccount(keypair.publicKey());

  // Load WASM
  const wasmBytes = readFileSync(WASM_PATH);
  console.log(`\nLoading WASM (${wasmBytes.length} bytes)...`);

  const account = await server.getAccount(keypair.publicKey());

  // Upload WASM
  console.log('Uploading WASM to testnet...');
  const uploadTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(Operation.uploadContractWasm({ wasm: wasmBytes }))
    .setTimeout(30)
    .build();

  const preparedUpload = await server.prepareTransaction(uploadTx);
  preparedUpload.sign(keypair);

  const uploadResult = await server.sendTransaction(preparedUpload);
  console.log(`  Upload tx: ${uploadResult.hash}`);

  // Wait for upload confirmation
  let uploadStatus = await server.getTransaction(uploadResult.hash);
  let attempts = 0;
  while (uploadStatus.status === 'NOT_FOUND' && attempts < 20) {
    await new Promise(r => setTimeout(r, 2000));
    uploadStatus = await server.getTransaction(uploadResult.hash);
    attempts++;
  }
  if (uploadStatus.status !== 'SUCCESS') throw new Error(`Upload failed: ${uploadStatus.status}`);

  // Extract wasm hash
  const wasmHash = (uploadStatus as any).returnValue?.bytes();
  console.log(`  WASM hash: ${Buffer.from(wasmHash).toString('hex')}`);

  // Create contract instance
  const account2 = await server.getAccount(keypair.publicKey());
  console.log('\nInstantiating contract...');
  const createTx = new TransactionBuilder(account2, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(Operation.createCustomContract({
      wasmHash,
      address: keypair.xdrAccountId(),
      salt: Buffer.alloc(32),
    }))
    .setTimeout(30)
    .build();

  const preparedCreate = await server.prepareTransaction(createTx);
  preparedCreate.sign(keypair);

  const createResult = await server.sendTransaction(preparedCreate);
  console.log(`  Create tx: ${createResult.hash}`);

  let createStatus = await server.getTransaction(createResult.hash);
  attempts = 0;
  while (createStatus.status === 'NOT_FOUND' && attempts < 20) {
    await new Promise(r => setTimeout(r, 2000));
    createStatus = await server.getTransaction(createResult.hash);
    attempts++;
  }
  if (createStatus.status !== 'SUCCESS') throw new Error(`Create failed: ${createStatus.status}`);

  const contractId = (createStatus as any).returnValue?.address()?.contractId();
  const contractIdStr = Buffer.from(contractId).toString('hex');

  console.log('\n✅ Contract deployed!');
  console.log(`   Contract ID: ${contractIdStr}`);
  console.log(`   Explorer:    https://stellar.expert/explorer/testnet/contract/${contractIdStr}`);
  console.log('\nAdd to your environment:');
  console.log(`   ZK_RESERVE_CONTRACT=${contractIdStr}`);
  console.log(`   STELLAR_SECRET_KEY=${keypair.secret()}`);
}

deploy().catch(e => { console.error(e); process.exit(1); });
