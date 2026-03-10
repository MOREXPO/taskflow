import { cookies } from 'next/headers';
import { authCookieName } from './auth';
import { verifySession } from './session';

export async function getSessionUser() {
  const token = (await cookies()).get(authCookieName)?.value;
  return verifySession(token);
}

export async function requireSession() {
  const session = await getSessionUser();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return session;
}
