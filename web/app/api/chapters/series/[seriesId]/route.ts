import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/chapters/series/:seriesId — Chapter[] desc, tiap item ada _count.pages
export async function GET(
  req: NextRequest,
  { params }: { params: { seriesId: string } }
) {
  try {
    const chapters = await prisma.chapter.findMany({
      where: { seriesId: params.seriesId },
      orderBy: { chapterNum: 'desc' },
      include: { _count: { select: { pages: true } } },
    });
    return NextResponse.json(chapters);
  } catch (e) {
    console.error('Get chapters error:', e);
    return NextResponse.json({ error: 'Gagal mengambil chapters' }, { status: 500 });
  }
}
