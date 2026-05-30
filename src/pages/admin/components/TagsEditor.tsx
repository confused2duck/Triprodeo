import { useState } from 'react';

interface Props {
  tags: string[];
  onSave: (tags: string[]) => void;
}

export default function TagsEditor({ tags: initialTags, onSave }: Props) {
  const [tags, setTags] = useState<string[]>([...initialTags]);
  const [input, setInput] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saved, setSaved] = useState(false);

  const persist = (list: string[]) => {
    setTags(list);
    onSave(list);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addTag = () => {
    const t = input.trim();
    if (!t || tags.includes(t)) return;
    persist([...tags, t]);
    setInput('');
  };

  const removeTag = (idx: number) => persist(tags.filter((_, i) => i !== idx));

  const startEdit = (idx: number) => {
    setEditIdx(idx);
    setEditValue(tags[idx]);
  };

  const saveEdit = () => {
    if (editIdx === null) return;
    const v = editValue.trim();
    if (!v) return;
    const updated = tags.map((t, i) => (i === editIdx ? v : t));
    persist(updated);
    setEditIdx(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-stone-900" style={{ fontFamily: "'Playfair Display', serif" }}>
            Manage Property Tags
          </h2>
          <p className="text-stone-500 text-sm mt-0.5">
            {tags.length} tag{tags.length !== 1 ? 's' : ''} — these appear as checkboxes when adding/editing properties
          </p>
        </div>
        {saved && (
          <span className="text-emerald-600 text-sm flex items-center gap-1">
            <i className="ri-check-line" /> Saved!
          </span>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
        <i className="ri-price-tag-3-line text-blue-500 text-lg mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-stone-800 mb-0.5">Global tag library</p>
          <p className="text-xs text-stone-500">
            Tags added here appear as selectable checkboxes in the Properties Editor and Host Portal property creation form.
            Hosts can also add custom tags — those are merged with this list automatically.
          </p>
        </div>
      </div>

      {/* Add new tag */}
      <div className="bg-white rounded-2xl border border-stone-100 p-5 mb-5">
        <h3 className="text-sm font-semibold text-stone-700 mb-3">Add New Tag</h3>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            className="flex-1 px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400"
            placeholder="e.g. Infinity Pool, Mountain View, Pet Friendly"
          />
          <button
            onClick={addTag}
            disabled={!input.trim() || tags.includes(input.trim())}
            className="px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line mr-1" /> Add Tag
          </button>
        </div>
        {input.trim() && tags.includes(input.trim()) && (
          <p className="text-xs text-red-400 mt-1.5 ml-1">This tag already exists.</p>
        )}
      </div>

      {/* Tag list */}
      <div className="bg-white rounded-2xl border border-stone-100 p-5">
        <h3 className="text-sm font-semibold text-stone-700 mb-4">All Tags ({tags.length})</h3>

        {tags.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-stone-200 rounded-xl">
            <i className="ri-price-tag-3-line text-stone-300 text-3xl block mb-2" />
            <p className="text-stone-500 text-sm">No tags yet. Add your first tag above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tags.map((tag, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-stone-100 hover:border-stone-200 bg-stone-50 group"
              >
                <i className="ri-price-tag-3-line text-stone-400 shrink-0" />

                {editIdx === idx ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') setEditIdx(null);
                    }}
                    className="flex-1 px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-stone-500"
                  />
                ) : (
                  <span className="flex-1 text-sm text-stone-800 font-medium">{tag}</span>
                )}

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {editIdx === idx ? (
                    <>
                      <button
                        onClick={saveEdit}
                        className="w-8 h-8 flex items-center justify-center bg-emerald-50 rounded-lg text-emerald-600 hover:bg-emerald-100 cursor-pointer"
                      >
                        <i className="ri-check-line text-sm" />
                      </button>
                      <button
                        onClick={() => setEditIdx(null)}
                        className="w-8 h-8 flex items-center justify-center bg-stone-100 rounded-lg text-stone-500 hover:bg-stone-200 cursor-pointer"
                      >
                        <i className="ri-close-line text-sm" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(idx)}
                        className="w-8 h-8 flex items-center justify-center bg-stone-100 rounded-lg text-stone-600 hover:bg-stone-200 cursor-pointer"
                      >
                        <i className="ri-edit-line text-sm" />
                      </button>
                      <button
                        onClick={() => removeTag(idx)}
                        className="w-8 h-8 flex items-center justify-center bg-red-50 rounded-lg text-red-500 hover:bg-red-100 cursor-pointer"
                      >
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      {tags.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-5 mt-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">Preview (as shown in property forms)</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs text-stone-600 bg-stone-50 flex items-center gap-1.5"
              >
                <span className="w-3.5 h-3.5 rounded border border-stone-300 bg-white inline-block shrink-0" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
