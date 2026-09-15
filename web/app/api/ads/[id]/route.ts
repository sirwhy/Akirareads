import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// PUT /api/ads/:id (admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (position !== undefined) data.position = position;
    if (code !== undefined) data.code = code;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (linkUrl !== undefined) data.linkUrl = linkUrl;
    if (active !== undefined) data.active = active;

    const ad = await prisma.ad.update({ where: { id: params.id }, data });
    return NextResponse.json({ message: 'Iklan berhasil diupdate', ad });
  } catch (e) {
    console.error('Update ad error:', e);
    return NextResponse.json({ error: 'Gagal mengupdate iklan' }, { status: 500 });
  }
}

// DELETE /api/ads/:id (admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireAdmin(req);
  if ('res' in guard) return guard.res;
  try {
    await prisma.ad.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Iklan berhasil dihapus' });
  } catch (e) {
    console.error('Delete ad error:', e);
    return NextResponse.json({ error: 'Gagal menghapus iklan' }, { status: 500 });
  }
}
