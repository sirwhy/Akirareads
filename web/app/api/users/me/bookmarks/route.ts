import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/users/me/bookmarks — daftar bookmark user aktif
export async function GET(req: NextRequest) {
  const guard = requireUser(req);
  if ('res' in guard) return guard.res;
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: guard.user.id },
      include: {
        series: {
          select: {
            id: true,
            title: true,
            slug: true,
            cover: true,
            status: true,
            type: true,
            _count: { select: { chapters: true } },
          },
        },
      },
      orderBy: { id: 'desc' },
    });
    return NextResponse.json(bookmarks);
  } catch (e) {
    console.error('Get bookmarks error:', e);
    return NextResponse.json({ error: 'Gagal mengambil bookmark' }, { status: 500 });
  }
}
