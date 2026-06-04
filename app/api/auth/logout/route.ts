import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyJWT } from '@/lib/jwt';
import { supabase } from '@/lib/supabase';

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request: NextRequest) {
  const refreshTokenCookie = request.cookies.get('refresh_token')?.value;
  
  if (refreshTokenCookie && JWT_SECRET) {
    try {
      const payload = await verifyJWT(refreshTokenCookie, JWT_SECRET);
      if (payload && payload.token_id) {
        const rawTokenId = payload.token_id as string;
        const tokenHash = crypto.createHash('sha256').update(rawTokenId).digest('hex');
        
        // Revoke token in DB
        await supabase
          .from('refresh_tokens')
          .update({ revoked: true })
          .eq('token_hash', tokenHash);
      }
    } catch (err) {
      console.error('Logout revocation error:', err);
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  return response;
}
