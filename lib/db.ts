import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI;
const globalForMongo = globalThis as unknown as { mongoClient?: MongoClient };

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error('MONGODB_URI is not configured');
  const client = globalForMongo.mongoClient ?? new MongoClient(uri);
  if (!globalForMongo.mongoClient) globalForMongo.mongoClient = client;
  await client.connect();
  return client.db(process.env.MONGODB_DB || 'frameflow');
}

export type ImageRecord = {
  _id?: string;
  url: string;
  pathname: string;
  name: string;
  createdAt: Date;
  featured: boolean;
  uploadedBy: string;
};
