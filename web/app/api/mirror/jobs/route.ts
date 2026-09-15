import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET /api/mirror/jobs (admin) — latest 50 MirrorJobs, safe fields. */
export async function GET(req: NextRequest) {
  const guard = requireAdmin(req);
  if (guard.ok === false) return guard.res;

  try {
    const jobs = await prisma.mirrorJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        sourceUrl: true,
        sourceSite: true,
        status: true,
        progress: true,
        total: true,
        message: true,
        seriesId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ jobs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal memuat jobs' },
      { status: 400 },
    );
  }
}
