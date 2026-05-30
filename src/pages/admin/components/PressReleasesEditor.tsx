import { useState } from 'react';
import { CMSPressRelease } from '../types';

interface Props {
  data: CMSPressRelease[];
  onSave: (data: CMSPressRelease[]) => void;
}

const emptyRelease = (): CMSPressRelease => ({
  id: `pr_${Date.now()}`,
  date: '',
  title: '',
  source: '',
  url: '',
});

export default function PressReleasesEditor({ data, onSave }: Props) {
  const [items, setItems] = useState<CMSPressRelease[]>(data.length ? data : [emptyRelease()]);
  const [saved, setSaved] = useState(false);

  const updateItem = (index: number, patch: Partial<CMSPressRelease>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => setItems((current) => [...current, emptyRelease()]);
  const removeItem = (index: number) => setItems((current) => current.filter((_, i) => i !== index));

  const handleSave = () => {
    onSave(items.filter((item) => item.title.trim()).map((item) => ({ ...item, id: item.id || `pr_${Date.now()}` })));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Press Releases</h2>
          <p className="text-stone-500 text-sm mt-1">Manage newsroom cards shown on the home page.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-emerald-600 text-sm flex items-center gap-1"><i className="ri-check-line" /> Saved</span>}
          <button onClick={addItem} className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer whitespace-nowrap">
            <i className="ri-add-line mr-1" /> Add Release
          </button>
          <button onClick={handleSave} className="px-5 py-2 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 cursor-pointer whitespace-nowrap">
            Save Changes
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-800">Release {index + 1}</h3>
              <button onClick={() => removeItem(index)} className="text-red-500 text-sm hover:text-red-700 cursor-pointer whitespace-nowrap">
                <i className="ri-delete-bin-line mr-1" /> Remove
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Date Label</label>
                <input value={item.date} onChange={(e) => updateItem(index, { date: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" placeholder="Apr 2026" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Source</label>
                <input value={item.source} onChange={(e) => updateItem(index, { source: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" placeholder="Triprodeo Newsroom" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Title</label>
                <input value={item.title} onChange={(e) => updateItem(index, { title: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" placeholder="Press release title" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Optional URL</label>
                <input value={item.url ?? ''} onChange={(e) => updateItem(index, { url: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" placeholder="https://..." />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
