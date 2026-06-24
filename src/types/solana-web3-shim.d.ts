declare module "@solana/web3.js" {
  export class Transaction {
    serialize(config?: { requireAllSignatures?: boolean; verifySignatures?: boolean }): Uint8Array;
    static from(buffer: Buffer | Uint8Array): Transaction;
  }
  export class VersionedTransaction {
    serialize(): Uint8Array;
    static deserialize(buffer: Uint8Array): VersionedTransaction;
  }
}
