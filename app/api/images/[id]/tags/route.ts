import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import manifest from '@/lib/latest-batch-tags.json';

export const runtime = 'nodejs';
type Tags = { sampleId: string; mainSubject: string; secondarySubjects: string[] };
const tagsByHash: Record<string, Tags> = manifest;
const cache = new Map<string, Tags | null>();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid image id' }, { status: 400 });
    const db = await getDb();
    const image = await db.collection('images').findOne({ _id: new ObjectId(id) });
    if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    if (typeof image.subjectTagsHash === 'string') return NextResponse.json(tagsByHash[image.subjectTagsHash] ?? null);
    const url = new URL(image.url);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.public.blob.vercel-storage.com')) {
      return NextResponse.json(null);
    }
    if (cache.has(url.href)) return NextResponse.json(cache.get(url.href));
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) throw new Error('Image download failed');
    const hash = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
    const tags = tagsByHash[hash] ?? null;
    await db.collection('images').updateOne({ _id: image._id, url: image.url }, { $set: { subjectTagsHash: hash } });
    if (cache.size >= 1000) cache.clear();
    cache.set(url.href, tags);
    return NextResponse.json(tags);
  } catch (error) {
    return NextResponse.json({ error: 'Unable to load tags' }, { status: error instanceof Response ? error.status : 503 });
  }
}
