/**
 * Homemade JWT implementation using the Web Crypto API.
 * This runs natively in any environment (including Edge Middleware / Node.js 18+)
 * and does not rely on heavy dependencies like jsonwebtoken or jose.
 */

// Helper: base64url encoding
function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper: base64url decoding to raw bytes (prevents UTF-8 corruption on binary signatures)
function base64urlDecodeToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Helper: base64url decoding to string (for JSON headers and payloads)
function base64urlDecode(str: string): string {
  const bytes = base64urlDecodeToBytes(str);
  return new TextDecoder().decode(bytes);
}

// Get crypto key for HMAC-SHA256 signature
async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export interface JWTPayload {
  sub: string; // Subject (e.g. 'admin')
  exp: number; // Expiration timestamp in seconds
  iat: number; // Issued at timestamp in seconds
  [key: string]: unknown;
}

/**
 * Sign a payload and return a base64url JWT token.
 */
export async function signJWT(payload: JWTPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  
  const tokenInput = `${encodedHeader}.${encodedPayload}`;
  const cryptoKey = await getCryptoKey(secret);
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(tokenInput)
  );
  
  // Convert signature buffer directly to base64url (safely treating as binary)
  const signatureBytes = new Uint8Array(signatureBuffer);
  let binary = '';
  for (let i = 0; i < signatureBytes.byteLength; i++) {
    binary += String.fromCharCode(signatureBytes[i]);
  }
  const encodedSignature = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
    
  return `${tokenInput}.${encodedSignature}`;
}

/**
 * Verify a base64url JWT token and return its payload.
 * Returns null if the token signature is invalid or if the token is expired.
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const [header, payload, signature] = parts;
  const tokenInput = `${header}.${payload}`;
  
  try {
    const cryptoKey = await getCryptoKey(secret);
    
    // Decode base64url signature directly to raw binary bytes to prevent corruption
    const signatureBytes = base64urlDecodeToBytes(signature);
    
    // Verify the HMAC signature
    const isValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBytes as BufferSource,
      new TextEncoder().encode(tokenInput)
    );
    
    if (!isValid) return null;
    
    // Parse and validate payload expiration
    const parsedPayload = JSON.parse(base64urlDecode(payload)) as JWTPayload;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    if (parsedPayload.exp && parsedPayload.exp < currentTimestamp) {
      return null; // Expired
    }
    
    return parsedPayload;
  } catch (error) {
    console.error('Error verifying JWT:', error);
    return null;
  }
}
