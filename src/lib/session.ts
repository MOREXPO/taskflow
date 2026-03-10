import { createHmac } from 'crypto';

export type SessionUser = {
  userId: string;
  email: string;
  role: 'ADMIN' | 'USER';
};

const secret = process.env.SESSION_SECRET || 'change-me';

function b64(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function unb64(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function signSession(user: SessionUser) {
  const payload = b64(JSON.stringify(user));
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token?: string | null): SessionUser | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (expected !== sig) return null;
  try {
    return JSON.parse(unb64(payload));
  } catch {
    return null;
  }
}
