import { useEffect, useMemo, useState } from 'react';
import { PACKAGE_ACCESS, ResortOwnerPackage } from '../types';
import {
  createHost,
  deleteHost,
  getHosts,
  updateHostAccount,
  updateHostStatus,
} from '@/services/api';

type HostRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  package?: string | null;
  status?: string | null;
  joinedAt?: string;
  _count?: { properties?: number; bookings?: number };
};

const packageOptions: { value: ResortOwnerPackage; label: string; price: string; color: string; ring: string }[] = [
  { value: 'basic', label: 'Basic', price: '₹4,999/mo', color: 'bg-stone-100 text-stone-700', ring: 'ring-stone-400' },
  { value: 'standard', label: 'Standard', price: '₹9,999/mo', color: 'bg-amber-100 text-amber-800', ring: 'ring-amber-400' },
  { value: 'premium', label: 'Premium', price: '₹19,999/mo', color: 'bg-emerald-100 text-emerald-800', ring: 'ring-emerald-400' },
];

function PackageBadge({ pkg }: { pkg?: ResortOwnerPackage }) {
  if (!pkg) return <span className="text-xs text-stone-400 italic">No package</span>;
  const opt = packageOptions.find((o) => o.value === pkg);
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${opt?.color}`}>{opt?.label}</span>;
}

export default function HostAccountsEditor() {
  const [accounts, setAccounts] = useState<HostRow[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHost, setEditingHost] = useState<HostRow | null>(null);
  const [expandedAccess, setExpandedAccess] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    avatar: '',
    status: 'active' as 'active' | 'suspended',
    package: 'basic' as ResortOwnerPackage,
  });

  const refreshHosts = () => {
    setLoading(true);
    getHosts()
      .then((data) => {
        const list = (data as { hosts?: HostRow[] }).hosts ?? [];
        setAccounts(list);
      })
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshHosts();
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      password: '',
      phone: '',
      avatar: '',
      status: 'active',
      package: 'basic',
    });
    setFormError('');
  };

  const openAdd = () => {
    resetForm();
    setEditingHost(null);
    setShowAddModal(true);
  };

  const openEdit = (host: HostRow) => {
    setForm({
      name: host.name,
      email: host.email,
      password: '',
      phone: host.phone ?? '',
      avatar: host.avatar ?? '',
      status: (host.status?.toLowerCase() as 'active' | 'suspended') ?? 'active',
      package: (host.package?.toLowerCase() as ResortOwnerPackage) ?? 'basic',
    });
    setEditingHost(host);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim() || (!editingHost && !form.password.trim())) {
      setFormError('Name, email, and password are required.');
      return;
    }
    setFormError('');

    try {
      if (editingHost) {
        await updateHostAccount(editingHost.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password.trim() || undefined,
          phone: form.phone.trim() || undefined,
          avatar: form.avatar.trim() || undefined,
          package: form.package,
          status: form.status,
        });
      } else {
        await createHost({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password.trim(),
          phone: form.phone.trim() || undefined,
          avatar: form.avatar.trim() || undefined,
          package: form.package,
          status: form.status,
        });
      }
      setShowAddModal(false);
      refreshHosts();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save owner account');
    }
  };

  const toggleStatus = async (host: HostRow) => {
    await updateHostStatus(host.id, host.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');
    refreshHosts();
  };

  const removeHost = async (host: HostRow) => {
    if (!window.confirm('Delete this property owner account? Their properties will remain but be unassigned.')) return;
    await deleteHost(host.id);
    refreshHosts();
  };

  const selectedPkgInfo = useMemo(() => PACKAGE_ACCESS[form.package], [form.package]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Resort Owner Accounts</h2>
          <p className="text-stone-500 text-sm mt-1">Create real resort owner accounts in PostgreSQL</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-emerald-600 text-sm flex items-center gap-1"><i className="ri-check-line" /> Saved!</span>}
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-user-add-line" />
            Add Resort Owner
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Owners', value: accounts.length, icon: 'ri-user-3-line', color: 'bg-stone-100 text-stone-700' },
          { label: 'Active', value: accounts.filter((a) => a.status === 'ACTIVE').length, icon: 'ri-check-line', color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Premium', value: accounts.filter((a) => a.package === 'PREMIUM').length, icon: 'ri-vip-crown-line', color: 'bg-amber-50 text-amber-700' },
          { label: 'Suspended', value: accounts.filter((a) => a.status === 'SUSPENDED').length, icon: 'ri-close-circle-line', color: 'bg-red-50 text-red-700' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl p-4 flex items-center gap-3 ${stat.color}`}>
            <div className="w-10 h-10 flex items-center justify-center bg-white/60 rounded-lg">
              <i className={`${stat.icon} text-lg`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs opacity-70">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {packageOptions.map((opt) => {
          const info = PACKAGE_ACCESS[opt.value];
          return (
            <div key={opt.value} className={`rounded-xl border-2 p-4 ${opt.value === 'standard' ? 'border-amber-300' : opt.value === 'premium' ? 'border-emerald-300' : 'border-stone-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${opt.color}`}>{opt.label}</span>
                <span className="text-xs text-stone-500 font-semibold">{opt.price}</span>
              </div>
              <ul className="space-y-1">
                {info.features.slice(0, 3).map((f, i) => (
                  <li key={i} className="text-xs text-stone-600 flex items-center gap-1.5">
                    <i className="ri-check-line text-emerald-500 text-xs" />{f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        {loading && <p className="text-sm text-stone-500">Loading owners...</p>}
        {!loading && accounts.length === 0 && (
          <div className="text-center py-16 text-stone-400 bg-white rounded-xl border border-stone-200">
            <i className="ri-building-4-line text-4xl mb-3 block" />
            <p className="font-medium">No resort owner accounts yet</p>
            <p className="text-sm mt-1">Add the first resort owner above</p>
          </div>
        )}
        {accounts.map((host) => (
          <div key={host.id} className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 flex items-center justify-center bg-stone-100 rounded-full shrink-0 overflow-hidden">
                {host.avatar ? (
                  <img src={host.avatar} alt={host.name} className="w-full h-full object-cover" />
                ) : (
                  <i className="ri-user-3-line text-stone-500 text-xl" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-bold text-stone-900">{host.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${host.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {(host.status ?? 'ACTIVE').toLowerCase()}
                  </span>
                  <PackageBadge pkg={(host.package?.toLowerCase() as ResortOwnerPackage) ?? 'basic'} />
                </div>
                <p className="text-stone-500 text-sm">{host.email} · {host.phone ?? 'No phone'}</p>
                <div className="flex items-center gap-5 mt-3">
                  <div className="text-center">
                    <p className="text-sm font-bold text-stone-900">{host._count?.properties ?? 0}</p>
                    <p className="text-xs text-stone-400">Properties</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-stone-900">{host._count?.bookings ?? 0}</p>
                    <p className="text-xs text-stone-400">Bookings</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-stone-500">
                      {host.joinedAt ? new Date(host.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </p>
                    <p className="text-xs text-stone-400">Joined</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(host)} className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer" title="Edit">
                  <i className="ri-edit-line text-sm" />
                </button>
                <button onClick={() => toggleStatus(host)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${host.status === 'ACTIVE' ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50' : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'}`} title={host.status === 'ACTIVE' ? 'Suspend' : 'Activate'}>
                  <i className={host.status === 'ACTIVE' ? 'ri-forbid-line text-sm' : 'ri-check-line text-sm'} />
                </button>
                <button onClick={() => removeHost(host)} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="Delete">
                  <i className="ri-delete-bin-line text-sm" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-bold text-stone-900">
                {editingHost ? 'Edit Resort Owner Account' : 'Add Resort Owner'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Full Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" placeholder="Ananya Krishnan" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Email Address *</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" placeholder="ananya@resort.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Password {editingHost ? '(optional)' : '*'}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400 font-mono" placeholder="Create a strong password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Avatar URL</label>
                <input value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" placeholder="https://..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Package / Access Level *</label>
                <div className="space-y-2">
                  {packageOptions.map((opt) => (
                    <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.package === opt.value ? `${opt.ring} ring-2` : 'border-stone-200 hover:border-stone-300'} border-stone-200`}>
                      <input type="radio" name="pkg" value={opt.value} checked={form.package === opt.value} onChange={() => setForm({ ...form, package: opt.value })} className="mt-1 accent-stone-900" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${opt.color}`}>{opt.label}</span>
                          <span className="text-xs text-stone-500 font-semibold">{opt.price}</span>
                        </div>
                        <p className="text-xs text-stone-500">{PACKAGE_ACCESS[opt.value].features.slice(0, 2).join(' · ')}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'suspended' })} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400 bg-white">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              {formError && <p className="text-red-500 text-sm flex items-center gap-1"><i className="ri-error-warning-line" /> {formError}</p>}
            </div>

            <div className="p-5 border-t border-stone-100 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 border border-stone-200 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 transition-colors cursor-pointer">
                {editingHost ? 'Update Owner' : 'Create Owner Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
