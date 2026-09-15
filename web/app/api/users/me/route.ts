import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/users/me — profil user aktif
export async function GET(req: NextRequest) {
  const guard = requireUser(req);
  if ('res' in guard) return guard.res;
  try {
    const user = await prisma.user.findUnique({
      where: { id: guard.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        avatar: true,
        createdAt: true,
        _count: { select: { bookmarks: true, comments: true, readHistory: true } },
      },
    });
    if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ user });
  } catch (e) {
    console.error('Get me error:', e);
    return NextResponse.json({ error: 'Gagal mengambil data user' }, { status: 500 });
  }
}

// PUT /api/users/me — update { username?, avatar? }
export async function PUT(req: NextRequest) {
  const guard = requireUser(req);
  if ('res' in guard) return guard.res;
  try {
    const { username, avatar } = (await req.json().catch(() => ({}))) as {
      username?: string;
      avatar?: string;
    };
    const data: { username?: string; avatar?: string | null } = {};
    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, NOT: { id: guard.user.id } },
      });
      if (existing) return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 400 });
      data.username = username.trim();
    }
    if (avatar !== undefined) data.avatar = avatar;

    const user = await prisma.user.update({
      where: { id: guard.user.id },
      data,
      select: { id: true, email: true, username: true, role: true, avatar: true },
    });
    return NextResponse.json({ message: 'Profil berhasil diupdate', user });
  } catch (e) {
    console.error('Update me error:', e);
    return NextResponse.json({ error: 'Gagal update profil' }, { status: 500 });
  }
}
