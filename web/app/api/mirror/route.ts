import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Same site-detection rules as old server/routes/mirror.js detectSite(). */
function detectSite(url: string): string {
  if (/mangadex\.org/.test(url)) return 'mangadex';
  if (/ikiru\.(id|wtf)/.test(url)) return 'ikiru';
  if (/shinigami\.(asia|io)/.test(url)) return 'shinigami';
  if (/shngm\.(id|io)/.test(url)) return 'shinigami';
  if (/komiku\.(id|com)/.test(url)) return 'komiku';
  if (/manhwaindo\.id/.test(url)) return 'manhwaindo';
  if (/komikcast\.io/.test(url)) return 'komikcast';
  if (/\/manga\/|\/komik\/|\/series\//.test(url)) return 'madara';
  return 'generic';
}

function msg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/**
 * POST /api/mirror (admin) { url, targetLang? }
 * Validate URL (must start http; hostname known via detectSite or path contains
 * /manga/|/komik/|/series/), create MirrorJob PENDING → 201 { job }.
 */
export async function POST(req: NextRequest) {
  const guard = requireAdmin(req);
  if (guard.ok === false) return guard.res;

  try {
    let url: unknown;
    try {
      const b = await req.json();
      url = b && typeof b === 'object' ? (b as Record<string, unknown>).url : undefined;
    } catch {
      return NextResponse.json({ error: 'Body harus JSON {url}' }, { status: 400 });
    }
    if (typeof url !== 'string' || !url.startsWith('http')) {
      return NextResponse.json({ error: 'URL tidak valid — harus dimulai dengan http' }, { status: 400 });
    }

    const site = detectSite(url);
    let hostname = '';
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = '';
    }
    const pathOk = /\/manga\/|\/komik\/|\/series\//.test(url);
    if (!hostname) {
      return NextResponse.json(
        { error: 'URL tidak bisa dibaca — contoh benar: https://situs.com/manga/judul/' },
        { status: 400 },
      );
    }
    if (site === 'generic' && !pathOk) {
      return NextResponse.json(
        { error: `Situs "${hostname}" tidak dikenal — URL harus mengandung /manga/, /komik/, atau /series/` },
        { status: 400 },
      );
    }

    const job = await prisma.mirrorJob.create({
      data: { sourceUrl: url, sourceSite: site, status: 'PENDING', message: 'Job dibuat...' },
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: msg(e, 'Gagal membuat mirror job') }, { status: 400 });
  }
}

/** GET /api/mirror (admin) — alias list: latest 50 jobs, safe fields. */
export async function GET(req: NextRequest) {
  const guard = requireAdmin(req);
  if (guard.ok === false) return guard.res;

  try {
    const jobs = await prisma.mirrorJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        sourceUrl: true,
        sourceSite: true,
        status: true,
        progress: true,
        total: true,
        message: true,
        seriesId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ jobs });
  } catch (e) {
    return NextResponse.json({ error: msg(e, 'Gagal memuat jobs') }, { status: 400 });
  }
}
