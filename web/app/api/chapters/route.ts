import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/chapters (admin) — { seriesId, title, chapterNum, pages?: [urls] }
export async function POST(req: NextRequest) {
  const guard = requireAdmin(req);
  if ('res' in guard) return guard.res;
  try {
    const { seriesId, title, chapterNum, pages } = (await req.json().catch(() => ({}))) as {
      seriesId?: string;
      title?: string;
      chapterNum?: number | string;
      pages?: string[];
    };

    if (!seriesId || chapterNum === undefined || chapterNum === null || chapterNum === '')
      return NextResponse.json({ error: 'SeriesId dan chapterNum wajib diisi' }, { status: 400 });
    const num = parseFloat(String(chapterNum));
    if (Number.isNaN(num))
      return NextResponse.json({ error: 'chapterNum harus berupa angka' }, { status: 400 });

    const urls = Array.isArray(pages) ? pages.filter(Boolean) : [];
    const chapter = await prisma.chapter.create({
      data: {
        seriesId,
        title,
        chapterNum: num,
        pages: urls.length
          ? { create: urls.map((url, i) => ({ number: i + 1, imageUrl: url })) }
          : undefined,
      },
      include: { pages: { orderBy: { number: 'asc' } } },
    });

    // Sentuh updatedAt series supaya urutan "updates" ikut terbaru.
    await prisma.series.update({ where: { id: seriesId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ message: 'Chapter berhasil dibuat', chapter }, { status: 201 });
  } catch (e) {
    console.error('Create chapter error:', e);
    return NextResponse.json({ error: 'Gagal membuat chapter' }, { status: 500 });
  }
}
