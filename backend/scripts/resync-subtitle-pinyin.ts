import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CHINESE_CHAR_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

function parseArg(name: string): string | undefined {
  const key = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(key));
  return hit ? hit.slice(key.length) : undefined;
}

function countChineseChars(input: string): number {
  return Array.from(input || '').filter((ch) => CHINESE_CHAR_RE.test(ch))
    .length;
}

function normalizePinyin(text: string): string {
  return (text || '').trim().replace(/\s+/g, ' ');
}

type AssignSource =
  | 'vocabulary_id'
  | 'vocabulary_unique_hanzi'
  | 'subtitle_alignment';

interface PlannedUpdate {
  tokenId: string;
  subtitleId: string;
  videoId: string;
  subtitleOrder: number;
  tokenPosition: number;
  hanzi: string;
  oldPinyin: string;
  newPinyin: string;
  source: AssignSource;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const videoIdFilter = parseArg('videoId');
  const limitArg = parseArg('limit');
  const limit = limitArg ? Math.max(1, Number(limitArg)) : 500;

  if (Number.isNaN(limit)) {
    throw new Error('Invalid --limit value');
  }

  const missingTokens = await prisma.subtitleToken.findMany({
    where: {
      pinyin: '',
      subtitle: videoIdFilter ? { videoId: videoIdFilter } : undefined,
    },
    take: limit,
    orderBy: [{ subtitleId: 'asc' }, { position: 'asc' }],
    select: {
      id: true,
      subtitleId: true,
      position: true,
      hanzi: true,
      pinyin: true,
      vocabularyId: true,
      subtitle: {
        select: {
          videoId: true,
          sequenceOrder: true,
          pinyin: true,
        },
      },
    },
  });

  if (missingTokens.length === 0) {
    console.log('No missing-pinyin Chinese tokens found for selected scope.');
    return;
  }

  const chineseMissingTokens = missingTokens.filter((t) =>
    CHINESE_CHAR_RE.test(t.hanzi || ''),
  );

  if (chineseMissingTokens.length === 0) {
    console.log('No missing-pinyin Chinese tokens found for selected scope.');
    return;
  }

  const subtitleIds = Array.from(
    new Set(chineseMissingTokens.map((t) => t.subtitleId)),
  );
  const subtitleTokens = await prisma.subtitleToken.findMany({
    where: { subtitleId: { in: subtitleIds } },
    orderBy: [{ subtitleId: 'asc' }, { position: 'asc' }],
    select: {
      id: true,
      subtitleId: true,
      position: true,
      hanzi: true,
      pinyin: true,
      vocabularyId: true,
    },
  });

  const tokensBySubtitle = new Map<string, typeof subtitleTokens>();
  for (const token of subtitleTokens) {
    const bucket = tokensBySubtitle.get(token.subtitleId) || [];
    bucket.push(token);
    tokensBySubtitle.set(token.subtitleId, bucket);
  }

  const vocabIds = Array.from(
    new Set(
      chineseMissingTokens
        .map((t) => t.vocabularyId)
        .filter(Boolean) as string[],
    ),
  );
  const vocabById = new Map<string, string>();
  if (vocabIds.length > 0) {
    const vocabRows = await prisma.vocabulary.findMany({
      where: { id: { in: vocabIds } },
      select: { id: true, pinyin: true },
    });
    for (const v of vocabRows) {
      const py = normalizePinyin(v.pinyin || '');
      if (py) vocabById.set(v.id, py);
    }
  }

  const missingHanzi = Array.from(
    new Set(chineseMissingTokens.map((t) => t.hanzi)),
  );
  const vocabByHanzi = new Map<string, string[]>();
  if (missingHanzi.length > 0) {
    const vocabRows = await prisma.vocabulary.findMany({
      where: { hanzi: { in: missingHanzi } },
      select: { hanzi: true, pinyin: true },
    });

    for (const row of vocabRows) {
      const py = normalizePinyin(row.pinyin || '');
      if (!py) continue;
      const list = vocabByHanzi.get(row.hanzi) || [];
      if (!list.includes(py)) list.push(py);
      vocabByHanzi.set(row.hanzi, list);
    }
  }

