import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, comparePassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    if (!email || !password)
      return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await comparePassword(password, user.password)))
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });

    return NextResponse.json({
      message: 'Login berhasil',
      token: generateToken(user),
      user: { id: user.id, email: user.email, username: user.username, role: user.role, avatar: user.avatar },
    });
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Gagal login' }, { status: 500 });
  }
}
