import { createHash } from 'node:crypto';
import type { Db, Document } from 'mongodb';
import manifest from './latest-batch-tags.json';

export type SubjectTags = { sampleId: string; mainSubject: string; secondarySubjects: string[] };
const tagsByHash: Record<string, SubjectTags> = manifest;
export const tagsForHash = (hash: string): SubjectTags | null => tagsByHash[hash] ?? null;
export const hashImage = (bytes: ArrayBuffer) => createHash('sha256').update(Buffer.from(bytes)).digest('hex');

export async function resolveSubjectTags(db: Db, image: Document): Promise<SubjectTags | null> {
  if (typeof image.subjectTagsHash === 'string') return tagsForHash(image.subjectTagsHash);
  const url = new URL(image.url);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.public.blob.vercel-storage.com')) return null;
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!response.ok) throw new Error('Image download failed');
  const hash = hashImage(await response.arrayBuffer());
  await db.collection('images').updateOne({ _id: image._id, url: image.url }, { $set: { subjectTagsHash: hash } });
  return tagsForHash(hash);
}
