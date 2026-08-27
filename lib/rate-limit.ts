import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isProduction, isRedisConfigured } from "@/lib/config";

const memoryBuckets = new Map<string, number[]>();

function prune(timestamps: number[], windowMs: number, now: number) {
  return timestamps.filter((stamp) => now - stamp < windowMs);
}

function memoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const next = prune(memoryBuckets.get(key) ?? [], windowMs, now);
  if (next.length >= limit) {
    memoryBuckets.set(key, next);
    return false;
  }
  next.push(now);
  memoryBuckets.set(key, next);
  return true;
}

let redisLimiters: Map<string, Ratelimit> | null = null;

function redisLimiter(name: string, limit: number, windowSec: number): Ratelimit {
  if (!redisLimiters) {
    redisLimiters = new Map();
  }
  const cached = redisLimiters.get(name);
  if (cached) {
    return cached;
  }
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix: `temvagas:${name}`,
  });
  redisLimiters.set(name, limiter);
  return limiter;
}

export async function rateLimit(input: {
  name: string;
  key: string;
  limit: number;
  windowSec: number;
}): Promise<boolean> {
  const identity = `${input.name}:${input.key}`;
  if (isRedisConfigured()) {
    const result = await redisLimiter(input.name, input.limit, input.windowSec).limit(identity);
    return result.success;
  }

  if (isProduction()) {
    console.warn("[rate-limit] Upstash Redis não configurado; a usar memória do processo (ineficaz com várias instâncias).");
  }

  return memoryLimit(identity, input.limit, input.windowSec * 1000);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? "unknown";
}
