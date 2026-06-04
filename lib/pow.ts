/**
 * Proof of Work (PoW) client-server verification module.
 * Helps prevent automated form spam and brute force attacks.
 */

const SERVER_SECRET = process.env.JWT_SECRET || 'fallback_pow_secret';

// Hash function helper using Web Crypto API
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a challenge for the client browser.
 * Returns the challenge string, current timestamp, and the required difficulty (number of leading zeros).
 */
export async function generateChallenge(ipAddress: string): Promise<{
  challenge: string;
  timestamp: number;
  difficulty: number;
}> {
  const timestamp = Date.now();
  // Create a salt unique to the client IP, timestamp, and server secret
  const challenge = await sha256(`${timestamp}:${ipAddress}:${SERVER_SECRET}`);
  
  return {
    challenge,
    timestamp,
    difficulty: 4, // 4 hex zeros = 16 bits of work (typically takes ~1-3s in a browser thread)
  };
}

/**
 * Verify a completed challenge submitted by the client browser.
 */
export async function verifyChallenge(
  challenge: string,
  timestamp: number,
  nonce: string,
  ipAddress: string
): Promise<boolean> {
  const currentTimestamp = Date.now();
  
  // 1. Check validity window (must be within 5 minutes)
  const timeDifference = currentTimestamp - timestamp;
  if (timeDifference < 0 || timeDifference > 5 * 60 * 1000) {
    return false;
  }
  
  // 2. Recalculate original challenge to ensure it wasn't modified or faked
  const expectedChallenge = await sha256(`${timestamp}:${ipAddress}:${SERVER_SECRET}`);
  if (challenge !== expectedChallenge) {
    return false;
  }
  
  // 3. Verify difficulty criteria (hash of challenge + nonce starts with 4 zeros)
  const computedHash = await sha256(`${challenge}:${nonce}`);
  return computedHash.startsWith('0000');
}
