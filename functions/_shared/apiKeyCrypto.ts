/** AES-256-GCM 加解密（Deno Web Crypto） */

const ENC_VERSION = 'v1';

function getEncryptionSecret(): string {
  const s =
    Deno.env.get('SYSTEM_API_KEY_ENCRYPTION_SECRET') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    '';
  if (s.length < 16) {
    throw new Error('未配置 SYSTEM_API_KEY_ENCRYPTION_SECRET');
  }
  return s;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', enc.encode(secret.slice(0, 32).padEnd(32, '0')), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('ciond-api-keys'), iterations: 100_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await deriveKey(getEncryptionSecret());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  return `${ENC_VERSION}:${toB64(iv.buffer)}:${toB64(cipher)}`;
}

export async function decryptSecret(payload: string): Promise<string> {
  if (!payload || payload === 'PLACEHOLDER_ENCRYPTED') return '';
  const parts = payload.split(':');
  if (parts[0] !== ENC_VERSION || parts.length !== 3) {
    throw new Error('密文格式无效');
  }
  const key = await deriveKey(getEncryptionSecret());
  const iv = fromB64(parts[1]);
  const data = fromB64(parts[2]);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plain);
}

export function maskSecret(plain: string): string {
  if (!plain) return '****';
  if (plain.length <= 4) return '****';
  return `${plain.slice(0, 2)}${'*'.repeat(Math.min(plain.length - 4, 12))}${plain.slice(-2)}`;
}

export function secretHint(plain: string): string {
  return maskSecret(plain);
}
