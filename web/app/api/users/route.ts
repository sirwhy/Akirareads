import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/users (admin) — daftar user + pagination
export async function GET(req: NextRequest) {
  const guard = requireAdmin(req);
  if ('res' in guard) return guard.res;
  try {
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1') || 1);
    const limit = Math.max(1, parseInt(sp.get('limit') || '20') || 20);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, username: true, role: true, avatar: true, createdAt: true },
      }),
      prisma.user.count(),
    ]);

    return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    console.error('Get users error:', e);
    return NextResponse.json({ error: 'Gagal mengambil data users' }, { status: 500 });
  }
}
