import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET /api/translate/job/[id] (admin) → { job } with progress fields. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = requireAdmin(req);
  if (guard.ok === false) return guard.res;

  try {
    const job = await prisma.translateJob.findUnique({ where: { id: params.id } });
    if (!job) return NextResponse.json({ error: 'Job tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ job });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memuat job' }, { status: 400 });
  }
}
