import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/ads/all (admin) — semua iklan termasuk non-aktif
export async function GET(req: NextRequest) {
  const guard = requireAdmin(req);
  if ('res' in guard) return guard.res;
  try {
    const ads = await prisma.ad.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(ads);
  } catch (e) {
    console.error('Get all ads error:', e);
    return NextResponse.json({ error: 'Gagal mengambil iklan' }, { status: 500 });
  }
}
