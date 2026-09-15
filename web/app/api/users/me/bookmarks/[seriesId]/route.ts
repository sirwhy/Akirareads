import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/users/me/bookmarks/:seriesId — toggle bookmark
export async function POST(
  req: NextRequest,
  { params }: { params: { seriesId: string } }
) {
  const guard = requireUser(req);
  if ('res' in guard) return guard.res;
  const { seriesId } = params;
  try {
    const series = await prisma.series.findUnique({
      where: { id: seriesId },
      select: { id: true },
    });
    if (!series) return NextResponse.json({ error: 'Series tidak ditemukan' }, { status: 404 });

    const existing = await prisma.bookmark.findUnique({
      where: { userId_seriesId: { userId: guard.user.id, seriesId } },
    });
    if (existing) {
      await prisma.bookmark.delete({ where: { userId_seriesId: { userId: guard.user.id, seriesId } } });
      return NextResponse.json({ bookmarked: false, message: 'Bookmark dihapus' });
    }
    await prisma.bookmark.create({ data: { userId: guard.user.id, seriesId } });
    return NextResponse.json({ bookmarked: true, message: 'Bookmark ditambahkan' });
  } catch (e) {
    console.error('Toggle bookmark error:', e);
    return NextResponse.json({ error: 'Gagal toggle bookmark' }, { status: 500 });
  }
}
