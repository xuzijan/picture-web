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
      { $project: { url: 1, name: 1, createdAt: 1, featured: 1, categoryIds: 1, vote: { $ifNull: [{ $arrayElemAt: ['$myVote.value', 0] }, null] } } },
    ]).toArray();
    return NextResponse.json(images.map((image) => ({ ...image, id: String(image._id), categoryIds: (image.categoryIds || []).map(String), _id: undefined })));
  } catch (error) {
    if (error instanceof Response) return NextResponse.json({ error: 'Unable to load images' }, { status: error.status });
    reportDatabaseFailure(error, 'GET /api/images');
    const missingConfiguration = error instanceof DatabaseConfigurationError;
    return NextResponse.json({ error: missingConfiguration ? 'MONGODB_URI is missing from this deployment' : 'MongoDB connection failed; check the deployment logs' }, { status: 503 });
  }
}
