import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'akira-secret-key-change-in-production';

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  username: string;
}

export function generateToken(user: { id: string; email: string; role: string; username: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

function bearer(req: NextRequest): TokenPayload | null {
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

export function getAuth(req: NextRequest): TokenPayload | null {
  return bearer(req);
}

/**
 * Admin guard — sama seperti v2: tanpa kredensial → 404 (bukan 401) supaya
 * admin API tidak terdeteksi scanner.
 */
export function requireAdmin(req: NextRequest): { ok: true; user: TokenPayload | null } | { ok: false; res: NextResponse } {
  const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
  const key = req.headers.get('x-admin-key');
  if (ADMIN_API_KEY && key === ADMIN_API_KEY) return { ok: true, user: null };
  const user = bearer(req);
  if (user && user.role === 'ADMIN') return { ok: true, user };
  return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
}

export function requireUser(req: NextRequest): { ok: true; user: TokenPayload } | { ok: false; res: NextResponse } {
  const user = bearer(req);
  if (user) return { ok: true, user };
  return { ok: false, res: NextResponse.json({ error: 'No token provided' }, { status: 401 }) };
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const comparePassword = (p: string, h: string) => bcrypt.compare(p, h);

export function slugify(s: string) {
  return (s || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80) || 'untitled';
}
