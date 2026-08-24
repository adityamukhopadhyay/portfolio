// Encrypts ../../applications/tracker.json → ../public/personal-data.enc.json
// AES-256-GCM, key derived from applications/TRACKER_KEY.txt via PBKDF2-SHA256.
// Run manually before deploying; only ciphertext is committed to this public repo.
import { webcrypto as crypto } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const base = join(here, "..", "..", "applications");
const pass = readFileSync(join(base, "TRACKER_KEY.txt"), "utf8").trim();
const plain = readFileSync(join(base, "tracker.json"));

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
const b64 = (u) => Buffer.from(u).toString("base64");
writeFileSync(join(here, "..", "public", "personal-data.enc.json"), JSON.stringify({ v: 1, kdf: "PBKDF2-SHA256-200k", salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
console.log("encrypted", plain.length, "bytes → public/personal-data.enc.json");
