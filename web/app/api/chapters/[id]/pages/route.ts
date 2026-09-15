import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/chapters/:id/pages (admin) — { pages: [urls] } append setelah nomor terakhir
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireAdmin(req);
  if ('res' in guard) return guard.res;
  try {
    const { pages } = (await req.json().catch(() => ({}))) as { pages?: string[] };
    if (!Array.isArray(pages) || !pages.length)
      return NextResponse.json({ error: 'Pages tidak boleh kosong' }, { status: 400 });

    const chapter = await prisma.chapter.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!chapter) return NextResponse.json({ error: 'Chapter tidak ditemukan' }, { status: 404 });

    const last = await prisma.page.aggregate({
      where: { chapterId: params.id },
      _max: { number: true },
    });
    const start = (last._max.number || 0) + 1;

    const created = await prisma.page.createMany({
      data: pages
        .filter((u): u is string => Boolean(u))
        .map((url, i) => ({ chapterId: params.id, number: start + i, imageUrl: url })),
    });

    return NextResponse.json(
      { message: `${created.count} halaman berhasil ditambahkan`, count: created.count },
      { status: 201 }
    );
  } catch (e) {
    console.error('Add pages error:', e);
    return NextResponse.json({ error: 'Gagal menambahkan halaman' }, { status: 500 });
  }
}
