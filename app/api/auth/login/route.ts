import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { signJWT } from '@/lib/jwt';
import { supabase } from '@/lib/supabase';

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request: NextRequest) {
  if (!ADMIN_PASSWORD_HASH || !JWT_SECRET) {
    console.error('Missing authorization setup in environment variables (ADMIN_PASSWORD_HASH or JWT_SECRET).');
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
  }

  try {
    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    // Compute SHA-256 hex hash of password
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    if (passwordHash !== ADMIN_PASSWORD_HASH) {
      // Intentionally return 401 Unauthorized for security audit obfuscation
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // 1. Generate Custom Access Token (JWT) - 15 minutes expiration
    const accessExp = Math.floor(Date.now() / 1000) + 15 * 60;
    const accessToken = await signJWT(
      { sub: 'admin', iat: Math.floor(Date.now() / 1000), exp: accessExp },
      JWT_SECRET
    );

    // 2. Generate Refresh Token - 7 days expiration
    const refreshExp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    const rawRefreshToken = crypto.randomUUID();
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const refreshToken = await signJWT(
      { sub: 'admin', token_id: rawRefreshToken, iat: Math.floor(Date.now() / 1000), exp: refreshExp },
      JWT_SECRET
    );

    // Insert Refresh Token hash in Supabase to track session
    const { error: dbError } = await supabase
      .from('refresh_tokens')
      .insert([
        {
          token_hash: refreshTokenHash,
          expires_at: new Date(refreshExp * 1000).toISOString(),
        },
      ]);

    if (dbError) {
      console.error('Failed to store refresh token hash:', dbError);
      return NextResponse.json({ error: 'Database session error' }, { status: 500 });
    }

    const response = NextResponse.json({ success: true });

    // Set secure Access Token Cookie (15 min)
    response.cookies.set('access_token', accessToken, {
      httpOnly: false, // Accessible by script for authorization headers (or can be httpOnly too)
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60,
      path: '/',
    });

    // Set secure httpOnly Refresh Token Cookie (7 days)
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
