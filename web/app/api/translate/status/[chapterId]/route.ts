import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/translate/status/[chapterId] — PUBLIC (reader polls this; no admin guard).
 * → { job: { id, status, progress, total, done } | null, done: boolean }
 * `done` = every page of the chapter has translatedUrl.
 */
export async function GET(req: NextRequest, { params }: { params: { chapterId: string } }) {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id: params.chapterId },
      select: { id: true },
    });
    if (!chapter) return NextResponse.json({ error: 'Chapter tidak ditemukan' }, { status: 404 });

    const [latest, pageCount, translatedCount] = await Promise.all([
      prisma.translateJob.findFirst({
        where: { chapterId: chapter.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, progress: true, total: true, done: true },
      }),
      prisma.page.count({ where: { chapterId: chapter.id } }),
      prisma.page.count({ where: { chapterId: chapter.id, translatedUrl: { not: null } } }),
    ]);

    const done = pageCount > 0 && translatedCount === pageCount;
    return NextResponse.json({ job: latest, done });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memuat status' }, { status: 400 });
  }
}
