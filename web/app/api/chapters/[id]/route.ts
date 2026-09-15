import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/chapters/:id — chapter + pages asc + prev/next + translateJob; views++
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id: params.id },
      include: {
        pages: { orderBy: { number: 'asc' } },
        series: { select: { id: true, title: true, slug: true } },
      },
    });
    if (!chapter) return NextResponse.json({ error: 'Chapter tidak ditemukan' }, { status: 404 });

    const [updated, prevChapter, nextChapter, translateJob] = await Promise.all([
      prisma.chapter.update({
        where: { id: chapter.id },
        data: { views: { increment: 1 } },
        select: { views: true },
      }),
      prisma.chapter.findFirst({
        where: { seriesId: chapter.seriesId, chapterNum: { lt: chapter.chapterNum } },
        orderBy: { chapterNum: 'desc' },
        select: { id: true, title: true, chapterNum: true },
      }),
      prisma.chapter.findFirst({
        where: { seriesId: chapter.seriesId, chapterNum: { gt: chapter.chapterNum } },
        orderBy: { chapterNum: 'asc' },
        select: { id: true, title: true, chapterNum: true },
      }),
      // Progress terjemahan terbaru → Reader bisa polling murah lewat respons ini.
      prisma.translateJob.findFirst({
        where: { chapterId: chapter.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, progress: true, total: true, done: true, targetLang: true },
      }),
    ]);

    return NextResponse.json({
      ...chapter,
      views: updated.views,
      prevChapter,
      nextChapter,
      translateJob,
    });
  } catch (e) {
    console.error('Get chapter error:', e);
    return NextResponse.json({ error: 'Gagal mengambil chapter' }, { status: 500 });
  }
}

// PUT /api/chapters/:id (admin) — { title?, chapterNum? }
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireAdmin(req);
  if ('res' in guard) return guard.res;
  try {
    const { title, chapterNum } = (await req.json().catch(() => ({}))) as {
      title?: string;
      chapterNum?: number | string;
    };
    const data: { title?: string; chapterNum?: number } = {};
    if (title !== undefined) data.title = title;
    if (chapterNum !== undefined && chapterNum !== null && chapterNum !== '') {
      const num = parseFloat(String(chapterNum));
      if (Number.isNaN(num))
        return NextResponse.json({ error: 'chapterNum harus berupa angka' }, { status: 400 });
      data.chapterNum = num;
    }

    const chapter = await prisma.chapter.update({ where: { id: params.id }, data });
    return NextResponse.json({ message: 'Chapter berhasil diupdate', chapter });
  } catch (e) {
    console.error('Update chapter error:', e);
    return NextResponse.json({ error: 'Gagal mengupdate chapter' }, { status: 500 });
  }
}

// DELETE /api/chapters/:id (admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireAdmin(req);
  if ('res' in guard) return guard.res;
  try {
    await prisma.chapter.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Chapter berhasil dihapus' });
  } catch (e) {
    console.error('Delete chapter error:', e);
    return NextResponse.json({ error: 'Gagal menghapus chapter' }, { status: 500 });
  }
}
