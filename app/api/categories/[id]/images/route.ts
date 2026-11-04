import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    await requireUser();
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid category id' }, { status: 400 });
    const body = await request.json();
    if (!Array.isArray(body.imageIds) || body.imageIds.length > 500 || !body.imageIds.every((value: unknown) => typeof value === 'string' && ObjectId.isValid(value))) {
      return NextResponse.json({ error: 'Invalid image ids' }, { status: 400 });
    }
    const imageIds = Array.from(new Set(body.imageIds as string[])).map((value) => new ObjectId(value));
    const categoryId = new ObjectId(id);
    const db = await getDb();
    const category = await db.collection('categories').findOne({ _id: categoryId }, { projection: { _id: 1 } });
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    if (imageIds.length) {
      const images = db.collection<{ _id: ObjectId; categoryIds?: ObjectId[] }>('images');
      if (body.action === 'remove') {
        await images.updateMany({ _id: { $in: imageIds } }, { $pull: { categoryIds: categoryId } });
      } else if (body.action === 'add') {
        await images.updateMany({ _id: { $in: imageIds } }, { $addToSet: { categoryIds: categoryId } });
      } else {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }
    }
    return NextResponse.json({ updated: imageIds.length });
  } catch (error) {
    const status = error instanceof Response ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? 'Database is not configured' : 'Unable to update category images' }, { status });
  }
}
