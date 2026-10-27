import { createHash } from "node:crypto";
import type { IJob } from "../models/Job";
import type { ICareerSkillProfile } from "./careerSkillProfileService";
import type { IJobMatchOptions, IJobMatchResult } from "./jobMatchingService";

const MAX_ENTRIES = 2048;
const MAX_BYTES = 8 * 1024 * 1024;
const TTL_MS = 60_000;
const cache = new Map<string, { value: IJobMatchResult; bytes: number; expires: number }>();
let bytes = 0;
let hits = 0;
let misses = 0;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function remove(key: string) {
  const entry = cache.get(key);
  if (entry) bytes -= entry.bytes;
  cache.delete(key);
}

/** Fresh source content, rather than TTL alone, determines score validity. */
export function createVersionedJobMatcher(
  profile: ICareerSkillProfile,
  options: IJobMatchOptions,
  calculate: (profile: ICareerSkillProfile, job: IJob, options: IJobMatchOptions) => IJobMatchResult,
) {
  const { generatedAt: _generatedAt, ...evidence } = profile;
  const profileVersion = hash({ evidence, options });
  return (job: IJob): IJobMatchResult => {
    // These are every job field consumed by the existing matching algorithm.
    const key = `${profileVersion}:${hash({ id: String(job._id), title: job.title, skills: job.skills, keywords: job.keywords, experienceLevel: job.experienceLevel })}`;
    const entry = cache.get(key);
    if (profile.userId && entry && entry.expires > Date.now()) {
      hits++;
      cache.delete(key);
      cache.set(key, entry);
      return structuredClone(entry.value);
    }
    remove(key);
    misses++;
    const value = calculate(profile, job, options);
    if (!profile.userId) return value;
    const size = Buffer.byteLength(JSON.stringify(value)) + key.length * 2;
    if (size <= MAX_BYTES) {
      while (cache.size >= MAX_ENTRIES || bytes + size > MAX_BYTES) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        remove(oldest);
      }
      cache.set(key, { value: structuredClone(value), bytes: size, expires: Date.now() + TTL_MS });
      bytes += size;
    }
    return value;
  };
}

export function clearJobMatchCache() { cache.clear(); bytes = 0; hits = 0; misses = 0; }
export const getJobMatchCacheStats = () => ({ entries: cache.size, bytes, hits, misses, maxEntries: MAX_ENTRIES, maxBytes: MAX_BYTES });
