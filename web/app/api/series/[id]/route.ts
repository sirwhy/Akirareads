import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, slugify } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function uniqueSlug(base: string): Promise<string> {
  const slug = slugify(base);
  const existing = await prisma.series.findUnique({ where: { slug }, select: { id: true } });
  if (!existing) return slug;
  return `${slug}-${Date.now().toString(36)}`;
}

// GET /api/series/:id — series + chapters desc + _count
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const series = await prisma.series.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { chapters: true, comments: true } },
        chapters: {
          orderBy: { chapterNum: 'desc' },
          include: { _count: { select: { pages: true } } },
        },
      },
    });
    if (!series) return NextResponse.json({ error: 'Series tidak ditemukan' }, { status: 404 });

    // Views naik saat halaman detail dibuka.
    const updated = await prisma.series.update({
      where: { id: series.id },
      data: { views: { increment: 1 } },
    });
    return NextResponse.json({ ...series, views: updated.views });
  } catch (e) {
    console.error('Get series by id error:', e);
    return NextResponse.json({ error: 'Gagal mengambil series' }, { status: 500 });
  }
}

// PUT /api/series/:id (admin) — update field yang dikirim
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireAdmin(req);
  if ('res' in guard) return guard.res;
  try {
    const {
      title,
      slug,
      description,
      author,
      artist,
      status,
      genres,
      cover,
      type,
      featured,
      rating,
      sourceUrl,
    } = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (slug !== undefined) data.slug = await uniqueSlug(String(slug));
    if (description !== undefined) data.description = description;
    if (author !== undefined) data.author = author;
    if (artist !== undefined) data.artist = artist;
    if (status !== undefined) data.status = status;
    if (genres !== undefined) data.genres = Array.isArray(genres) ? genres : [];
    if (cover !== undefined) data.cover = cover;
    if (type !== undefined) data.type = type;
    if (featured !== undefined) data.featured = Boolean(featured);
    if (rating !== undefined) data.rating = Number(rating) || 0;
    if (sourceUrl !== undefined) data.sourceUrl = sourceUrl;

    const series = await prisma.series.update({ where: { id: params.id }, data });
    return NextResponse.json({ message: 'Series berhasil diupdate', series });
  } catch (e) {
    console.error('Update series error:', e);
    return NextResponse.json({ error: 'Gagal mengupdate series' }, { status: 500 });
  }
}

// DELETE /api/series/:id (admin) — hapus cascade (chapters/pages/comments/bookmarks)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireAdmin(req);
  if ('res' in guard) return guard.res;
  try {
    await prisma.series.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Series berhasil dihapus' });
  } catch (e) {
    console.error('Delete series error:', e);
    return NextResponse.json({ error: 'Gagal menghapus series' }, { status: 500 });
  }
}
