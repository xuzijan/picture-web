import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Frameflow — 图片筛选台',
  description: '团队图片灵感与筛选工作台',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <html lang="zh-CN">
      <body>{clerkKey ? <ClerkProvider publishableKey={clerkKey}>{children}</ClerkProvider> : children}</body>
    </html>
  );
}
