import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyJWT } from '@/lib/jwt';

export default async function RootPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const JWT_SECRET = process.env.JWT_SECRET;

  if (accessToken && JWT_SECRET) {
    const payload = await verifyJWT(accessToken, JWT_SECRET);
    if (payload && payload.sub === 'admin') {
      redirect('/admin');
    }
  }

  // Redirect to the login page first if there is no active session
  redirect('/login');
}
