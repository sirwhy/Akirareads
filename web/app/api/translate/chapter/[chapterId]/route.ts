import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function body(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function msg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
/**
 * POST /api/translate/chapter/[chapterId] (admin) { targetLang? }
 * Enqueue a translate job for one chapter. Idempotent: if a PENDING|RUNNING
 * job already exists for the chapter, returns it with queued:false.
 */
export async function POST(req: NextRequest, { params }: { params: { chapterId: string } }) {
  const guard = requireAdmin(req);
  if (guard.ok === false) return guard.res;

  try {
    const { targetLang } = await body(req);
    const chapter = await prisma.chapter.findUnique({
      where: { id: params.chapterId },
      include: { _count: { select: { pages: true } } },
    });
    if (!chapter) return NextResponse.json({ error: 'Chapter tidak ditemukan' }, { status: 404 });

    const pageCount = chapter._count.pages;
    if (pageCount === 0) return NextResponse.json({ error: 'Chapter tidak punya halaman' }, { status: 400 });

    const active = await prisma.translateJob.findFirst({
      where: { chapterId: chapter.id, status: { in: ['PENDING', 'RUNNING'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (active) return NextResponse.json({ job: active, queued: false });

    const lang = typeof targetLang === 'string' && targetLang.trim() ? targetLang.trim() : 'id';
    const job = await prisma.translateJob.create({
      data: { chapterId: chapter.id, total: pageCount, status: 'PENDING', targetLang: lang },
    });
    return NextResponse.json({ job, queued: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: msg(e, 'Gagal membuat job') }, { status: 400 });
  }
}

/**
 * DELETE /api/translate/chapter/[chapterId] (admin)
 * Cancel the chapter's active job: RUNNING → FAILED (error 'cancelled', row kept),
 * PENDING → row deleted.
 */
export async function DELETE(req: NextRequest, { params }: { params: { chapterId: string } }) {
  const guard = requireAdmin(req);
  if (guard.ok === false) return guard.res;

  try {
    const active = await prisma.translateJob.findFirst({
      where: { chapterId: params.chapterId, status: { in: ['PENDING', 'RUNNING'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!active) return NextResponse.json({ error: 'Tidak ada job aktif' }, { status: 404 });

    if (active.status === 'RUNNING') {
      const job = await prisma.translateJob.update({
        where: { id: active.id },
        data: { status: 'FAILED', error: 'cancelled', message: 'Dibatalkan admin' },
      });
      return NextResponse.json({ ok: true, job });
    }

    await prisma.translateJob.delete({ where: { id: active.id } });
    return NextResponse.json({ ok: true, job: null });
  } catch (e) {
    return NextResponse.json({ error: msg(e, 'Gagal membatalkan job') }, { status: 400 });
  }
}
