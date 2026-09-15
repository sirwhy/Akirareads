import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/ads (public) — hanya iklan aktif, opsional ?position=
export async function GET(req: NextRequest) {
  try {
    const position = req.nextUrl.searchParams.get('position');
    const ads = await prisma.ad.findMany({
      where: position ? { active: true, position } : { active: true },
    });
    return NextResponse.json(ads);
  } catch (e) {
    console.error('Get ads error:', e);
    return NextResponse.json({ error: 'Gagal mengambil iklan' }, { status: 500 });
  }
}

// POST /api/ads (admin) — buat iklan
export async function POST(req: NextRequest) {
  const guard = requireAdmin(req);
  if ('res' in guard) return guard.res;
  try {
    const { name, position, code, imageUrl, linkUrl, active } =
      (await req.json().catch(() => ({}))) as {
        name?: string;
        position?: string;
        code?: string;
        imageUrl?: string;
        linkUrl?: string;
        active?: boolean;
      };
    if (!name || !position)
      return NextResponse.json({ error: 'Nama dan posisi wajib diisi' }, { status: 400 });

    const ad = await prisma.ad.create({
      data: {
        name,
        position,
        code: code || '',
        imageUrl,
        linkUrl,
        active: active !== undefined ? active : true,
      },
    });
    return NextResponse.json({ message: 'Iklan berhasil dibuat', ad }, { status: 201 });
  } catch (e) {
    console.error('Create ad error:', e);
    return NextResponse.json({ error: 'Gagal membuat iklan' }, { status: 500 });
  }
}
