import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export async function GET() {
  try {
    const userId = await requireUser();
    const db = await getDb();
    const images = await db.collection('images').aggregate([
      { $sort: { createdAt: -1 } },
      { $lookup: { from: 'votes', let: { imageId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$imageId', '$$imageId'] }, { $eq: ['$userId', userId] }] } } }, { $limit: 1 }], as: 'myVote' } },
      { $project: { url: 1, name: 1, createdAt: 1, featured: 1, vote: { $ifNull: [{ $arrayElemAt: ['$myVote.value', 0] }, null] } } },
    ]).toArray();
    return NextResponse.json(images.map((image) => ({ ...image, id: String(image._id), _id: undefined })));
  } catch (error) {
    const status = error instanceof Response ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? 'Database is not configured' : 'Unable to load images' }, { status });
  }
}
