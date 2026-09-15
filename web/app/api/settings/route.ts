import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/settings (public) — object { key: value }
export async function GET(req: NextRequest) {
  try {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) result[s.key] = s.value;
    return NextResponse.json(result);
  } catch (e) {
    console.error('Get settings error:', e);
    return NextResponse.json({ error: 'Gagal mengambil settings' }, { status: 500 });
  }
}

// PUT /api/settings (admin) — terima { key, value } tunggal atau peta { k: v, ... }
export async function PUT(req: NextRequest) {
  const guard = requireAdmin(req);
  if ('res' in guard) return guard.res;
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object')
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });

    const entries: Array<[string, string]> =
      typeof body.key === 'string' && body.value !== undefined
        ? [[body.key, String(body.value)]]
        : Object.entries(body).map(([k, v]) => [k, String(v)]);

    if (!entries.length)
      return NextResponse.json({ error: 'Tidak ada setting untuk disimpan' }, { status: 400 });

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    return NextResponse.json({ message: 'Settings berhasil disimpan' });
  } catch (e) {
    console.error('Update settings error:', e);
    return NextResponse.json({ error: 'Gagal menyimpan settings' }, { status: 500 });
  }
}
