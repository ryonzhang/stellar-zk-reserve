import {
  Keypair, Networks, rpc, TransactionBuilder, BASE_FEE, Operation, Address,
} from '@stellar/stellar-sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RPC_URL = 'https://soroban-testnet.stellar.org';
const FRIENDBOT = 'https://friendbot.stellar.org';
const NETWORK = Networks.TESTNET;
const WASM_PATH = join(__dirname, '../contracts/target/wasm32-unknown-unknown/release/zk_reserve.wasm');

const server = new rpc.Server(RPC_URL);
const keypair = Keypair.random();

console.log('\n' + '='.repeat(52));
console.log('  ZK Reserve — Stellar Testnet Deploy');
console.log('='.repeat(52));
console.log(`  Public:  ${keypair.publicKey()}`);
console.log(`  Secret:  ${keypair.secret()}`);

// Fund
console.log('\nFunding via Friendbot...');
const fb = await fetch(`${FRIENDBOT}?addr=${keypair.publicKey()}`);
const fbText = await fb.text();
if (!fb.ok && !fbText.includes('createAccountAlreadyExist')) {
  throw new Error(`Friendbot failed: ${fbText.slice(0, 200)}`);
}
console.log('  Funded ✓');

const wasmBytes = readFileSync(WASM_PATH);
console.log(`\nWASM loaded (${wasmBytes.length} bytes)`);

// Upload WASM
let account = await server.getAccount(keypair.publicKey());
const uploadTx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
  .addOperation(Operation.uploadContractWasm({ wasm: wasmBytes }))
  .setTimeout(30).build();
const prepUpload = await server.prepareTransaction(uploadTx);
prepUpload.sign(keypair);
const upRes = await server.sendTransaction(prepUpload);
console.log(`\nUpload tx: ${upRes.hash}`);

// Poll upload
let upStatus;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 2000));
  upStatus = await server.getTransaction(upRes.hash);
  if (upStatus.status !== 'NOT_FOUND') break;
}
if (upStatus.status !== 'SUCCESS') throw new Error(`Upload failed: ${upStatus.status}`);
const wasmHash = upStatus.returnValue.bytes();
console.log(`WASM hash: ${Buffer.from(wasmHash).toString('hex')}`);

// Create contract
account = await server.getAccount(keypair.publicKey());
const createTx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
  .addOperation(Operation.createCustomContract({
    wasmHash,
    address: new Address(keypair.publicKey()),
    salt: Buffer.alloc(32),
  }))
  .setTimeout(30).build();
const prepCreate = await server.prepareTransaction(createTx);
prepCreate.sign(keypair);
const crRes = await server.sendTransaction(prepCreate);
console.log(`Create tx: ${crRes.hash}`);

// Poll create
let crStatus;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 2000));
  crStatus = await server.getTransaction(crRes.hash);
  if (crStatus.status !== 'NOT_FOUND') break;
}
if (crStatus.status !== 'SUCCESS') throw new Error(`Create failed: ${JSON.stringify(crStatus)}`);

// Extract contract ID from return value
const contractId = crStatus.returnValue.address().contractId();
const contractIdHex = Buffer.from(contractId).toString('hex');

console.log('\n✅ Contract deployed!');
console.log(`   Contract ID: C${contractIdHex.toUpperCase()}`);
console.log(`   Explorer:    https://stellar.expert/explorer/testnet/contract/${contractIdHex}`);
console.log('\nSave these:');
console.log(`   ZK_RESERVE_CONTRACT=${contractIdHex}`);
console.log(`   STELLAR_SECRET_KEY=${keypair.secret()}`);
