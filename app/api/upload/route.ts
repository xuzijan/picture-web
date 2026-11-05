import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN is not configured' }, { status: 503 });
    const formData = await request.formData();
    const files = formData.getAll('files').filter((value): value is File => value instanceof File);
    if (!files.length) return NextResponse.json({ error: 'No image files provided' }, { status: 400 });
    const db = await getDb();
    const records = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const blob = await put(`gallery/${crypto.randomUUID()}-${file.name}`, file, { access: 'public' });
      const record = { url: blob.url, pathname: blob.pathname, name: file.name, createdAt: new Date(), featured: false, uploadedBy: userId };
      const inserted = await db.collection('images').insertOne(record);
      records.push({ ...record, id: String(inserted.insertedId) });
    }
    return NextResponse.json({ images: records }, { status: 201 });
  } catch (error) {
    const status = error instanceof Response ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? 'Upload services are not configured' : 'Unable to upload images' }, { status });
  }
}
