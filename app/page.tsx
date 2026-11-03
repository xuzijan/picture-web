'use client';

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

type Vote = 'up' | 'down' | null;
type GalleryImage = {
  id: string;
  src: string;
  name: string;
  createdAt: number;
  featured: boolean;
  vote: Vote;
};

const STORE_KEY = 'frameflow-gallery-v1';
const makeSvg = (a: string, b: string, label: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><circle cx="625" cy="230" r="180" fill="white" opacity=".13"/><circle cx="185" cy="820" r="260" fill="white" opacity=".09"/><text x="58" y="900" fill="white" font-family="Arial" font-size="34" font-weight="700" letter-spacing="5">${label}</text></svg>`)}`;

const starterImages: GalleryImage[] = [
  ['#e27752', '#6639bd', 'SUNSET / 01'],
  ['#255b66', '#d6a34c', 'TIDELINE / 02'],
  ['#151a39', '#d04975', 'NIGHT BLOOM / 03'],
  ['#dfa75b', '#3e6fa3', 'SOFT LIGHT / 04'],
  ['#4d9c84', '#1a2b4e', 'GARDEN / 05'],
  ['#b85d87', '#f2cb76', 'PALETTE / 06'],
  ['#263b5d', '#9f5bc5', 'ECHO / 07'],
  ['#d57554', '#2d6671', 'AFTERGLOW / 08'],
].map(([a, b, label], index) => ({
  id: `starter-${index}`,
  src: makeSvg(a, b, label),
  name: `concept-${String(index + 1).padStart(2, '0')}.svg`,
  createdAt: Date.now() - index * 1000 * 60 * 23,
  featured: index === 1 || index === 5,
  vote: null,
}));

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const [images, setImages] = useState<GalleryImage[]>(starterImages);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<GalleryImage | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'featured'>('all');
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const session = await fetch('/api/session').then((response) => response.ok ? response.json() : null);
        if (cancelled) return;
        if (session?.authenticated) {
          setAuthenticated(true);
          setIsAdmin(Boolean(session.admin));
          const response = await fetch('/api/images');
          if (response.ok) {
            const remote = await response.json();
            setImages(remote.map((image: { id: string; url: string; name: string; createdAt: string; featured: boolean; vote: Vote }) => ({ ...image, src: image.url, createdAt: new Date(image.createdAt).getTime() })));
            setConnected(true);
            setReady(true);
            return;
          }
        }
      } catch { /* fall back to local preview */ }
      try {
        const saved = window.localStorage.getItem(STORE_KEY);
        if (saved) setImages(JSON.parse(saved));
      } catch { /* use starter data when local storage is unavailable */ }
      if (!cancelled) setReady(true);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (ready && !connected) window.localStorage.setItem(STORE_KEY, JSON.stringify(images));
  }, [images, ready, connected]);

  const visibleImages = useMemo(
    () => images.filter((image) => activeFilter === 'all' || image.featured).sort((a, b) => b.createdAt - a.createdAt),
    [images, activeFilter],
  );

  const addFiles = (files: FileList | File[]) => {
    const accepted = Array.from(files).filter((file) => file.type.startsWith('image/'));
    setPendingFiles((current) => [...current, ...accepted]);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const publishFiles = async () => {
    if (connected) {
      setBusy(true);
      setNotice('正在上传…');
      try {
        const formData = new FormData();
        pendingFiles.forEach((file) => formData.append('files', file));
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('upload failed');
        const result = await fetch('/api/images');
        const remote = await result.json();
        setImages(remote.map((image: { id: string; url: string; name: string; createdAt: string; featured: boolean; vote: Vote }) => ({ ...image, src: image.url, createdAt: new Date(image.createdAt).getTime() })));
        setPendingFiles([]);
        setUploadOpen(false);
        setNotice('上传完成');
      } catch { setNotice('上传失败，请检查存储配置'); }
      finally { setBusy(false); }
      return;
    }
    const additions = await Promise.all(pendingFiles.map(async (file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      src: await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }),
      name: file.name,
      createdAt: Date.now() + index,
      featured: false,
      vote: null as Vote,
    })));
    setImages((current) => [...additions, ...current]);
    setPendingFiles([]);
    setUploadOpen(false);
  };

  const updateVote = (id: string, vote: Exclude<Vote, null>) => {
    const nextVote = images.find((image) => image.id === id)?.vote === vote ? null : vote;
    setImages((current) => current.map((image) => image.id === id ? { ...image, vote: nextVote } : image));
    setSelected((current) => current && current.id === id ? { ...current, vote: nextVote } : current);
    if (connected) fetch(`/api/images/${id}/vote`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: nextVote }) }).catch(() => setNotice('投票保存失败'));
  };

  const toggleFeatured = (id: string) => {
    const nextFeatured = !images.find((image) => image.id === id)?.featured;
    setImages((current) => current.map((image) => image.id === id ? { ...image, featured: nextFeatured } : image));
    if (connected) fetch(`/api/images/${id}/feature`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: nextFeatured }) }).catch(() => setNotice('精选状态保存失败'));
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = '';
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="top-spacer" />
        <div className="top-actions">{hasClerk ? <><SignedOut><SignInButton mode="modal"><button className="button ghost">登录</button></SignInButton></SignedOut><SignedIn><UserButton /></SignedIn></> : <span className="user-pill"><span className="avatar">Z</span><span className="desktop-only">本地用户</span><span className="online-dot" /></span>}<span className="mode-label">{connected ? (isAdmin ? '管理员' : '在线') : '本地预览'}</span>{(!connected || (authenticated && isAdmin)) && <button className="button primary" onClick={() => setUploadOpen(true)}><Icon>＋</Icon>上传图片</button>}</div>
      </header>

      <section className="toolbar" id="gallery">
        <div className="filter-tabs"><button className={activeFilter === 'all' ? 'tab active' : 'tab'} onClick={() => setActiveFilter('all')}>全部图片 <b>{images.length}</b></button><button className={activeFilter === 'featured' ? 'tab active' : 'tab'} onClick={() => setActiveFilter('featured')}>精选 <b>{images.filter((image) => image.featured).length}</b></button></div>
        <div className="sort-label"><Icon>↕</Icon> 最新上传</div>
      </section>

      <section className="masonry" aria-label="图片瀑布流">
        {visibleImages.map((image, index) => <article className={`image-card card-${index % 5}`} key={image.id}>
          <button className="image-button" onClick={() => setSelected(image)} aria-label={`放大查看 ${image.name}`}><img src={image.src} alt={image.name} /></button>
          <div className="card-overlay"><p className="image-name">{image.name}</p><button className={image.featured ? 'feature active' : 'feature'} onClick={() => toggleFeatured(image.id)} aria-label="切换精选">{image.featured ? '★' : '☆'}</button></div>
          <div className="vote-row"><span className="vote-label">你的判断</span><div className="vote-buttons"><button className={image.vote === 'up' ? 'vote selected-up' : 'vote'} onClick={() => updateVote(image.id, 'up')}><Icon>✓</Icon>认可</button><button className={image.vote === 'down' ? 'vote selected-down' : 'vote'} onClick={() => updateVote(image.id, 'down')}><Icon>×</Icon>不认可</button></div></div>
        </article>)}
      </section>

      <footer><span><span className="footer-dot" />{connected ? '已连接云端' : '本地演示模式'}</span><span>{notice || (connected ? '图片保存到云端' : '图片只保存在当前浏览器')}</span></footer>

      {isUploadOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setUploadOpen(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title"><div className="modal-head"><div><p className="eyebrow">ADMIN / ADD ASSETS</p><h2 id="upload-title">上传图片</h2></div><button className="close" onClick={() => setUploadOpen(false)}>×</button></div><div className={dragging ? 'dropzone dragging' : 'dropzone'} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()}><input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handleInput} /><span className="upload-icon">↑</span><strong>拖拽图片到这里</strong><span>或点击选择，可一次上传多张</span><small>PNG、JPG、WEBP · 建议单张不超过 10MB</small></div>{pendingFiles.length > 0 && <div className="pending"><div className="pending-title"><span>待上传 {pendingFiles.length} 张</span><button onClick={() => setPendingFiles([])}>清空</button></div><div className="pending-list">{pendingFiles.map((file, index) => <div className="pending-item" key={`${file.name}-${index}`}><span>{file.name}</span><button onClick={() => setPendingFiles((current) => current.filter((_, i) => i !== index))}>×</button></div>)}</div></div>}<div className="modal-actions"><button className="button ghost" onClick={() => setUploadOpen(false)}>取消</button><button className="button primary" disabled={!pendingFiles.length || busy} onClick={publishFiles}>{busy ? '上传中…' : '发布到画廊'} <Icon>→</Icon></button></div></div></div>}

      {selected && <div className="lightbox" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><button className="lightbox-close" onClick={() => setSelected(null)}>×</button><div className="lightbox-content"><img src={selected.src} alt={selected.name} /><div className="lightbox-info"><h2>{selected.name}</h2><div className="lightbox-votes"><button className={selected.vote === 'up' ? 'vote selected-up' : 'vote'} onClick={() => updateVote(selected.id, 'up')}><Icon>✓</Icon>认可</button><button className={selected.vote === 'down' ? 'vote selected-down' : 'vote'} onClick={() => updateVote(selected.id, 'down')}><Icon>×</Icon>不认可</button></div></div></div></div>}
    </main>
  );
}

