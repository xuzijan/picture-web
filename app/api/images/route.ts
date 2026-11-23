import { resolveSubjectTags } from '@/lib/subject-tags';

export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { DatabaseConfigurationError, getDb, reportDatabaseFailure } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export async function GET() {
  try {
    const userId = await requireUser();
    const db = await getDb();
    const images = await db.collection('images').aggregate([
      { $sort: { createdAt: -1 } },
      { $lookup: { from: 'votes', let: { imageId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$imageId', '$$imageId'] }, { $eq: ['$userId', userId] }] } } }, { $limit: 1 }], as: 'myVote' } },
      { $project: { url: 1, name: 1, createdAt: 1, featured: 1, categoryIds: 1, subjectTagsHash: 1, vote: { $ifNull: [{ $arrayElemAt: ['$myVote.value', 0] }, null] } } },
    ]).toArray();
    // Resolve legacy records once; subsequent lists only use their stored fingerprint.
    let cursor = 0;
    const deadline = Date.now() + 35000;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (cursor < images.length) {
        const image = images[cursor++];
        if (Date.now() > deadline) { image.subjectTags = null; image.tagsLoadError = true; continue; }
        try { image.subjectTags = await resolveSubjectTags(db, image); }
        catch { image.subjectTags = null; image.tagsLoadError = true; }
      }
    }));
    return NextResponse.json(images.map((image) => ({ ...image, id: String(image._id), categoryIds: (image.categoryIds || []).map(String), _id: undefined, subjectTagsHash: undefined })));
  } catch (error) {
    if (error instanceof Response) return NextResponse.json({ error: 'Unable to load images' }, { status: error.status });
    reportDatabaseFailure(error, 'GET /api/images');
    const missingConfiguration = error instanceof DatabaseConfigurationError;
    return NextResponse.json({ error: missingConfiguration ? 'MONGODB_URI is missing from this deployment' : 'MongoDB connection failed; check the deployment logs' }, { status: 503 });
  }
}
