import { auth } from '@clerk/nextjs/server';

export async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new Response('Authentication required', { status: 401 });
  return userId;
}

export function isAdmin(userId: string) {
  const allowed = (process.env.ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  return allowed.length > 0 && allowed.includes(userId);
}

export async function requireAdmin() {
  const userId = await requireUser();
  if (!isAdmin(userId)) throw new Response('Admin access required', { status: 403 });
  return userId;
}
