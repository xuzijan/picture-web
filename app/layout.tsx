import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Frameflow — 图片筛选台',
  description: '团队图片灵感与筛选工作台',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
