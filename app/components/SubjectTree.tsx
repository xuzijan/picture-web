"use client";

import { useMemo, useState } from 'react';
import taxonomy from '@/lib/latest-batch-taxonomy.json';

type Image = { id: string; subjectTags?: { mainSubject: string; secondarySubjects: string[] } | null };
type Node = { id: string; label: string; synset?: string; extension?: boolean; terms: Set<string>; children: Node[] };
const labels: Record<string, string> = taxonomy.labels;
const root: Node = { id: 'root', label: 'All subjects in this batch', terms: new Set(), children: [] };
for (const entry of taxonomy.entries) {
  let parent = root;
  parent.terms.add(entry.term);
  for (const synset of entry.path) {
    let child = parent.children.find((node) => node.synset === synset);
    if (!child) { child = { id: `${parent.id}/${synset}`, label: labels[synset], synset, terms: new Set(), children: [] }; parent.children.push(child); }
    child.terms.add(entry.term);
    parent = child;
  }
  parent.children.push({ id: `${parent.id}/term:${entry.term}`, label: entry.label, extension: entry.extension, terms: new Set([entry.term]), children: [] });
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
  function matches(node: Node): boolean { return !needle || node.label.toLocaleLowerCase().includes(needle) || Array.from(node.terms).some((term) => term.includes(needle)) || Boolean(node.synset?.includes(needle)) || node.children.some(matches); }
  function render(node: Node): React.ReactNode {
    if (!matches(node)) return null;
    const open = Boolean(needle) || expanded.has(node.id);
    return <li key={node.id}><div className="subject-tree-row">
      {node.children.length > 0 ? <button className="tree-toggle" aria-label={`${open ? 'Collapse' : 'Expand'} ${node.label}`} aria-expanded={open} onClick={() => setExpanded((current) => { const next = new Set(current); if (open) next.delete(node.id); else next.add(node.id); return next; })}>{open ? '▾' : '▸'}</button> : <span className="tree-leaf">·</span>}
      <button className={`tree-node ${selectedId === node.id ? 'active' : ''}`} aria-pressed={selectedId === node.id} title={node.synset || (node.extension ? 'Dataset extension attached to a broader WordNet concept' : node.label)} onClick={() => onSelect(node.id, node.label, Array.from(node.terms))}><span>{node.label}{node.extension && <small> · extension</small>}</span><b>{counts.get(node.id) ?? 0}</b></button>
    </div>{open && node.children.length > 0 && <ul>{node.children.map(render)}</ul>}</li>;
  }
  return <aside className="subject-tree"><div className="subject-tree-heading"><h3>Subject taxonomy</h3><button className="text-button" onClick={() => onSelect(null, '', null)}>Clear filter</button></div><p>Latest 100 images · 144 subjects<br/>Matches primary or secondary subjects. Counts are images.</p><input aria-label="Search subject taxonomy" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects or categories…" /><div className="subject-tree-scroll"><ul>{render(root)}</ul>{!matches(root) && <p>No matching subjects.</p>}</div><details className="tree-note"><summary>Source and notes</summary><p>WordNet 3.0, with one complete hypernym path per concept. Terminal subjects marked “extension” are dataset terms attached to a broader concept. Select any category to filter its branch.</p><a href={taxonomy.source} target="_blank" rel="noreferrer">View source document ↗</a></details></aside>;
}
