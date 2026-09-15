import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/series/:id/comments — publik
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const comments = await prisma.comment.findMany({
      where: { seriesId: params.id },
      include: { user: { select: { username: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(comments);
  } catch (e) {
    console.error('Get comments error:', e);
    return NextResponse.json({ error: 'Gagal mengambil komentar' }, { status: 500 });
  }
}

// POST /api/series/:id/comments (auth) — { content }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireUser(req);
  if ('res' in guard) return guard.res;
  try {
    const { content } = (await req.json().catch(() => ({}))) as { content?: string };
    const text = (content || '').trim();
    if (!text) return NextResponse.json({ error: 'Komentar tidak boleh kosong' }, { status: 400 });
    if (text.length > 1000)
      return NextResponse.json({ error: 'Komentar maksimal 1000 karakter' }, { status: 400 });

    const comment = await prisma.comment.create({
      data: { content: text, userId: guard.user.id, seriesId: params.id },
      include: { user: { select: { username: true, avatar: true } } },
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (e) {
    console.error('Post comment error:', e);
    return NextResponse.json({ error: 'Gagal mengirim komentar' }, { status: 500 });
  }
}
