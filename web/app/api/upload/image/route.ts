import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'image/jpeg'],
  ['image/jpg', 'image/jpeg'],
  ['image/png', 'image/png'],
  ['image/webp', 'image/webp'],
  ['image/gif', 'image/gif'],
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/upload/image (admin) — multipart/form-data, field 'image'.
 * Returns a base64 data URL (DB-safe: covers accept data URLs). No disk writes
 * (Vercel serverless), so multer-equivalent storage is unnecessary.
 */
export async function POST(req: NextRequest) {
  const guard = requireAdmin(req);
  if (guard.ok === false) return guard.res;

  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Body harus multipart/form-data' }, { status: 400 });
    }

    const file = form.get('image');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File tidak valid atau tidak ada (field: image)' }, { status: 400 });
    }

    const mime = ALLOWED.get((file.type || '').toLowerCase());
    if (!mime) {
      return NextResponse.json({ error: 'Tipe gambar tidak didukung (jpeg/png/webp/gif)' }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'File kosong' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Ukuran file melebihi 10MB' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const url = `data:${mime};base64,${buf.toString('base64')}`;
    return NextResponse.json({ url, size: file.size });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload gagal' },
      { status: 400 },
    );
  }
}
