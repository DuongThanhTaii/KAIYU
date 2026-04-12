import {
  levelFitScore,
  knownWordFitScore,
  freshnessScore,
  reviewNeedScore,
} from './recommendation.service';

describe('Recommendation scoring helpers', () => {
  it('should decrease level score as level delta increases', () => {
    expect(levelFitScore(0)).toBeGreaterThan(levelFitScore(1));
    expect(levelFitScore(1)).toBeGreaterThan(levelFitScore(2));
    expect(levelFitScore(2)).toBeGreaterThan(levelFitScore(3));
  });

  it('should peak known word fit score around 85%', () => {
    const score85 = knownWordFitScore(0.85);
    const score65 = knownWordFitScore(0.65);
    const score98 = knownWordFitScore(0.98);

    expect(score85).toBeGreaterThan(score65);
    expect(score85).toBeGreaterThan(score98);
  });

  it('should apply freshness penalty for recently watched videos', () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    expect(freshnessScore(twoHoursAgo)).toBeLessThan(
      freshnessScore(fiveDaysAgo),
    );
  });

  it('should prioritize review for in-progress videos', () => {
    const now = new Date();
    expect(reviewNeedScore(50, now)).toBeGreaterThan(reviewNeedScore(0, now));
  });
});