  const planned: PlannedUpdate[] = [];

  for (const token of chineseMissingTokens) {
    const base = {
      tokenId: token.id,
      subtitleId: token.subtitleId,
      videoId: token.subtitle.videoId,
      subtitleOrder: token.subtitle.sequenceOrder,
      tokenPosition: token.position,
      hanzi: token.hanzi,
      oldPinyin: token.pinyin || '',
    };

    if (token.vocabularyId) {
      const py = vocabById.get(token.vocabularyId);
      if (py) {
        planned.push({ ...base, newPinyin: py, source: 'vocabulary_id' });
        continue;
      }
    }

    const pyCandidates = vocabByHanzi.get(token.hanzi) || [];
    if (pyCandidates.length === 1) {
      planned.push({
        ...base,
        newPinyin: pyCandidates[0],
        source: 'vocabulary_unique_hanzi',
      });
      continue;
    }

    const lineTokens = tokensBySubtitle.get(token.subtitleId) || [];
    const linePinyin = normalizePinyin(token.subtitle.pinyin || '');
    const syllables = linePinyin ? linePinyin.split(' ').filter(Boolean) : [];

    if (lineTokens.length > 0 && syllables.length > 0) {
      const chineseCounts = lineTokens.map((t) =>
        countChineseChars(t.hanzi || ''),
      );
      const expected = chineseCounts.reduce((sum, n) => sum + n, 0);

      if (expected === syllables.length) {
        let cursor = 0;
        for (let i = 0; i < lineTokens.length; i++) {
          const count = chineseCounts[i];
          const current = lineTokens[i];
          const slice =
            count > 0 ? syllables.slice(cursor, cursor + count) : [];
          cursor += count;

          if (current.id !== token.id) continue;
          if (slice.length === 0) break;

          planned.push({
            ...base,
            newPinyin: slice.join(' '),
            source: 'subtitle_alignment',
          });
        }
      }
    }
  }

  const unresolved = chineseMissingTokens.length - planned.length;
  const bySource = {
    vocabulary_id: planned.filter((p) => p.source === 'vocabulary_id').length,
    vocabulary_unique_hanzi: planned.filter(
      (p) => p.source === 'vocabulary_unique_hanzi',
    ).length,
    subtitle_alignment: planned.filter((p) => p.source === 'subtitle_alignment')
      .length,
  };

  console.log('=== Subtitle Pinyin Resync Plan ===');
  console.log(
    `Mode: ${apply ? 'APPLY (write enabled)' : 'DRY-RUN (read-only)'}`,
  );
  console.log(`Scope videoId: ${videoIdFilter || 'ALL'}`);
  console.log(`Missing tokens scanned: ${chineseMissingTokens.length}`);
  console.log(`Planned updates: ${planned.length}`);
  console.log(`Unresolved: ${unresolved}`);
  console.log(`source.vocabulary_id: ${bySource.vocabulary_id}`);
  console.log(
    `source.vocabulary_unique_hanzi: ${bySource.vocabulary_unique_hanzi}`,
  );
  console.log(`source.subtitle_alignment: ${bySource.subtitle_alignment}`);

  for (const row of planned.slice(0, 50)) {
    console.log(
      JSON.stringify({
        videoId: row.videoId,
        subtitleOrder: row.subtitleOrder,
        tokenPosition: row.tokenPosition,
        hanzi: row.hanzi,
        oldPinyin: row.oldPinyin,
        newPinyin: row.newPinyin,
        source: row.source,
        tokenId: row.tokenId,
      }),
    );
  }

  if (!apply) return;

  if (planned.length === 0) {
    console.log('No updates to apply.');
    return;
  }

  for (const row of planned) {
    await prisma.subtitleToken.update({
      where: { id: row.tokenId },
      data: { pinyin: row.newPinyin },
    });
  }

  console.log(`Applied updates: ${planned.length}`);
}

main()
  .catch((error) => {
    console.error('Resync failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
