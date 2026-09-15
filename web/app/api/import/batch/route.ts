import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requireAdmin, slugify } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const chapterHash = (pages: string[]) => createHash('sha256').update(pages.join('|')).digest('hex');

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

interface BrowserChapter {
  chapterNum: number;
  title?: string;
  pages: string[];
}

interface ParsedImport { series: Record<string, unknown>; chapters: BrowserChapter[] }

function parsePayload(raw: unknown): ParsedImport {
  if (!raw || typeof raw !== 'object') throw new Error('Body harus JSON');
  const o = raw as Record<string, unknown>;
  const s = o.series;
  if (!s || typeof s !== 'object') throw new Error('Field series wajib ada');
  const so = s as Record<string, unknown>;
  const title = str(so.title);
  if (!title) throw new Error('series.title wajib ada');

  const rawChapters = o.chapters;
  if (!Array.isArray(rawChapters) || rawChapters.length === 0) {
    throw new Error('Tidak ada chapter dalam data yang dikirim');
  }

  const chapters: BrowserChapter[] = [];
  for (const c of rawChapters) {
    if (!c || typeof c !== 'object') continue;
    const co = c as Record<string, unknown>;
    const num =
      typeof co.chapterNum === 'number' ? co.chapterNum : parseFloat(String(co.chapterNum ?? co.num ?? co.number ?? ''));
    if (!Number.isFinite(num)) continue;
    const pages = Array.isArray(co.pages) ? co.pages.filter((p): p is string => typeof p === 'string' && p.length > 0) : [];
    if (pages.length === 0) continue;
    const titleC = str(co.title);
    chapters.push({ chapterNum: num, title: titleC, pages });
  }

  const series: Record<string, unknown> = { title };
  const slug = str(so.slug);
  if (slug) series.slug = slug;
  for (const k of ['cover', 'description', 'author', 'artist', 'status', 'type', 'sourceUrl', 'sourceSite'] as const) {
    const v = str(so[k]);
    if (v !== undefined) series[k] = v;
  }
  if (Array.isArray(so.genres)) {
    series.genres = so.genres.filter((g): g is string => typeof g === 'string' && g.length > 0);
  }
  return { series, chapters };
}

/**
 * POST /api/import/batch (admin)
 * Browser-import endpoint (bookmarklet / devtools script target). Upserts Series
 * by slug, replaces Pages per chapter (dedup by seriesId+chapterNum), stores
 * sha256(pages) chapter hash for cross-chapter translation cache.
 * Per-chapter errors are collected; response always includes a summary.
 */
export async function POST(req: NextRequest) {
  const guard = requireAdmin(req);
  if (guard.ok === false) return guard.res;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body harus JSON' }, { status: 400 });
  }

  let parsed: ParsedImport;
  try {
    parsed = parsePayload(raw);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Data tidak valid' }, { status: 400 });
  }
  const { series: sData, chapters } = parsed;
  if (chapters.length === 0) {
    return NextResponse.json({ error: 'Tidak ada chapter valid (semuanya kosong)' }, { status: 400 });
  }

  try {
    // ── Series upsert by slug ────────────────────────────────────────────────
    const baseSlug = typeof sData.slug === 'string' ? sData.slug : slugify(String(sData.title));
    let series = await prisma.series.findUnique({ where: { slug: baseSlug } });
    if (!series) {
      // baseSlug provably free (findUnique returned null); on concurrent race the
      // unique constraint rejects and the outer catch returns 400 — admin retries.
      series = await prisma.series.create({
        data: {
          title: String(sData.title),
          slug: baseSlug,
          description: (sData.description as string) ?? '',
          author: (sData.author as string) ?? null,
          artist: (sData.artist as string) ?? null,
          status: (sData.status as string) ?? 'ONGOING',
          type: (sData.type as string) ?? 'MANHWA',
          cover: (sData.cover as string) ?? '',
          genres: Array.isArray(sData.genres) ? (sData.genres as string[]) : [],
          sourceUrl: (sData.sourceUrl as string) ?? null,
          sourceSite: (sData.sourceSite as string) ?? null,
        },
      });
    } else {
      // Reuse existing row; backfill empty fields only.
      const patch: Record<string, unknown> = {};
      if (!series.sourceUrl && sData.sourceUrl) patch.sourceUrl = sData.sourceUrl;
      if (!series.cover && sData.cover) patch.cover = sData.cover;
      if (!series.sourceSite && sData.sourceSite) patch.sourceSite = sData.sourceSite;
      if (!series.description && sData.description) patch.description = sData.description;
      if (!series.author && sData.author) patch.author = sData.author;
      if (Object.keys(patch).length > 0) {
        series = await prisma.series.update({ where: { id: series.id }, data: patch });
      }
    }

    // ── Chapters: upsert by seriesId + chapterNum, replace pages ─────────────
    const ok: Array<{ chapterNum: number; chapterId: string; created: boolean }> = [];
    const failed: Array<{ chapterNum: number; error: string }> = [];
    let chaptersCreated = 0;
    let chaptersUpdated = 0;
    let pagesCreated = 0;

    for (const ch of chapters) {
      try {
        const hash = chapterHash(ch.pages);
        const existing = await prisma.chapter.findFirst({
          where: { seriesId: series.id, chapterNum: ch.chapterNum },
          select: { id: true },
        });

        let chapterId: string;
        if (existing) {
          await prisma.page.deleteMany({ where: { chapterId: existing.id } });
          await prisma.page.createMany({
            data: ch.pages.map((url, i) => ({ chapterId: existing.id, number: i + 1, imageUrl: url })),
          });
          try {
            await prisma.chapter.update({
              where: { id: existing.id },
              data: { ...(ch.title !== undefined ? { title: ch.title } : {}), hash },
            });
          } catch {
            // hash unique clash (repost elsewhere) — update meta without hash.
            await prisma.chapter.update({
              where: { id: existing.id },
              data: ch.title !== undefined ? { title: ch.title } : {},
            });
          }
          chapterId = existing.id;
          chaptersUpdated++;
        } else {
          const created = await prisma.chapter.create({
            data: {
              seriesId: series.id,
              chapterNum: ch.chapterNum,
              title: ch.title ?? null,
              hash,
              pages: { create: ch.pages.map((url, i) => ({ number: i + 1, imageUrl: url })) },
            },
          });
          chapterId = created.id;
          chaptersCreated++;
        }
        pagesCreated += ch.pages.length;
        ok.push({ chapterNum: ch.chapterNum, chapterId, created: !existing });
      } catch (e) {
        failed.push({ chapterNum: ch.chapterNum, error: e instanceof Error ? e.message : 'gagal simpan' });
      }
    }

    return NextResponse.json({
      seriesId: series.id,
      seriesSlug: series.slug,
      chaptersCreated,
      chaptersUpdated,
      pagesCreated,
      ok,
      failed,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Import gagal' }, { status: 400 });
  }
}
