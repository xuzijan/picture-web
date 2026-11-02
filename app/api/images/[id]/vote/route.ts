import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser();
    const { id } = await params;
    const { value } = await request.json() as { value: 'up' | 'down' | null };
    if (!['up', 'down', null].includes(value)) return NextResponse.json({ error: 'Invalid vote' }, { status: 400 });
    const db = await getDb();
    if (value === null) await db.collection('votes').deleteOne({ imageId: new ObjectId(id), userId });
    else await db.collection('votes').updateOne({ imageId: new ObjectId(id), userId }, { $set: { imageId: new ObjectId(id), userId, value, updatedAt: new Date() } }, { upsert: true });
    return NextResponse.json({ value });
  } catch (error) {
    const status = error instanceof Response ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? 'Database is not configured' : 'Unable to save vote' }, { status });
  }
}
