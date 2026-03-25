import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CHINESE_CHAR_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

function isChineseToken(hanzi: string): boolean {
  return CHINESE_CHAR_RE.test(hanzi || '');
}

function containsChineseChars(text: string): boolean {
  return CHINESE_CHAR_RE.test(text || '');
}

function normalizePinyin(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type IssueType =
  | 'missing_pinyin'
  | 'pinyin_contains_hanzi'
  | 'vocabulary_mismatch';

interface IssueRow {
  tokenId: string;
  subtitleId: string;
  videoId: string;
  subtitleOrder: number;
  tokenPosition: number;
  hanzi: string;
  tokenPinyin: string;
  subtitlePinyin: string;
  vocabularyId?: string;
  vocabularyPinyin?: string;
  issueType: IssueType;
}

async function main() {
  const take = 500;
  let cursor: { id: string } | undefined;
  let processed = 0;

  const issueCounters: Record<IssueType, number> = {
    missing_pinyin: 0,
    pinyin_contains_hanzi: 0,
    vocabulary_mismatch: 0,
  };

  const missingByVideo = new Map<string, number>();

  const issues: IssueRow[] = [];

  while (true) {
    const rows = await prisma.subtitleToken.findMany({
      take,
      skip: cursor ? 1 : 0,
      cursor,
      orderBy: { id: 'asc' },
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

    if (rows.length === 0) break;

    const vocabIds = Array.from(
      new Set(rows.map((r) => r.vocabularyId).filter(Boolean) as string[]),
    );

    const vocabMap = new Map<string, string>();
    if (vocabIds.length > 0) {
      const vocabRows = await prisma.vocabulary.findMany({
        where: { id: { in: vocabIds } },
        select: { id: true, pinyin: true },
      });
      for (const v of vocabRows) {
        vocabMap.set(v.id, v.pinyin || '');
      }
    }

    for (const row of rows) {
      processed += 1;
      const hanzi = String(row.hanzi || '');
      const tokenPinyin = String(row.pinyin || '').trim();
      const subtitlePinyin = String(row.subtitle?.pinyin || '').trim();
      const vocabularyPinyin = row.vocabularyId
        ? String(vocabMap.get(row.vocabularyId) || '').trim()
        : '';

      if (!isChineseToken(hanzi)) {
        continue;
      }

      if (!tokenPinyin) {
        issueCounters.missing_pinyin += 1;
        missingByVideo.set(
          row.subtitle.videoId,
          (missingByVideo.get(row.subtitle.videoId) || 0) + 1,
        );
        if (issues.length < 200) {
          issues.push({
            tokenId: row.id,
            subtitleId: row.subtitleId,
            videoId: row.subtitle.videoId,
            subtitleOrder: row.subtitle.sequenceOrder,
            tokenPosition: row.position,
            hanzi,
            tokenPinyin,
            subtitlePinyin,
            vocabularyId: row.vocabularyId || undefined,
            vocabularyPinyin: vocabularyPinyin || undefined,
            issueType: 'missing_pinyin',
          });
        }
      }

      if (tokenPinyin && containsChineseChars(tokenPinyin)) {
        issueCounters.pinyin_contains_hanzi += 1;
        if (issues.length < 200) {
          issues.push({
            tokenId: row.id,
            subtitleId: row.subtitleId,
            videoId: row.subtitle.videoId,
            subtitleOrder: row.subtitle.sequenceOrder,
            tokenPosition: row.position,
            hanzi,
            tokenPinyin,
            subtitlePinyin,
            vocabularyId: row.vocabularyId || undefined,
            vocabularyPinyin: vocabularyPinyin || undefined,
            issueType: 'pinyin_contains_hanzi',
          });
        }
      }

      if (tokenPinyin && vocabularyPinyin) {
        const tokenNorm = normalizePinyin(tokenPinyin);
        const vocabNorm = normalizePinyin(vocabularyPinyin);
        if (tokenNorm && vocabNorm && tokenNorm !== vocabNorm) {
          issueCounters.vocabulary_mismatch += 1;
          if (issues.length < 200) {
            issues.push({
              tokenId: row.id,
              subtitleId: row.subtitleId,
              videoId: row.subtitle.videoId,
              subtitleOrder: row.subtitle.sequenceOrder,
              tokenPosition: row.position,
              hanzi,
              tokenPinyin,
              subtitlePinyin,
              vocabularyId: row.vocabularyId || undefined,
              vocabularyPinyin,
              issueType: 'vocabulary_mismatch',
            });
          }
        }
      }
    }

    cursor = { id: rows[rows.length - 1].id };
  }

  const totalIssues =
    issueCounters.missing_pinyin +
    issueCounters.pinyin_contains_hanzi +
    issueCounters.vocabulary_mismatch;

  console.log('=== Subtitle Pinyin Audit (READ-ONLY) ===');
  console.log(`Processed tokens: ${processed}`);
  console.log(`missing_pinyin: ${issueCounters.missing_pinyin}`);
  console.log(`pinyin_contains_hanzi: ${issueCounters.pinyin_contains_hanzi}`);
  console.log(`vocabulary_mismatch: ${issueCounters.vocabulary_mismatch}`);
  console.log(`total_issues: ${totalIssues}`);

  const topMissingVideos = Array.from(missingByVideo.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  if (topMissingVideos.length > 0) {
    console.log('--- Top videos with missing pinyin ---');
    for (const [videoId, count] of topMissingVideos) {
      console.log(`${videoId}: ${count}`);
    }
  }

  if (issues.length > 0) {
    console.log('--- Sample issues (max 200) ---');
    for (const issue of issues.slice(0, 50)) {
      console.log(
        JSON.stringify({
          issueType: issue.issueType,
          videoId: issue.videoId,
          subtitleOrder: issue.subtitleOrder,
          tokenPosition: issue.tokenPosition,
          hanzi: issue.hanzi,
          tokenPinyin: issue.tokenPinyin,
          vocabularyPinyin: issue.vocabularyPinyin,
          subtitleId: issue.subtitleId,
          tokenId: issue.tokenId,
        }),
      );
    }
  }
}

main()
  .catch((error) => {
    console.error('Audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
