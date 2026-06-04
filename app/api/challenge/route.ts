import { NextRequest, NextResponse } from 'next/server';
import { generateChallenge } from '@/lib/pow';
import { isBlacklisted } from '@/lib/blacklist';

export async function GET(request: NextRequest) {
  // Determine client IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
  
  // 1. Check if the IP address is blacklisted
  const blocked = await isBlacklisted(ipAddress);
  if (blocked) {
    // Return standard 404 to obfuscate service
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    const challengeData = await generateChallenge(ipAddress);
    return NextResponse.json(challengeData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('Error generating PoW challenge:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
