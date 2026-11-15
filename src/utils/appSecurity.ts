const BIOMETRIC_STORAGE_PREFIX = 'keuangan_biometric_';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64Url.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function sha256Fallback(message: string): string {
  const utf8 = new TextEncoder().encode(message);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLen = utf8.length * 8;
  const padLen = ((utf8.length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(padLen);
  padded.set(utf8);
  padded[utf8.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');
}

export function generateSaltHex(): string {
  const bytes = new Uint8Array(16);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return toHex(bytes);
}

export async function hashSecret(secret: string, salt: string): Promise<string> {
  const payload = `${salt}:${secret}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(payload);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return toHex(new Uint8Array(digest));
  }
  return sha256Fallback(payload);
}

export async function verifySecret(secret: string, salt: string, expectedHash: string): Promise<boolean> {
  if (!expectedHash || !salt) return false;
  const computed = await hashSecret(secret, salt);
  if (computed.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function hasRegisteredBiometric(uid: string): boolean {
  if (!uid || typeof window === 'undefined') return false;
  try {
    return Boolean(localStorage.getItem(`${BIOMETRIC_STORAGE_PREFIX}${uid}`));
  } catch {
    return false;
  }
}

export function removeBiometricCredential(uid: string): void {
  if (!uid || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${BIOMETRIC_STORAGE_PREFIX}${uid}`);
  } catch {
    // Ignore storage access errors
  }
}

function mapWebAuthnError(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err);

  if (
    name === 'SecurityError' ||
    msg.toLowerCase().includes('permissions policy') ||
    msg.toLowerCase().includes('publickey-credentials')
  ) {
    return 'Sensor sidik jari dibatasi di jendela pratinjau tersemat (iframe). Buka aplikasi di tab browser penuh atau sebagai PWA, atau gunakan PIN/Password.';
  }
  if (name === 'NotAllowedError') {
    return 'Verifikasi sidik jari dibatalkan, waktu habis, atau diblokir oleh browser. Silakan coba lagi atau gunakan PIN/Password.';
  }
  if (name === 'NotSupportedError') {
    return 'Perangkat atau browser ini belum mendukung autentikasi sidik jari WebAuthn.';
  }
  if (name === 'InvalidStateError') {
    return 'Kredensial sidik jari sudah terdaftar sebelumnya.';
  }
  return 'Gagal memverifikasi sidik jari pada perangkat ini. Silakan gunakan PIN atau Password.';
}

export async function registerBiometricCredential(
  uid: string,
  email: string,
  displayName: string
): Promise<{ ok: boolean; errorMessage?: string }> {
  if (typeof window === 'undefined' || !navigator.credentials || typeof window.PublicKeyCredential === 'undefined') {
    return {
      ok: false,
      errorMessage: 'Browser ini tidak mendukung sensor sidik jari (WebAuthn).',
    };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const userIdBytes = new TextEncoder().encode(uid).slice(0, 64);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Catatan Keuangan',
        },
        user: {
          id: userIdBytes,
          name: email || uid,
          displayName: displayName || 'Pengguna Catatan Keuangan',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;

    if (!credential || !credential.rawId) {
      return {
        ok: false,
        errorMessage: 'Pendaftaran sidik jari tidak menghasilkan kredensial yang valid.',
      };
    }

    localStorage.setItem(`${BIOMETRIC_STORAGE_PREFIX}${uid}`, toBase64Url(credential.rawId));
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      errorMessage: mapWebAuthnError(err),
    };
  }
}

export async function authenticateWithBiometric(
  uid: string
): Promise<{ ok: boolean; errorMessage?: string }> {
  if (typeof window === 'undefined' || !navigator.credentials || typeof window.PublicKeyCredential === 'undefined') {
    return {
      ok: false,
      errorMessage: 'Browser ini tidak mendukung sensor sidik jari.',
    };
  }

  const storedId = localStorage.getItem(`${BIOMETRIC_STORAGE_PREFIX}${uid}`);
  if (!storedId) {
    return {
      ok: false,
      errorMessage: 'Sidik jari belum terdaftar pada perangkat ini. Silakan buka dengan PIN/Password.',
    };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const credentialIdBytes = fromBase64Url(storedId);

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: credentialIdBytes.buffer as ArrayBuffer,
            type: 'public-key',
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion || !assertion.id) {
      return {
        ok: false,
        errorMessage: 'Verifikasi sidik jari tidak valid. Silakan gunakan PIN/Password.',
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      errorMessage: mapWebAuthnError(err),
    };
  }
}
