import { ObjectId } from 'mongodb';
import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid image id' }, { status: 400 });

    const imageId = new ObjectId(id);
    const db = await getDb();
    const image = await db.collection<{ url?: string; pathname?: string }>('images').findOne({ _id: imageId });
    if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });

    if (process.env.BLOB_READ_WRITE_TOKEN && (image.pathname || image.url)) {
      try { await del(image.pathname || image.url || ''); } catch (error) { console.error('[storage] unable to delete blob', error); }
    }
    await Promise.all([
      db.collection('images').deleteOne({ _id: imageId }),
      db.collection('votes').deleteMany({ imageId }),
      db.collection('comments').deleteMany({ imageId }),
    ]);
    return NextResponse.json({ deleted: id });
  } catch (error) {
    const status = error instanceof Response ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? 'Database is not configured' : 'Unable to delete image' }, { status });
  }
}
