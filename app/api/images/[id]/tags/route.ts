import { resolveSubjectTags } from '@/lib/subject-tags';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid image id' }, { status: 400 });
    const db = await getDb();
    const image = await db.collection('images').findOne({ _id: new ObjectId(id) });
    if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    return NextResponse.json(await resolveSubjectTags(db, image));
  } catch (error) {
    return NextResponse.json({ error: 'Unable to load tags' }, { status: error instanceof Response ? error.status : 503 });
  }
}
