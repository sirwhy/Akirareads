import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/chapters/:id/read (auth) — upsert ReadHistory
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireUser(req);
  if ('res' in guard) return guard.res;
  try {
    const chapter = await prisma.chapter.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!chapter) return NextResponse.json({ error: 'Chapter tidak ditemukan' }, { status: 404 });

    await prisma.readHistory.upsert({
      where: { userId_chapterId: { userId: guard.user.id, chapterId: params.id } },
      update: { createdAt: new Date() },
      create: { userId: guard.user.id, chapterId: params.id },
    });
    return NextResponse.json({ message: 'Riwayat baca tersimpan' });
  } catch (e) {
    console.error('Save read history error:', e);
    return NextResponse.json({ error: 'Gagal menyimpan riwayat' }, { status: 500 });
  }
}
