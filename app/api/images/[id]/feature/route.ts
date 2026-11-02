import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { featured } = await request.json() as { featured: boolean };
    const db = await getDb();
    await db.collection('images').updateOne({ _id: new ObjectId(id) }, { $set: { featured: Boolean(featured) } });
    return NextResponse.json({ featured: Boolean(featured) });
  } catch (error) {
    const status = error instanceof Response ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? 'Database is not configured' : 'Unable to update image' }, { status });
  }
}
