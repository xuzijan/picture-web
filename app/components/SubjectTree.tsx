"use client";

import { useMemo, useState } from 'react';
import taxonomy from '@/lib/latest-batch-taxonomy.json';

type Image = { id: string; subjectTags?: { mainSubject: string; secondarySubjects: string[] } | null };
type Node = { id: string; label: string; synset?: string; extension?: boolean; terms: Set<string>; children: Node[] };
const labels: Record<string, string> = taxonomy.labels;
const root: Node = { id: 'root', label: '本批次全部物体', terms: new Set(), children: [] };
for (const entry of taxonomy.entries) {
  let parent = root;
  parent.terms.add(entry.term);
  for (const synset of entry.path) {
    let child = parent.children.find((node) => node.synset === synset);
    if (!child) { child = { id: `${parent.id}/${synset}`, label: labels[synset], synset, terms: new Set(), children: [] }; parent.children.push(child); }
    child.terms.add(entry.term);
    parent = child;
  }
  parent.children.push({ id: `${parent.id}/term:${entry.term}`, label: entry.term, extension: entry.extension, terms: new Set([entry.term]), children: [] });
}

export default function SubjectTree({ images, selectedId, onSelect }: { images: Image[]; selectedId: string | null; onSelect: (id: string | null, label: string, terms: string[] | null) => void }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root', 'root/entity.n.01', 'root/entity.n.01/physical_entity.n.01']));
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    function visit(node: Node) {
      result.set(node.id, images.filter((image) => image.subjectTags && [image.subjectTags.mainSubject, ...image.subjectTags.secondarySubjects].some((term) => node.terms.has(term))).length);
      node.children.forEach(visit);
    }
    visit(root); return result;
  }, [images]);
  const needle = query.trim().toLocaleLowerCase();
  function matches(node: Node): boolean { return !needle || node.label.toLocaleLowerCase().includes(needle) || Boolean(node.synset?.includes(needle)) || node.children.some(matches); }
  function render(node: Node): React.ReactNode {
    if (!matches(node)) return null;
    const open = Boolean(needle) || expanded.has(node.id);
    return <li key={node.id}><div className="subject-tree-row">
      {node.children.length > 0 ? <button className="tree-toggle" aria-label={`${open ? '收起' : '展开'}${node.label}`} aria-expanded={open} onClick={() => setExpanded((current) => { const next = new Set(current); if (open) next.delete(node.id); else next.add(node.id); return next; })}>{open ? '▾' : '▸'}</button> : <span className="tree-leaf">·</span>}
      <button className={`tree-node ${selectedId === node.id ? 'active' : ''}`} aria-pressed={selectedId === node.id} title={node.synset || (node.extension ? '词表扩展题材，挂接至上位概念' : node.label)} onClick={() => onSelect(node.id, node.label, Array.from(node.terms))}><span>{node.label}{node.extension && <small> 扩展</small>}</span><b>{counts.get(node.id) ?? 0}</b></button>
    </div>{open && node.children.length > 0 && <ul>{node.children.map(render)}</ul>}</li>;
  }
  return <aside className="subject-tree"><div className="subject-tree-heading"><h3>物体分类树</h3><button className="text-button" onClick={() => onSelect(null, '', null)}>清除筛选</button></div><p>最新 100 张 · 144 个题材<br/>匹配主物体或副物体，数字为关联图片数。</p><input aria-label="搜索分类树" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="查找物体或类别…" /><div className="subject-tree-scroll"><ul>{render(root)}</ul>{!matches(root) && <p>没有找到匹配的物体。</p>}</div><details className="tree-note"><summary>分类来源与说明</summary><p>WordNet 3.0，每个概念保留一条完整上位路径。末端为本批次题材；“扩展”不是独立 WordNet 概念。部分中间类别保留英文原名。点击中间节点也可筛选整条分支。</p><a href={taxonomy.source} target="_blank" rel="noreferrer">查看分类文档 ↗</a></details></aside>;
}
