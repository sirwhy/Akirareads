import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function msg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/**
 * POST /api/translate/series/[seriesId] (admin) { targetLang? }
 * Enqueue translate jobs for every chapter of the series that has at least one
 * page and NO page translated yet, skipping chapters with an active PENDING|RUNNING
 * job. Powers the "translate full series" admin button.
 */
export async function POST(req: NextRequest, { params }: { params: { seriesId: string } }) {
  const guard = requireAdmin(req);
  if (guard.ok === false) return guard.res;

  try {
    let targetLang: unknown;
    try {
      const b = await req.json();
      targetLang = b && typeof b === 'object' ? (b as Record<string, unknown>).targetLang : undefined;
    } catch {
      targetLang = undefined;
    }
    const lang = typeof targetLang === 'string' && targetLang.trim() ? targetLang.trim() : 'id';

    const series = await prisma.series.findUnique({
      where: { id: params.seriesId },
      select: { id: true },
    });
    if (!series) return NextResponse.json({ error: 'Series tidak ditemukan' }, { status: 404 });

    const chapters = await prisma.chapter.findMany({
      where: {
        seriesId: series.id,
        pages: { some: {}, none: { translatedUrl: { not: null } } },
      },
      select: { id: true, _count: { select: { pages: true } } },
      orderBy: { chapterNum: 'asc' },
    });

    // Skip chapters that already have an active job.
    const active = await prisma.translateJob.findMany({
      where: { chapterId: { in: chapters.map((c) => c.id) }, status: { in: ['PENDING', 'RUNNING'] } },
      select: { chapterId: true },
    });
    const busy = new Set(active.map((j) => j.chapterId));

    const jobs = [];
    for (const ch of chapters) {
      if (busy.has(ch.id)) continue;
      const job = await prisma.translateJob.create({
        data: { chapterId: ch.id, total: ch._count.pages, status: 'PENDING', targetLang: lang },
      });
      jobs.push(job.id);
    }

    return NextResponse.json({ queued: jobs.length, jobs }, { status: jobs.length > 0 ? 201 : 200 });
  } catch (e) {
    return NextResponse.json({ error: msg(e, 'Gagal enqueue job series') }, { status: 400 });
  }
}
