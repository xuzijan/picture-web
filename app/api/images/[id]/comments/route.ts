import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requireUser();
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid image id' }, { status: 400 });
    const db = await getDb();
    const comments = await db.collection('comments').find({ imageId: new ObjectId(id) }).sort({ createdAt: 1 }).limit(200).toArray();
    return NextResponse.json(comments.map(({ _id, imageId, ...comment }) => ({ ...comment, id: String(_id) })));
  } catch (error) {
    const status = error instanceof Response ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? 'Database is not configured' : 'Unable to load comments' }, { status });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const userId = await requireUser();
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid image id' }, { status: 400 });
    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 1000) return NextResponse.json({ error: 'Comment must be between 1 and 1000 characters' }, { status: 400 });

    const db = await getDb();
    const imageId = new ObjectId(id);
    const exists = await db.collection('images').findOne({ _id: imageId }, { projection: { _id: 1 } });
    if (!exists) return NextResponse.json({ error: 'Image not found' }, { status: 404 });

    const comment = { imageId, userId, text, createdAt: new Date() };
    const result = await db.collection('comments').insertOne(comment);
    return NextResponse.json({ ...comment, id: String(result.insertedId) }, { status: 201 });
  } catch (error) {
    const status = error instanceof Response ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? 'Database is not configured' : 'Unable to save comment' }, { status });
  }
}
