import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/series/slug/:slug — bentuk sama dengan /api/series/:id
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const series = await prisma.series.findUnique({
      where: { slug: params.slug },
      include: {
        chapters: {
          orderBy: { chapterNum: 'desc' },
          include: { _count: { select: { pages: true } } },
        },
        _count: { select: { chapters: true, comments: true } },
      },
    });
    if (!series) return NextResponse.json({ error: 'Series tidak ditemukan' }, { status: 404 });

    const updated = await prisma.series.update({
      where: { id: series.id },
      data: { views: { increment: 1 } },
    });
    return NextResponse.json({ ...series, views: updated.views });
  } catch (e) {
    console.error('Get series by slug error:', e);
    return NextResponse.json({ error: 'Gagal mengambil series' }, { status: 500 });
  }
}
