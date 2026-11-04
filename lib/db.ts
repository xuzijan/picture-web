import { MongoClient, Db } from 'mongodb';

const globalForMongo = globalThis as unknown as { mongoClient?: MongoClient };

export class DatabaseConfigurationError extends Error {
  constructor() {
    super('MONGODB_URI is not configured');
    this.name = 'DatabaseConfigurationError';
  }
}

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new DatabaseConfigurationError();
  let client = globalForMongo.mongoClient;
  if (!client) {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    globalForMongo.mongoClient = client;
  }
  await client.connect();
  return client.db(process.env.MONGODB_DB || 'frameflow');
}

export function reportDatabaseFailure(error: unknown, operation: string) {
  const source = error instanceof Error ? error : new Error(String(error));
  const candidate = source as Error & { code?: string | number; codeName?: string; cause?: unknown };
  const cause = candidate.cause instanceof Error ? candidate.cause as Error & { code?: string | number; codeName?: string } : undefined;
  const message = source.message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, '[REDACTED_MONGODB_URI]')
    .replace(/vercel_blob_[A-Za-z0-9_-]+/g, '[REDACTED_BLOB_TOKEN]');
  console.error('[database]', JSON.stringify({
    operation,
    name: source.name,
    code: candidate.code,
    codeName: candidate.codeName,
    causeName: cause?.name,
    causeCode: cause?.code,
    causeCodeName: cause?.codeName,
    message,
  }));
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
