import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/lib/generated/prisma';
import { prisma } from '@/lib/prisma';
import { requireAdmin, slugify } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Alias sort → kolom series (field mentah juga diterima selama ada di map). */
const SORT_FIELDS: Record<string, 'createdAt' | 'updatedAt' | 'views' | 'rating' | 'title'> = {
  newest: 'createdAt',
  popular: 'views',
  rating: 'rating',
  updates: 'updatedAt',
  createdAt: 'createdAt',
  views: 'views',
  updatedAt: 'updatedAt',
  title: 'title',
};

async function uniqueSlug(base: string): Promise<string> {
  const slug = slugify(base);
  const existing = await prisma.series.findUnique({ where: { slug }, select: { id: true } });
  if (!existing) return slug;
  return `${slug}-${Date.now().toString(36)}`;
}

// GET /api/series?page&limit&search&genre&type&status&sort&order&featured — publik
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20') || 20));
    const skip = (page - 1) * limit;

    const search = sp.get('search') || sp.get('q');
    const genre = sp.get('genre');
    const type = sp.get('type');
    const status = sp.get('status');
    const featured = sp.get('featured');

    const where: Prisma.SeriesWhereInput = {};
    if (genre) where.genres = { has: genre };
    if (type) where.type = type;
    if (status) where.status = status;
    if (featured === '1' || featured === 'true') where.featured = true;
    if (search) where.title = { contains: search, mode: 'insensitive' };

    const sort = sp.get('sort') || 'newest';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const field = SORT_FIELDS[sort] || 'createdAt';
    const orderBy: Prisma.SeriesOrderByWithRelationInput = { [field]: order };

    const [data, total] = await Promise.all([
      prisma.series.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { _count: { select: { chapters: true } } },
      }),
      prisma.series.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    console.error('Get series error:', e);
    return NextResponse.json({ error: 'Gagal mengambil data series' }, { status: 500 });
  }
}

// POST /api/series (admin) — buat series baru, slug auto-unik
export async function POST(req: NextRequest) {
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
      type,
      cover,
      featured,
      sourceUrl,
    } = (await req.json().catch(() => ({}))) as {
      title?: string;
      slug?: string;
      description?: string;
      author?: string;
      artist?: string;
      status?: string;
      genres?: string[];
      type?: string;
      cover?: string;
      featured?: boolean;
      sourceUrl?: string;
    };

    if (!title) return NextResponse.json({ error: 'Title wajib diisi' }, { status: 400 });

    const series = await prisma.series.create({
      data: {
        title,
        slug: await uniqueSlug(slug || title),
        description,
        author,
        artist,
        status: status || 'ONGOING',
        genres: Array.isArray(genres) ? genres : [],
        type: type || 'MANHWA',
        cover,
        featured: featured || false,
        sourceUrl,
      },
    });

    return NextResponse.json({ message: 'Series berhasil dibuat', series }, { status: 201 });
  } catch (e) {
    console.error('Create series error:', e);
    return NextResponse.json({ error: 'Gagal membuat series' }, { status: 500 });
  }
}
