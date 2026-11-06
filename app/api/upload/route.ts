import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN is not configured' }, { status: 503 });
    const formData = await request.formData();
    const files = formData.getAll('files').filter((value): value is File => value instanceof File);
    if (!files.length) return NextResponse.json({ error: 'No image files provided' }, { status: 400 });
    const db = await getDb();
    const validFiles = files.filter((file) => file.type.startsWith('image/'));
    const uploaded = await Promise.all(validFiles.map(async (file) => {
      const blob = await put(`gallery/${crypto.randomUUID()}-${file.name}`, file, { access: 'public' });
      return { url: blob.url, pathname: blob.pathname, name: file.name, createdAt: new Date(), featured: false, uploadedBy: userId };
    }));
    const insertedIds: Record<number, string> = uploaded.length
      ? Object.fromEntries(Object.entries((await db.collection('images').insertMany(uploaded)).insertedIds).map(([index, id]) => [Number(index), String(id)]))
      : {};
    const records = uploaded.map((record, index) => ({ ...record, id: insertedIds[index] }));
    return NextResponse.json({ images: records }, { status: 201 });
  } catch (error) {
    const status = error instanceof Response ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? 'Upload services are not configured' : 'Unable to upload images' }, { status });
  }
}
