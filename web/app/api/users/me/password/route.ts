import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, comparePassword, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// PUT /api/users/me/password — { oldPassword, newPassword }
export async function PUT(req: NextRequest) {
  const guard = requireUser(req);
  if ('res' in guard) return guard.res;
  try {
    const { oldPassword, newPassword } = (await req.json().catch(() => ({}))) as {
      oldPassword?: string;
      newPassword?: string;
    };
    if (!oldPassword || !newPassword)
      return NextResponse.json({ error: 'Password lama dan baru wajib diisi' }, { status: 400 });
    if (newPassword.length < 6)
      return NextResponse.json({ error: 'Password baru minimal 6 karakter' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: guard.user.id } });
    if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    if (!(await comparePassword(oldPassword, user.password)))
      return NextResponse.json({ error: 'Password lama salah' }, { status: 400 });

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(newPassword) },
    });
    return NextResponse.json({ message: 'Password berhasil diubah' });
  } catch (e) {
    console.error('Change password error:', e);
    return NextResponse.json({ error: 'Gagal mengubah password' }, { status: 500 });
  }
}
