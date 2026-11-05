import { ObjectId } from 'mongodb';
import JSZip from 'jszip';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

function safeFilename(name: string, fallback: string) {
  const cleaned = name.replace(/[\\/:*?"<>|\r\n]+/g, '_').trim();
  return cleaned || fallback;
}

function attachmentHeader(filename: string) {
  return `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const rawIds = searchParams.getAll('id').flatMap((value) => value.split(','));
    const ids = Array.from(new Set(rawIds.filter(Boolean)));
    if (!ids.length) return NextResponse.json({ error: 'No images selected' }, { status: 400 });
    if (ids.length > 100) return NextResponse.json({ error: 'You can download up to 100 images at a time' }, { status: 400 });
    if (!ids.every((id) => ObjectId.isValid(id))) return NextResponse.json({ error: 'Invalid image id' }, { status: 400 });

    const db = await getDb();
    const records = await db.collection<{ _id: ObjectId; url: string; name: string }>('images')
      .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: { url: 1, name: 1 } })
      .toArray();
    if (records.length !== ids.length) return NextResponse.json({ error: 'One or more images were not found' }, { status: 404 });

    if (records.length === 1) {
      const record = records[0];
      const image = await fetch(record.url, { cache: 'no-store' });
      if (!image.ok) return NextResponse.json({ error: 'Unable to download image' }, { status: 502 });
      const body = new Uint8Array(await image.arrayBuffer());
      return new NextResponse(body, {
        headers: {
          'Content-Type': image.headers.get('content-type') || 'application/octet-stream',
          'Content-Disposition': attachmentHeader(safeFilename(record.name, 'image')),
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const zip = new JSZip();
    for (const record of records) {
      const image = await fetch(record.url, { cache: 'no-store' });
      if (!image.ok) return NextResponse.json({ error: `Unable to download ${record.name}` }, { status: 502 });
      zip.file(safeFilename(record.name, `image-${String(record._id)}`), Buffer.from(await image.arrayBuffer()));
    }
    const body = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': attachmentHeader('frameflow-images.zip'),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const status = error instanceof Response ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? 'Database is not configured' : 'Unable to download images' }, { status });
  }
}
