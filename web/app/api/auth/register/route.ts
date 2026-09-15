import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register — buat user baru (langsung aktif, tanpa verifikasi email)
export async function POST(req: NextRequest) {
  try {
    const { email, username, password } = (await req.json().catch(() => ({}))) as {
      email?: string;
      username?: string;
      password?: string;
    };

    if (!email || !username || !password)
      return NextResponse.json({ error: 'Email, username, dan password wajib diisi' }, { status: 400 });
    if (!EMAIL_RE.test(email))
      return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 });
    if (username.trim().length < 3)
      return NextResponse.json({ error: 'Username minimal 3 karakter' }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 });

    if (await prisma.user.findUnique({ where: { email } }))
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
    if (await prisma.user.findUnique({ where: { username: username.trim() } }))
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        username: username.trim(),
        password: await hashPassword(password),
        role: 'USER',
      },
      select: { id: true, email: true, username: true, role: true },
    });

    return NextResponse.json(
      { message: 'Registrasi berhasil!', token: generateToken(user), user },
      { status: 201 }
    );
  } catch (e) {
    console.error('Register error:', e);
    return NextResponse.json({ error: 'Gagal registrasi' }, { status: 500 });
  }
}
