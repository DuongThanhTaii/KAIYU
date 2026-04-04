import 'dotenv/config';
import { performance } from 'node:perf_hooks';

type BenchOptions = {
  url: string;
  requests: number;
  concurrency: number;
  thresholdMs: number;
};

type BenchResult = {
  status: number;
  durationMs: number;
};

function parsePositiveInt(input: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(input ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[index];
}

async function requestOnce(url: string): Promise<BenchResult> {
  const start = performance.now();
  const response = await fetch(url);
  const end = performance.now();

  return {
    status: response.status,
    durationMs: end - start,
  };
}

async function runBenchmark(options: BenchOptions): Promise<void> {
  const durations: number[] = [];
  let failed = 0;

  console.log('Starting API benchmark...');
  console.log(`URL: ${options.url}`);
  console.log(`Total requests: ${options.requests}`);
  console.log(`Concurrency: ${options.concurrency}`);
  console.log(`Threshold: < ${options.thresholdMs} ms`);

  for (let i = 0; i < options.requests; i += options.concurrency) {
    const batchSize = Math.min(options.concurrency, options.requests - i);
    const batch = Array.from({ length: batchSize }, () =>
      requestOnce(options.url),
    );
    const results = await Promise.allSettled(batch);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        durations.push(result.value.durationMs);
        if (result.value.status >= 400) {
          failed += 1;
        }
      } else {
        failed += 1;
      }
    }
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const avg =
    sorted.reduce((sum, item) => sum + item, 0) / Math.max(sorted.length, 1);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;

  console.log('--- Benchmark Result ---');
  console.log(`Successful samples: ${sorted.length}`);
  console.log(`Failed requests: ${failed}`);
  console.log(`Min: ${min.toFixed(2)} ms`);
  console.log(`Avg: ${avg.toFixed(2)} ms`);
  console.log(`P95: ${p95.toFixed(2)} ms`);
  console.log(`P99: ${p99.toFixed(2)} ms`);
  console.log(`Max: ${max.toFixed(2)} ms`);

  if (failed > 0) {
    process.exitCode = 1;
    console.error('Benchmark failed because there were failed requests.');
    return;
  }

  if (p95 >= options.thresholdMs) {
    process.exitCode = 1;
    console.error(
      `Benchmark failed: P95 ${p95.toFixed(2)} ms is not below ${options.thresholdMs} ms.`,
    );
    return;
  }

  console.log(
    `Benchmark passed: P95 ${p95.toFixed(2)} ms < ${options.thresholdMs} ms.`,
  );
}

const options: BenchOptions = {
  url: process.env.BENCH_URL ?? 'http://localhost:3000/api',
  requests: parsePositiveInt(process.env.BENCH_REQUESTS, 100),
  concurrency: parsePositiveInt(process.env.BENCH_CONCURRENCY, 20),
  thresholdMs: parsePositiveInt(process.env.BENCH_THRESHOLD_MS, 5000),
};

void runBenchmark(options);
