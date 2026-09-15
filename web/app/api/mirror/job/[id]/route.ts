import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET /api/mirror/job/[id] (admin) → { job }. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = requireAdmin(req);
  if (guard.ok === false) return guard.res;

  try {
    const job = await prisma.mirrorJob.findUnique({ where: { id: params.id } });
    if (!job) return NextResponse.json({ error: 'Job tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ job });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal memuat job' },
      { status: 400 },
    );
  }
}

/**
 * DELETE /api/mirror/job/[id] (admin) — cancel semantics:
 * RUNNING → keep row, mark FAILED with message 'dibatalkan';
 * PENDING → delete row;
 * DONE/FAILED (terminal) → delete row.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = requireAdmin(req);
  if (guard.ok === false) return guard.res;

  try {
    const job = await prisma.mirrorJob.findUnique({ where: { id: params.id } });
    if (!job) return NextResponse.json({ error: 'Job tidak ditemukan' }, { status: 404 });

    if (job.status === 'RUNNING') {
      await prisma.mirrorJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', message: 'dibatalkan' },
      });
      return NextResponse.json({ ok: true, cancelled: true });
    }

    await prisma.mirrorJob.delete({ where: { id: job.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal menghapus job' },
      { status: 400 },
    );
  }
}
