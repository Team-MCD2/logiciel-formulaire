import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyJWT, signJWT } from '@/lib/jwt';
import { supabase } from '@/lib/supabase';

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request: NextRequest) {
  if (!JWT_SECRET) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
  }

  const refreshTokenCookie = request.cookies.get('refresh_token')?.value;
  if (!refreshTokenCookie) {
    return NextResponse.json({ error: 'Refresh token required' }, { status: 400 });
  }

  // 1. Verify custom JWT signature
  const payload = await verifyJWT(refreshTokenCookie, JWT_SECRET);
  if (!payload || !payload.token_id) {
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
  }

  // 2. Validate token hash from DB
  const rawTokenId = payload.token_id as string;
  const tokenHash = crypto.createHash('sha256').update(rawTokenId).digest('hex');

  const { data: dbToken, error } = await supabase
    .from('refresh_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .single();

  if (error || !dbToken || dbToken.revoked) {
    // SECURITY RISK: Token Replay / Abuse detected.
    // If token is re-submitted after revocation, invalidate ALL refresh tokens immediately (Safety first)
    console.warn(`[SECURITY WARN] Replay or abuse detected for refresh token hash ${tokenHash}. Revoking all sessions.`);
    
    // Revoke current session
    if (dbToken) {
      await supabase
        .from('refresh_tokens')
        .update({ revoked: true })
        .eq('id', dbToken.id);
    }
    
    const response = NextResponse.json({ error: 'Session revoked due to security replay check' }, { status: 401 });
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    return response;
  }

  // 3. Mark the current refresh token as revoked (one-time use / rotation)
  await supabase
    .from('refresh_tokens')
    .update({ revoked: true })
    .eq('id', dbToken.id);

  // 4. Generate new Access and Refresh tokens
  const accessExp = Math.floor(Date.now() / 1000) + 15 * 60; // 15 mins
  const newAccessToken = await signJWT(
    { sub: 'admin', iat: Math.floor(Date.now() / 1000), exp: accessExp },
    JWT_SECRET
  );

  const refreshExp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
  const newRawRefreshToken = crypto.randomUUID();
  const newRefreshTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');

  const newRefreshToken = await signJWT(
    { sub: 'admin', token_id: newRawRefreshToken, iat: Math.floor(Date.now() / 1000), exp: refreshExp },
    JWT_SECRET
  );

  // Store new token in DB
  const { error: insertError } = await supabase
    .from('refresh_tokens')
    .insert([
      {
        token_hash: newRefreshTokenHash,
        expires_at: new Date(refreshExp * 1000).toISOString(),
      },
    ]);

  if (insertError) {
    return NextResponse.json({ error: 'Database session error' }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });

  // Update cookies
  response.cookies.set('access_token', newAccessToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60,
    path: '/',
  });

  response.cookies.set('refresh_token', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
