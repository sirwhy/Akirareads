import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, comparePassword, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/auth/admin/login — wajib role ADMIN.
// Bootstrap: kalau email == ADMIN_EMAIL dan ADMIN_PASSWORD diset tapi user-nya
// belum ada → buat ADMIN on the fly (deploy pertama tanpa seed).
export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    if (!email || !password)
      return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 });

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@akirareads.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

    let user = await prisma.user.findUnique({ where: { email } });

    if (
      !user &&
      ADMIN_PASSWORD &&
      email.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
      password === ADMIN_PASSWORD
    ) {
      user = await prisma.user.create({
        data: {
          email: ADMIN_EMAIL.toLowerCase(),
          username: 'admin',
          password: await hashPassword(ADMIN_PASSWORD),
          role: 'ADMIN',
        },
      });
    }

    if (!user || !(await comparePassword(password, user.password)))
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    if (user.role !== 'ADMIN')
      return NextResponse.json(
        { error: 'Email/password salah atau bukan akun admin' },
        { status: 403 }
      );

    return NextResponse.json({
      message: 'Login admin berhasil',
      token: generateToken(user),
      user: { id: user.id, email: user.email, username: user.username, role: user.role, avatar: user.avatar },
    });
  } catch (e) {
    console.error('Admin login error:', e);
    return NextResponse.json({ error: 'Gagal login' }, { status: 500 });
  }
}
