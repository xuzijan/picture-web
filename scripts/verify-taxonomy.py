"""Run with Python + nltk and a local WordNet 3.0 corpus."""
import json
from pathlib import Path
from nltk.corpus import wordnet as wn
root = Path(__file__).resolve().parents[1]
taxonomy = json.loads((root / 'lib/latest-batch-taxonomy.json').read_text(encoding='utf-8'))
images = list(json.loads((root / 'lib/latest-batch-tags.json').read_text(encoding='utf-8')).values())
terms = {term for image in images for term in [image['mainSubject'], *image['secondarySubjects']]}
assert wn.get_version() == '3.0'
assert terms == {entry['term'] for entry in taxonomy['entries']}
for entry in taxonomy['entries']:
    assert entry['path'][0] == 'entity.n.01'
    assert entry['path'][-1] == entry['synset']
    for parent, child in zip(entry['path'], entry['path'][1:]):
        assert wn.synset(parent) in wn.synset(child).hypernyms() + wn.synset(child).instance_hypernyms()
    assert any(entry['term'] in [image['mainSubject'], *image['secondarySubjects']] for image in images)
print(f'PASS: {len(terms)} subjects, all WordNet paths and main/secondary matches verified')
