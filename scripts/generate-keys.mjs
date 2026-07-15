import { createECDH } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values) {
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    generators.forEach((generator, index) => { if ((top >>> index) & 1) checksum ^= generator; });
  }
  return checksum >>> 0;
}

function prefixWords(prefix) {
  return [...prefix].map((character) => character.charCodeAt(0) >>> 5).concat([0], [...prefix].map((character) => character.charCodeAt(0) & 31));
}

function convertBits(bytes) {
  let accumulator = 0;
  let bits = 0;
  const words = [];
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; words.push((accumulator >>> bits) & 31); }
  }
  if (bits) words.push((accumulator << (5 - bits)) & 31);
  return words;
}

function bech32(prefix, bytes) {
  const words = convertBits(bytes);
  const checksumBase = [...prefixWords(prefix), ...words, 0, 0, 0, 0, 0, 0];
  const value = polymod(checksumBase) ^ 1;
  const checksum = Array.from({ length: 6 }, (_, index) => (value >>> (5 * (5 - index))) & 31);
  return `${prefix}1${[...words, ...checksum].map((word) => charset[word]).join("")}`;
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(root, "keys", "dev-user.json");
const ecdh = createECDH("secp256k1");
ecdh.generateKeys();
const secret = ecdh.getPrivateKey();
const publicKey = ecdh.getPublicKey(undefined, "compressed").subarray(1);
const identity = {
  warning: "Unencrypted development identity. Do not fund or reuse it outside this local app.",
  createdAt: new Date().toISOString(),
  secretKeyHex: secret.toString("hex"),
  publicKeyHex: publicKey.toString("hex"),
  nsec: bech32("nsec", secret),
  npub: bech32("npub", publicKey)
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(identity, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(`Generated local Nostr identity at ${outputPath}`);
