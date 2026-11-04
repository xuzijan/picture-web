import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    await requireUser();
    const db = await getDb();
    const [categories, counts] = await Promise.all([
      db.collection('categories').find({}).sort({ createdAt: 1 }).toArray(),
      db.collection('images').aggregate([
        { $unwind: '$categoryIds' },
        { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
      ]).toArray(),
    ]);
    const countById = new Map(counts.map((entry) => [String(entry._id), entry.count]));
    return NextResponse.json(categories.map(({ _id, name }) => ({ id: String(_id), name, count: countById.get(String(_id)) || 0 })));
  } catch (error) {
    const status = error instanceof Response ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? 'Database is not configured' : 'Unable to load categories' }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 40) return NextResponse.json({ error: 'Category name must be between 1 and 40 characters' }, { status: 400 });

    const db = await getDb();
    const categories = db.collection('categories');
    await categories.createIndex({ normalizedName: 1 }, { unique: true });
    const normalizedName = name.toLocaleLowerCase();
    const existing = await categories.findOne({ normalizedName });
    if (existing) return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    const category = { name, normalizedName, createdAt: new Date(), createdBy: userId };
    const result = await categories.insertOne(category);
    return NextResponse.json({ id: String(result.insertedId), name, count: 0 }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    }
    const status = error instanceof Response ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? 'Database is not configured' : 'Unable to create category' }, { status });
  }
}
