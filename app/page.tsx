'use client';

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Show, SignInButton, UserButton } from '@clerk/nextjs';

type Vote = 'up' | 'down' | null;
type GalleryComment = { id: string; userId: string; text: string; createdAt: string };
type GalleryCategory = { id: string; name: string; count: number };
type GalleryImage = {
  id: string;
  src: string;
  name: string;
  createdAt: number;
  featured: boolean;
  vote: Vote;
  comments?: GalleryComment[];
  categoryIds?: string[];
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
  const [categories, setCategories] = useState<GalleryCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [selectingImages, setSelectingImages] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [downloadMode, setDownloadMode] = useState(false);
  const [downloadSelectedIds, setDownloadSelectedIds] = useState<string[]>([]);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
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
            const categoryResponse = await fetch('/api/categories');
            if (categoryResponse.ok) setCategories(await categoryResponse.json());
            setConnected(true);
            setReady(true);
            return;
          }
          const failure = await response.json().catch(() => null);
          setImages([]);
          setNotice(failure?.error || '云端图片读取失败');
          setReady(true);
          return;
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
    () => images
      .filter((image) => activeFilter === 'all' || image.featured)
      .filter((image) => selectingImages || !activeCategoryId || image.categoryIds?.includes(activeCategoryId))
      .filter((image) => image.name.toLocaleLowerCase().includes(searchTerm.trim().toLocaleLowerCase()))
      .sort((a, b) => b.createdAt - a.createdAt),
    [images, activeFilter, activeCategoryId, selectingImages, searchTerm],
  );

  const toggleImageSelection = (id: string) => {
    setSelectedImageIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const createCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name || categoryBusy) return;
    setCategoryBusy(true);
    try {
      let category: GalleryCategory;
      if (connected) {
        const response = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '创建分类失败');
        category = result;
      } else {
        category = { id: `local-${Date.now()}`, name, count: 0 };
      }
      setCategories((current) => [...current, category]);
      setCategoryName('');
      setCategoryModalOpen(false);
      setActiveFilter('all');
      setActiveCategoryId(category.id);
      setSelectedImageIds([]);
      setSelectingImages(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '创建分类失败');
    } finally { setCategoryBusy(false); }
  };

  const assignSelectedImages = async (action: 'add' | 'remove') => {
    if (!activeCategoryId || !selectedImageIds.length || categoryBusy) return;
    setCategoryBusy(true);
    try {
      if (connected) {
        const response = await fetch(`/api/categories/${activeCategoryId}/images`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageIds: selectedImageIds, action }),
        });
        if (!response.ok) throw new Error('更新分类失败');
      }
      const changedCount = selectedImageIds.filter((id) => action === 'add'
        ? !images.find((image) => image.id === id)?.categoryIds?.includes(activeCategoryId)
        : images.find((image) => image.id === id)?.categoryIds?.includes(activeCategoryId)).length;
      setImages((current) => current.map((image) => selectedImageIds.includes(image.id)
        ? { ...image, categoryIds: action === 'add' ? Array.from(new Set([...(image.categoryIds || []), activeCategoryId])) : (image.categoryIds || []).filter((id) => id !== activeCategoryId) }
        : image));
      setCategories((current) => current.map((category) => category.id === activeCategoryId
        ? { ...category, count: Math.max(0, category.count + (action === 'add' ? changedCount : -changedCount)) }
        : category));
      setSelectedImageIds([]);
      setSelectingImages(false);
      setNotice(action === 'add' ? '已加入分类' : '已从分类移除');
    } catch { setNotice('分类更新失败，请重试'); }
    finally { setCategoryBusy(false); }
  };

  const selectAllVisible = () => {
    const allSelected = visibleImages.every((image) => selectedImageIds.includes(image.id));
    setSelectedImageIds((current) => allSelected
      ? current.filter((id) => !visibleImages.some((image) => image.id === id))
      : Array.from(new Set([...current, ...visibleImages.map((image) => image.id)])));
  };

  const toggleDownloadSelection = (id: string) => {
    setDownloadSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const selectAllDownloadVisible = () => {
    const allSelected = visibleImages.every((image) => downloadSelectedIds.includes(image.id));
    setDownloadSelectedIds((current) => allSelected
      ? current.filter((id) => !visibleImages.some((image) => image.id === id))
      : Array.from(new Set([...current, ...visibleImages.map((image) => image.id)])));
  };

  const downloadImage = (id: string, name: string) => {
    const link = document.createElement('a');
    link.href = connected ? `/api/download?id=${encodeURIComponent(id)}` : images.find((image) => image.id === id)?.src || name;
    link.download = name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const downloadSelected = async () => {
    if (!downloadSelectedIds.length || downloadBusy) return;
    setDownloadBusy(true);
    setNotice('正在准备下载…');
    try {
      const query = downloadSelectedIds.map((id) => `id=${encodeURIComponent(id)}`).join('&');
      const response = await fetch(`/api/download?${query}`);
      if (!response.ok) throw new Error('下载失败，请重试');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'frameflow-images.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice(`已准备 ${downloadSelectedIds.length} 张图片`);
      setDownloadSelectedIds([]);
      setDownloadMode(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '下载失败，请重试');
    } finally { setDownloadBusy(false); }
  };

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
    if (authenticated && !connected) {
      setNotice('云端数据库暂不可用，图片尚未上传');
      return;
    }
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

  const openImage = async (image: GalleryImage) => {
    setSelected(image);
    setCommentText('');
    if (!connected) return;
    try {
      const response = await fetch(`/api/images/${image.id}/comments`);
      if (!response.ok) throw new Error('Unable to load comments');
      const comments = await response.json();
      setImages((current) => current.map((item) => item.id === image.id ? { ...item, comments } : item));
      setSelected((current) => current?.id === image.id ? { ...current, comments } : current);
    } catch { setNotice('评论加载失败'); }
  };

  const submitComment = async () => {
    if (!selected || !commentText.trim() || commentBusy) return;
    const text = commentText.trim();
    setCommentBusy(true);
    try {
      let comment: GalleryComment;
      if (connected) {
        const response = await fetch(`/api/images/${selected.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!response.ok) throw new Error('Unable to save comment');
        comment = await response.json();
      } else {
        comment = { id: `${Date.now()}`, userId: '本地用户', text, createdAt: new Date().toISOString() };
      }
      const comments = [...(selected.comments || []), comment];
      setImages((current) => current.map((item) => item.id === selected.id ? { ...item, comments } : item));
      setSelected((current) => current?.id === selected.id ? { ...current, comments } : current);
      setCommentText('');
    } catch { setNotice('评论保存失败，请稍后重试'); }
    finally { setCommentBusy(false); }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = '';
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="top-spacer" />
        <div className="top-actions">{hasClerk ? <><Show when="signed-out"><SignInButton mode="modal"><button className="button ghost">登录</button></SignInButton></Show><Show when="signed-in"><UserButton /></Show></> : <span className="user-pill"><span className="avatar">Z</span><span className="desktop-only">本地用户</span><span className="online-dot" /></span>}<span className="mode-label">{authenticated && !connected ? '云端连接异常' : connected ? (isAdmin ? '管理员' : '在线') : '本地预览'}</span>{(!hasClerk || (connected && authenticated)) && <button className="button primary" onClick={() => setUploadOpen(true)}><Icon>＋</Icon>上传图片</button>}</div>
      </header>

      <section className="toolbar" id="gallery">
        <div className="filter-tabs">
          <button className={activeFilter === 'all' && !activeCategoryId ? 'tab active' : 'tab'} onClick={() => { setActiveFilter('all'); setActiveCategoryId(null); setSelectingImages(false); setSelectedImageIds([]); }}>全部图片 <b>{images.length}</b></button>
          <button className={activeFilter === 'featured' && !activeCategoryId ? 'tab active' : 'tab'} onClick={() => { setActiveFilter('featured'); setActiveCategoryId(null); setSelectingImages(false); setSelectedImageIds([]); }}>精选 <b>{images.filter((image) => image.featured).length}</b></button>
          {categories.map((category) => <button key={category.id} className={activeCategoryId === category.id ? 'tab active' : 'tab'} onClick={() => { setActiveFilter('all'); setActiveCategoryId(category.id); setSelectingImages(false); setSelectedImageIds([]); }}>{category.name} <b>{category.count}</b></button>)}
          <button className="tab add-category-tab" onClick={() => setCategoryModalOpen(true)} aria-label="新建分类" title="新建分类">＋</button>
        </div>
        <label className="search-box"><span aria-hidden="true" className="search-icon">⌕</span><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="搜索图片名称" aria-label="搜索图片名称" />{searchTerm && <button type="button" className="search-clear" onClick={() => setSearchTerm('')} aria-label="清除搜索">×</button>}</label>
        <div className="toolbar-end">{connected && authenticated && <button className="button ghost download-entry" onClick={() => { setDownloadMode(true); setSelectingImages(false); setSelectedImageIds([]); setDownloadSelectedIds([]); }}>批量下载</button>}<div className="sort-label"><Icon>↕</Icon> 最新上传</div></div>
      </section>

      {activeCategoryId && <div className="category-tools">
        {selectingImages ? <><span>已选 {selectedImageIds.length} 张</span><button className="text-button" onClick={selectAllVisible}>{visibleImages.length > 0 && visibleImages.every((image) => selectedImageIds.includes(image.id)) ? '取消全选' : `全选当前 ${visibleImages.length} 张`}</button><button className="button primary" disabled={!selectedImageIds.length || categoryBusy} onClick={() => void assignSelectedImages('add')}>加入分类</button>{visibleImages.some((image) => image.categoryIds?.includes(activeCategoryId)) && <button className="button ghost" disabled={!selectedImageIds.length || categoryBusy} onClick={() => void assignSelectedImages('remove')}>从分类移除</button>}<button className="button ghost" onClick={() => { setSelectingImages(false); setSelectedImageIds([]); }}>完成</button></> : <><span>分类：{categories.find((category) => category.id === activeCategoryId)?.name}</span><button className="button ghost" onClick={() => { setSelectingImages(true); setSelectedImageIds([]); }}>选择图片</button></>}
      </div>}

      {downloadMode && <div className="category-tools download-tools"><span>已选 {downloadSelectedIds.length} 张</span><button className="text-button" onClick={selectAllDownloadVisible}>{visibleImages.length > 0 && visibleImages.every((image) => downloadSelectedIds.includes(image.id)) ? '取消全选' : `全选当前 ${visibleImages.length} 张`}</button><button className="button primary" disabled={!downloadSelectedIds.length || downloadBusy} onClick={() => void downloadSelected()}>{downloadBusy ? '准备中…' : '下载已选图片'}</button><button className="button ghost" onClick={() => { setDownloadMode(false); setDownloadSelectedIds([]); }}>完成</button></div>}

      <section className="masonry" aria-label="图片瀑布流">
        {visibleImages.map((image, index) => { const selectedForDownload = downloadSelectedIds.includes(image.id); const selectedForCategory = selectedImageIds.includes(image.id); const imageIsSelectable = selectingImages || downloadMode; return <article className={`image-card card-${index % 5} ${(selectingImages && selectedForCategory) || (downloadMode && selectedForDownload) ? 'image-selected' : ''}`} key={image.id}>
          <button className="image-button" onClick={() => selectingImages ? toggleImageSelection(image.id) : downloadMode ? toggleDownloadSelection(image.id) : void openImage(image)} aria-label={imageIsSelectable ? `${(selectingImages ? selectedForCategory : selectedForDownload) ? '取消选择' : '选择'} ${image.name}` : `放大查看 ${image.name}`}><img src={image.src} alt={image.name} />{imageIsSelectable && <span className="selection-check">{(selectingImages ? selectedForCategory : selectedForDownload) ? '✓' : ''}</span>}</button>
          <div className="card-overlay"><p className="image-name">{image.name}</p><button className={image.featured ? 'feature active' : 'feature'} onClick={() => toggleFeatured(image.id)} aria-label="切换精选">{image.featured ? '★' : '☆'}</button></div>
          <div className="vote-row"><div className="vote-buttons"><button className="vote download-button" onClick={() => downloadImage(image.id, image.name)} aria-label={`下载 ${image.name}`} title="下载"><Icon>↓</Icon></button><button className={image.vote === 'up' ? 'vote selected-up' : 'vote'} onClick={() => updateVote(image.id, 'up')} aria-label="认可" title="认可"><Icon>✓</Icon></button><button className={image.vote === 'down' ? 'vote selected-down' : 'vote'} onClick={() => updateVote(image.id, 'down')} aria-label="不认可" title="不认可"><Icon>×</Icon></button></div></div>
        </article>})}
        {!visibleImages.length && <div className="gallery-empty">{authenticated && !connected ? notice || '云端图片暂时无法读取，请检查数据库连接。' : activeCategoryId ? '这个分类还没有图片。点击“选择图片”，从画廊中添加。' : '没有找到匹配的图片。'}</div>}
      </section>

      <footer><span><span className="footer-dot" />{authenticated && !connected ? '云端连接异常' : connected ? '已连接云端' : '本地演示模式'}</span><span>{notice || (connected ? '图片保存到云端' : authenticated ? '云端数据未加载，本地操作已暂停' : '图片只保存在当前浏览器')}</span></footer>

      {isUploadOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setUploadOpen(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title"><div className="modal-head"><div><p className="eyebrow">ADD ASSETS</p><h2 id="upload-title">上传图片</h2></div><button className="close" onClick={() => setUploadOpen(false)}>×</button></div><div className={dragging ? 'dropzone dragging' : 'dropzone'} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()}><input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handleInput} /><span className="upload-icon">↑</span><strong>拖拽图片到这里</strong><span>或点击选择，可一次上传多张</span><small>PNG、JPG、WEBP · 建议单张不超过 10MB</small></div>{pendingFiles.length > 0 && <div className="pending"><div className="pending-title"><span>待上传 {pendingFiles.length} 张</span><button onClick={() => setPendingFiles([])}>清空</button></div><div className="pending-list">{pendingFiles.map((file, index) => <div className="pending-item" key={`${file.name}-${index}`}><span>{file.name}</span><button onClick={() => setPendingFiles((current) => current.filter((_, i) => i !== index))}>×</button></div>)}</div></div>}<div className="modal-actions"><button className="button ghost" onClick={() => setUploadOpen(false)}>取消</button><button className="button primary" disabled={!pendingFiles.length || busy} onClick={publishFiles}>{busy ? '上传中…' : '发布到画廊'} <Icon>→</Icon></button></div></div></div>}

      {categoryModalOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCategoryModalOpen(false)}><form className="modal" role="dialog" aria-modal="true" aria-labelledby="category-title" onSubmit={(event) => void createCategory(event)}><div className="modal-head"><div><p className="eyebrow">IMAGE COLLECTION</p><h2 id="category-title">新建分类</h2></div><button type="button" className="close" onClick={() => setCategoryModalOpen(false)}>×</button></div><label className="category-name-field">分类名称<input autoFocus value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={40} placeholder="例如：千问生成图" /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setCategoryModalOpen(false)}>取消</button><button className="button primary" disabled={!categoryName.trim() || categoryBusy}>{categoryBusy ? '创建中…' : '创建分类'}</button></div></form></div>}

      {selected && <div className="lightbox" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><button className="lightbox-close" onClick={() => setSelected(null)}>×</button><div className="lightbox-content"><div className="lightbox-main"><img src={selected.src} alt={selected.name} /><div className="lightbox-info"><h2>{selected.name}</h2><div className="lightbox-votes"><button className={selected.vote === 'up' ? 'vote selected-up' : 'vote'} onClick={() => updateVote(selected.id, 'up')} aria-label="认可" title="认可"><Icon>✓</Icon></button><button className={selected.vote === 'down' ? 'vote selected-down' : 'vote'} onClick={() => updateVote(selected.id, 'down')} aria-label="不认可" title="不认可"><Icon>×</Icon></button></div></div></div><aside className="comments-panel"><h3>评论 <span>{selected.comments?.length ?? 0}</span></h3><div className="comment-list">{selected.comments?.length ? selected.comments.map((comment) => <article className="comment" key={comment.id}><div className="comment-meta"><span>{comment.userId === '本地用户' ? comment.userId : `${comment.userId.slice(0, 10)}…`}</span><time>{new Date(comment.createdAt).toLocaleString()}</time></div><p>{comment.text}</p></article>) : <p className="empty-comments">还没有评论</p>}</div><form className="comment-form" onSubmit={(event) => { event.preventDefault(); void submitComment(); }}><textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={1000} placeholder="写下你的想法…" aria-label="评论内容" /><div><span>{commentText.length}/1000</span><button className="button primary" disabled={!commentText.trim() || commentBusy}>{commentBusy ? '发送中…' : '发送'}</button></div></form></aside></div></div>}
    </main>
  );
}

