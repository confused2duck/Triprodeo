import { useEffect, useState } from 'react';
import { CMSProperty, CMSRoomType, CMSAddOn, CMSPropertyReview, CMSDayPackage, CMSDayPackageOption } from '../types';
import { defaultPropertyTagOptions, defaultPropertyTypeOptions } from '../cmsStore';
import ImageUploader from '@/components/base/ImageUploader';
import { createProperty, getHosts, getProperties, updateHostProfile, updateProperty } from '@/services/api';

interface Props {
  data: CMSProperty[];
  onSave: (data: CMSProperty[]) => void;
  tagOptions?: string[];
  typeOptions?: string[];
  onSaveOptions?: (tagOptions: string[], typeOptions: string[]) => void;
}

type HostSummary = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
};

type ApiRoomRecord = Partial<CMSRoomType> & { images?: string[]; totalCount?: number };

type ApiPropertyRecord = Partial<CMSProperty> & {
  host?: { name?: string; avatar?: string | null; joinedAt?: string; superhost?: boolean };
  roomTypes?: ApiRoomRecord[];
  addOns?: Array<Partial<CMSAddOn>>;
};

type EditorTab = 'basic' | 'photos' | 'amenities' | 'rooms' | 'policies' | 'addons' | 'host' | 'reviews' | 'daypackage';

// Collision-proof id — Date.now() alone repeats when two items are added in the
// same millisecond, which then triggers a unique-constraint 500 on save.
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const AMENITY_PRESETS: { group: string; items: string[] }[] = [
  { group: 'Outdoor & Recreation', items: ['Infinity Pool', 'Private Pool', 'Private Beach', 'Beach Access', 'Rooftop Deck', 'Garden', 'BBQ', 'Bonfire', 'Yoga Deck', 'Tennis Court'] },
  { group: 'Wellness', items: ['Spa', 'Jacuzzi', 'Gym', 'Sauna', 'Hammam', 'Plunge Pool', 'Steam Room', 'Hot Tub'] },
  { group: 'Dining', items: ['Restaurant', 'Bar', 'Chef on Request', 'Organic Breakfast', 'Room Service', 'Minibar', 'Outdoor Dining', 'Private Chef'] },
  { group: 'Technology', items: ['WiFi', 'Smart TV', 'Netflix', 'Bluetooth Speaker', 'Work Desk', 'Fast Internet'] },
  { group: 'Safety & Accessibility', items: ['24/7 Security', 'CCTV', 'Fire Extinguisher', 'First Aid', 'Wheelchair Access', 'Elevator'] },
  { group: 'Climate', items: ['AC', 'Heating', 'Ceiling Fan', 'Fireplace'] },
  { group: 'Transport', items: ['Parking', 'EV Charging', 'Airport Transfer', 'Bicycle Rental', 'Boat Dock'] },
  { group: 'Activities', items: ['Kayaks', 'Surfboards', 'Trekking Guide', 'Safari Tours', 'Fishing Kit', 'Horse Riding', 'Snorkelling Kit'] },
  { group: 'Services', items: ['Concierge', 'Butler Service', 'Daily Housekeeping', 'Laundry', 'Baby Cot Available', 'Pet Friendly'] },
];

const BED_TYPES = ['King Bed', 'Queen Bed', 'Twin Beds', 'Double Bed', 'Bunk Beds', 'Single Bed', 'Futon', 'Sofa Bed'];
const EXTRA_BED_AMENITY = 'Extra Bed Available';

const emptyRoom = (): CMSRoomType => ({
  id: uid('rm'),
  name: '',
  pricePerNight: 0,
  capacity: 2,
  totalRooms: 1,
  bedType: 'King Bed',
  size: '',
  description: '',
  photos: [''],
  amenities: [],
});

const defaultDayPackage = (): CMSDayPackage => ({
  enabled: false,
  description: '',
  timing: '',
  pricePerPerson: 0,
  maxGuests: undefined,
  meals: [],
  activities: [],
  facilities: [],
  image: '',
  packages: [],
});

const normalizeStringList = (items?: string[]) =>
  Array.from(new Set((items ?? []).map((item) => item.trim()).filter(Boolean)));

const normalizeDayPackageOption = (
  option: CMSDayPackageOption,
  index: number,
  fallback: CMSDayPackage
): CMSDayPackageOption => ({
  id: option.id || `dp_${Date.now()}_${index}`,
  title: option.title?.trim() || `Package ${index + 1}`,
  description: option.description?.trim() || '',
  timing: option.timing?.trim() || fallback.timing || '',
  pricePerPerson: Number(option.pricePerPerson ?? fallback.pricePerPerson ?? 0),
  maxGuests: option.maxGuests ? Number(option.maxGuests) : fallback.maxGuests,
  meals: normalizeStringList(option.meals ?? fallback.meals),
  activities: normalizeStringList(option.activities ?? fallback.activities),
  facilities: normalizeStringList(option.facilities ?? fallback.facilities),
  image: option.image?.trim() || fallback.image || '',
});

const normalizeDayPackage = (dayPackage?: CMSDayPackage): CMSDayPackage => {
  const base = { ...defaultDayPackage(), ...(dayPackage ?? {}) };
  return {
    ...base,
    description: base.description?.trim() ?? '',
    timing: base.timing?.trim() ?? '',
    pricePerPerson: Number(base.pricePerPerson ?? 0),
    maxGuests: base.maxGuests ? Number(base.maxGuests) : undefined,
    meals: normalizeStringList(base.meals),
    activities: normalizeStringList(base.activities),
    facilities: normalizeStringList(base.facilities),
    image: base.image?.trim() || '',
    packages: (base.packages ?? []).map((option, index) => normalizeDayPackageOption(option, index, base)),
  };
};

const emptyProperty = (): CMSProperty => ({
  id: uid('p'),
  name: '',
  location: '',
  city: '',
  state: '',
  pricePerNight: 0,
  rating: 4.5,
  reviewCount: 0,
  images: [''],
  tags: [],
  type: 'villa',
  status: 'approved',
  verified: true,
  superhost: false,
  bedrooms: 1,
  bathrooms: 1,
  maxGuests: 2,
  description: '',
  amenities: [],
  roomTypes: [],
  housePolicies: [],
  addOns: [],
  categoryRatings: { cleanliness: 4.5, communication: 4.5, checkIn: 4.5, accuracy: 4.5, location: 4.5, value: 4.5 },
  host: { name: '', avatar: '', joinedYear: new Date().getFullYear(), superhost: false },
  reviews: [],
  dayPackage: defaultDayPackage(),
});

const apiPropertyToCMS = (property: ApiPropertyRecord): CMSProperty => ({
  id: String(property.id ?? `p${Date.now()}`),
  hostId: property.hostId,
  name: property.name ?? '',
  location: property.location ?? '',
  fullAddress: property.fullAddress ?? '',
  city: property.city ?? property.location ?? '',
  state: property.state ?? '',
  pricePerNight: Number(property.pricePerNight ?? 0),
  originalPrice: property.originalPrice,
  rating: Number(property.rating ?? 4.5),
  reviewCount: Number(property.reviewCount ?? 0),
  images: property.images?.filter(Boolean) ?? [],
  tags: property.tags ?? [],
  isExclusive: property.isExclusive ?? false,
  type: property.type ?? 'villa',
  status: (String(property.status ?? 'approved').toLowerCase() as CMSProperty['status']) ?? 'approved',
  verified: property.verified ?? false,
  superhost: property.superhost ?? property.host?.superhost ?? false,
  bedrooms: Number(property.bedrooms ?? 1),
  bathrooms: Number(property.bathrooms ?? 1),
  maxGuests: Number(property.maxGuests ?? 2),
  scarcity: property.scarcity,
  description: property.description ?? '',
  amenities: property.amenities ?? [],
  roomTypes: ((property.roomTypes ?? []) as ApiRoomRecord[]).map((room) => ({
    id: String(room.id ?? `rm_${Date.now()}`),
    name: room.name ?? '',
    pricePerNight: Number(room.pricePerNight ?? 0),
    capacity: Number(room.capacity ?? 2),
    totalRooms: Number(room.totalRooms ?? room.totalCount ?? 1),
    bedType: room.bedType ?? 'King Bed',
    size: room.size ?? '',
    description: room.description ?? '',
    photos: room.photos ?? room.images ?? [],
    amenities: room.amenities ?? [],
  })),
  housePolicies: property.housePolicies ?? [],
  addOns: (property.addOns ?? []).map((addOn) => ({
    id: String(addOn.id ?? `addon_${Date.now()}`),
    name: addOn.name ?? '',
    price: Number(addOn.price ?? 0),
    image: addOn.image ?? '',
    description: addOn.description ?? '',
  })),
  categoryRatings: property.categoryRatings ?? { cleanliness: 4.5, communication: 4.5, checkIn: 4.5, accuracy: 4.5, location: 4.5, value: 4.5 },
  host: {
    name: property.host?.name ?? 'Triprodeo Host',
    avatar: property.host?.avatar ?? '',
    joinedYear: property.host?.joinedAt ? new Date(property.host.joinedAt).getFullYear() : new Date().getFullYear(),
    superhost: property.host?.superhost ?? property.superhost ?? false,
  },
  reviews: property.reviews ?? [],
  dayPackage: normalizeDayPackage(property.dayPackage),
});

// ── Amenity Toggle Toggle ───────────────────────────────────────────────────
function AmenityPicker({
  selected,
  onChange,
  title = 'Amenities',
}: { selected: string[]; onChange: (a: string[]) => void; title?: string }) {
  const [customInput, setCustomInput] = useState('');
  const toggle = (item: string) =>
    onChange(selected.includes(item) ? selected.filter((x) => x !== item) : [...selected, item]);
  const addCustom = () => {
    const val = customInput.trim();
    if (val && !selected.includes(val)) { onChange([...selected, val]); }
    setCustomInput('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-stone-700">{title}</h4>
        <span className="text-xs text-stone-400">{selected.length} selected</span>
      </div>

      {AMENITY_PRESETS.map((group) => (
        <div key={group.group}>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">{group.group}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => toggle(item)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
                  selected.includes(item)
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                }`}
              >
                {selected.includes(item) && <i className="ri-check-line mr-1 text-xs" />}
                {item}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Custom amenity */}
      <div>
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Add Custom</p>
        <div className="flex gap-2">
          <input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
            className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400"
            placeholder="e.g. Solar Panels, Hammock..."
          />
          <button
            type="button"
            onClick={addCustom}
            className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-sm hover:bg-stone-200 cursor-pointer whitespace-nowrap"
          >Add</button>
        </div>
        {selected.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selected.filter((s) => !AMENITY_PRESETS.flatMap((g) => g.items).includes(s)).map((s) => (
              <span key={s} className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                {s}
                <button type="button" onClick={() => toggle(s)} className="cursor-pointer hover:text-red-500"><i className="ri-close-line" /></button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Photo Manager ─────────────────────────────────────────────────────────
function PhotoManager({
  photos,
  onChange,
  label = 'Photos',
}: { photos: string[]; onChange: (p: string[]) => void; label?: string }) {
  return (
    <ImageUploader
      images={photos.filter(Boolean)}
      onChange={onChange}
      label={label}
      multiple
    />
  );
}

// ── Room Type Editor ──────────────────────────────────────────────────────
function RoomTypeEditor({
  rooms,
  onChange,
}: { rooms: CMSRoomType[]; onChange: (r: CMSRoomType[]) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addRoom = () => {
    const r = emptyRoom();
    onChange([...rooms, r]);
    setExpandedId(r.id);
  };
  const removeRoom = (id: string) => onChange(rooms.filter((r) => r.id !== id));
  const updateRoom = (updated: CMSRoomType) => onChange(rooms.map((r) => r.id === updated.id ? updated : r));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-stone-700">Room Types</h4>
          <p className="text-xs text-stone-400 mt-0.5">{rooms.length} room type{rooms.length !== 1 ? 's' : ''} defined</p>
        </div>
        <button
          type="button"
          onClick={addRoom}
          className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-700 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line" /> Add Room Type
        </button>
      </div>

      {rooms.length === 0 && (
        <div className="py-10 text-center border-2 border-dashed border-stone-200 rounded-2xl">
          <i className="ri-hotel-bed-line text-stone-300 text-3xl block mb-2" />
          <p className="text-stone-400 text-sm">No room types yet</p>
          <p className="text-stone-300 text-xs mt-1">Click &quot;Add Room Type&quot; to define room categories with separate pricing</p>
        </div>
      )}

      <div className="space-y-3">
        {rooms.map((room) => {
          const isOpen = expandedId === room.id;
          return (
            <div key={room.id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              {/* Room header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors"
                onClick={() => setExpandedId(isOpen ? null : room.id)}
              >
                <div className="w-9 h-9 flex items-center justify-center bg-stone-100 rounded-xl flex-shrink-0">
                  <i className="ri-hotel-bed-line text-stone-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-900 text-sm truncate">{room.name || 'Unnamed Room'}</p>
                  <p className="text-xs text-stone-400">
                    {room.bedType} · {room.capacity} guests
                    {room.pricePerNight > 0 && ` · ₹${room.pricePerNight.toLocaleString('en-IN')}/night`}
                    {room.photos.filter(Boolean).length > 0 && ` · ${room.photos.filter(Boolean).length} photo${room.photos.filter(Boolean).length !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeRoom(room.id); }}
                    className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <i className="ri-delete-bin-line text-sm" />
                  </button>
                  <i className={`ri-arrow-down-s-line text-stone-400 text-lg transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Room form */}
              {isOpen && (
                <div className="border-t border-stone-100 px-4 pb-5 pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-stone-500 mb-1.5">Room Type Name <span className="text-red-400">*</span></label>
                      <input
                        value={room.name}
                        onChange={(e) => updateRoom({ ...room, name: e.target.value })}
                        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400"
                        placeholder="e.g. Deluxe Ocean Suite"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1.5">Bed Type</label>
                      <select
                        value={room.bedType}
                        onChange={(e) => updateRoom({ ...room, bedType: e.target.value })}
                        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400 bg-white cursor-pointer"
                      >
                        {BED_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1.5">Total Rooms</label>
                      <input
                        type="number"
                        min={1}
                        value={room.totalRooms ?? 1}
                        onChange={(e) => updateRoom({ ...room, totalRooms: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1.5">Price / Night (₹) <span className="text-red-400">*</span></label>
                      <input
                        type="number"
                        value={room.pricePerNight || ''}
                        onChange={(e) => updateRoom({ ...room, pricePerNight: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400"
                        placeholder="15000"
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1.5">Capacity (Max Guests)</label>
                      <input
                        type="number"
                        value={room.capacity}
                        onChange={(e) => updateRoom({ ...room, capacity: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400"
                        min={1}
                        max={20}
                      />
                    </div>
                    <label className="flex items-center gap-2 self-end px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(room.amenities ?? []).includes(EXTRA_BED_AMENITY)}
                        onChange={(e) => {
                          const amenities = room.amenities ?? [];
                          updateRoom({
                            ...room,
                            amenities: e.target.checked
                              ? Array.from(new Set([...amenities, EXTRA_BED_AMENITY]))
                              : amenities.filter((item) => item !== EXTRA_BED_AMENITY),
                          });
                        }}
                        className="accent-stone-900"
                      />
                      <span>Extra bed available</span>
                    </label>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1.5">Room Size</label>
                      <input
                        value={room.size ?? ''}
                        onChange={(e) => updateRoom({ ...room, size: e.target.value })}
                        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400"
                        placeholder="e.g. 45 sqm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-stone-500 mb-1.5">Room Description</label>
                    <textarea
                      value={room.description}
                      onChange={(e) => updateRoom({ ...room, description: e.target.value })}
                      rows={3}
                      maxLength={500}
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400 resize-none"
                      placeholder="Describe this room type..."
                    />
                  </div>

                  {/* Room photos */}
                  <div className="border-t border-stone-100 pt-4">
                    <PhotoManager
                      photos={room.photos}
                      onChange={(p) => updateRoom({ ...room, photos: p })}
                      label="Room Photos"
                    />
                  </div>

                  {/* Room amenities */}
                  <div className="border-t border-stone-100 pt-4">
                    <AmenityPicker
                      selected={room.amenities}
                      onChange={(a) => updateRoom({ ...room, amenities: a })}
                      title="Room-specific Amenities"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Editor ───────────────────────────────────────────────────────────
export default function PropertiesEditor({ data, onSave, tagOptions, typeOptions, onSaveOptions }: Props) {
  const [properties, setProperties] = useState<CMSProperty[]>(JSON.parse(JSON.stringify(data)));
  const [editing, setEditing] = useState<CMSProperty | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [tab, setTab] = useState<EditorTab>('basic');
  const [saved, setSaved] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>(() => Array.from(new Set([...(tagOptions ?? []), ...defaultPropertyTagOptions])));
  const [availableTypes, setAvailableTypes] = useState<string[]>(() => Array.from(new Set([...(typeOptions ?? []), ...defaultPropertyTypeOptions])));
  const [newTagOption, setNewTagOption] = useState('');
  const [newTypeOption, setNewTypeOption] = useState('');
  const [hosts, setHosts] = useState<HostSummary[]>([]);
  const [selectedHostId, setSelectedHostId] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setAvailableTags(Array.from(new Set([...(tagOptions ?? []), ...defaultPropertyTagOptions])));
  }, [tagOptions]);

  useEffect(() => {
    setAvailableTypes(Array.from(new Set([...(typeOptions ?? []), ...defaultPropertyTypeOptions])));
  }, [typeOptions]);

  useEffect(() => {
    getHosts()
      .then((data) => {
        const list = ((data as { hosts?: HostSummary[] }).hosts ?? []) as HostSummary[];
        setHosts(list);
        setSelectedHostId((current) => current || list[0]?.id || '');
      })
      .catch(() => setHosts([]));
  }, []);

  useEffect(() => {
    getProperties({ status: 'all', limit: 500 }, true)
      .then((response) => {
        const list = ((response as { properties?: ApiPropertyRecord[] }).properties ?? []).map(apiPropertyToCMS);
        if (list.length > 0) {
          setProperties(list);
          setAvailableTags((current) => Array.from(new Set([...current, ...list.flatMap((property) => property.tags ?? [])])));
          setAvailableTypes((current) => Array.from(new Set([...current, ...list.map((property) => property.type).filter(Boolean)])));
        }
      })
      .catch(() => {
        setSaveError('Could not load live database properties. Showing CMS cache until the API is available.');
      });
  }, []);

  const handleEdit = (prop: CMSProperty) => {
    const p = JSON.parse(JSON.stringify(prop)) as CMSProperty;
    if (!p.amenities) p.amenities = [];
    if (!p.roomTypes) p.roomTypes = [];
    if (!p.housePolicies) p.housePolicies = [];
    p.dayPackage = normalizeDayPackage(p.dayPackage);
    setSelectedHostId(p.hostId ?? '');
    setSaveError('');
    setEditing(p);
    setTagsInput(p.tags.join(', '));
    setIsNew(false);
    setTab('basic');
  };

  const handleAdd = () => {
    const p = emptyProperty();
    p.hostId = selectedHostId || hosts[0]?.id || '';
    setEditing(p);
    setTagsInput('');
    setSaveError('');
    setIsNew(true);
    setTab('basic');
  };

  const handleDelete = async (id: string) => {
    try {
      await updateProperty(id, { status: 'inactive' });
      const updated = properties.filter((p) => p.id !== id);
      setProperties(updated);
      onSave(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to delete property');
    }
  };

  const addTagOption = () => {
    const value = newTagOption.trim();
    if (!value) return;
    const nextTags = Array.from(new Set([...availableTags, value]));
    setAvailableTags(nextTags);
    onSaveOptions?.(nextTags, availableTypes);
    setNewTagOption('');
  };

  const addTypeOption = () => {
    const value = newTypeOption.trim().toLowerCase();
    if (!value) return;
    const nextTypes = Array.from(new Set([...availableTypes, value]));
    setAvailableTypes(nextTypes);
    onSaveOptions?.(availableTags, nextTypes);
    if (editing) setEditing({ ...editing, type: value });
    setNewTypeOption('');
  };

  const persistOptions = (tags: string[], type?: string) => {
    const nextTags = Array.from(new Set([...availableTags, ...tags]));
    const nextTypes = Array.from(new Set([...availableTypes, ...(type ? [type] : [])]));
    setAvailableTags(nextTags);
    setAvailableTypes(nextTypes);
    onSaveOptions?.(nextTags, nextTypes);
  };

  const handleSaveEdit = async (options: { stayOpen?: boolean } = {}) => {
    if (!editing) return;
    setSaveError('');
    const hostId = selectedHostId || editing.hostId || hosts[0]?.id;

    if (!hostId) {
      setSaveError('Select a resort owner before saving this property.');
      return;
    }

    const derivedMaxGuests = editing.roomTypes.length > 0
      ? Math.max(1, editing.roomTypes.reduce((total, room) => total + (Number(room.capacity) || 1) * (Number(room.totalRooms) || 1), 0))
      : editing.maxGuests;
    const updated = {
      ...editing,
      hostId,
      maxGuests: derivedMaxGuests,
      superhost: editing.host?.superhost ?? editing.superhost,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      dayPackage: normalizeDayPackage(editing.dayPackage),
    };
    persistOptions(updated.tags, updated.type);

    // Images travel inline (as data URLs) in this JSON body. The production API
    // sits behind Vercel, which rejects request bodies over ~4.5MB with a 413
    // before the server can respond. Surface a clear message instead of letting
    // the save fail with an opaque "Request failed: 413".
    const approxPayloadBytes = JSON.stringify({
      images: updated.images,
      roomTypes: updated.roomTypes,
      addOns: updated.addOns,
      dayPackage: updated.dayPackage,
    }).length;
    if (approxPayloadBytes > 4_200_000) {
      setSaveError(
        'This property has too many or too large photos to save at once. Remove a few images (or split them across fewer rooms/add-ons) and save again.'
      );
      return;
    }

    const exists = properties.find((p) => p.id === updated.id);
    const newList = exists
      ? properties.map((p) => (p.id === updated.id ? updated : p))
      : [...properties, updated];

    try {
      await updateHostProfile(hostId, {
        name: updated.host?.name?.trim() || undefined,
        avatar: updated.host?.avatar?.trim() || undefined,
      });

      let savedProperty: CMSProperty | null = null;
      if (exists) {
        const response = await updateProperty(updated.id, {
          id: updated.id,
          hostId,
          name: updated.name,
          location: updated.location,
          city: updated.city,
          state: updated.state,
          pricePerNight: updated.pricePerNight,
          description: updated.description,
          type: updated.type,
          images: updated.images,
          tags: updated.tags,
          amenities: updated.amenities,
          bedrooms: updated.bedrooms,
          bathrooms: updated.bathrooms,
          maxGuests: updated.maxGuests,
          status: updated.status === 'rejected' ? 'rejected' : 'approved',
          verified: true,
          superhost: updated.superhost,
          isExclusive: updated.isExclusive,
          addOns: updated.addOns,
          dayPackage: updated.dayPackage as any,
          housePolicies: updated.housePolicies,
          roomTypes: updated.roomTypes,
          host: updated.host,
        } as any);
        savedProperty = apiPropertyToCMS(response as ApiPropertyRecord);
      } else {
        const response = await createProperty({
          id: updated.id,
          hostId,
          name: updated.name,
          location: updated.location,
          city: updated.city,
          state: updated.state,
          pricePerNight: updated.pricePerNight,
          description: updated.description,
          type: updated.type,
          images: updated.images,
          tags: updated.tags,
          amenities: updated.amenities,
          bedrooms: updated.bedrooms,
          bathrooms: updated.bathrooms,
          maxGuests: updated.maxGuests,
          status: 'approved',
          verified: true,
          superhost: updated.superhost,
          isExclusive: updated.isExclusive,
          addOns: updated.addOns,
          dayPackage: updated.dayPackage as any,
          housePolicies: updated.housePolicies,
          roomTypes: updated.roomTypes,
          host: updated.host,
        } as any);
        savedProperty = apiPropertyToCMS(response as ApiPropertyRecord);
      }
      const syncedList = savedProperty
        ? (exists
            ? properties.map((p) => (p.id === updated.id ? savedProperty : p))
            : [...properties, savedProperty])
        : newList;
      setProperties(syncedList);
      onSave(syncedList);
      if (options.stayOpen) {
        setEditing(savedProperty ?? updated);
        setIsNew(false);
      } else {
        setEditing(null);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save property');
    }
  };

  const tabs: { id: EditorTab; label: string; icon: string }[] = [
    { id: 'basic', label: 'Basic Info', icon: 'ri-information-line' },
    { id: 'photos', label: 'Photos', icon: 'ri-image-2-line' },
    { id: 'amenities', label: 'Amenities', icon: 'ri-checkbox-circle-line' },
    { id: 'rooms', label: 'Room Types', icon: 'ri-hotel-bed-line' },
    { id: 'policies', label: 'House Policies', icon: 'ri-file-list-3-line' },
    { id: 'addons', label: 'Add-ons', icon: 'ri-gift-line' },
    { id: 'host', label: 'Host Info', icon: 'ri-user-star-line' },
    { id: 'reviews', label: 'Reviews', icon: 'ri-star-line' },
    { id: 'daypackage', label: 'Day Package', icon: 'ri-sun-line' },
  ];

  // ── EDIT FORM ─────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div>
        {/* Edit header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setEditing(null)}
            className="w-9 h-9 flex items-center justify-center bg-stone-100 rounded-lg text-stone-600 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <i className="ri-arrow-left-line" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-stone-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              {isNew ? 'Add New Property' : 'Edit Property'}
            </h2>
            <p className="text-stone-500 text-sm truncate">{editing.name || 'New property'}</p>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-emerald-600 text-sm flex items-center gap-1"><i className="ri-check-line" />Saved</span>}
            <button
              onClick={() => handleSaveEdit({ stayOpen: true })}
              className="flex items-center gap-2 px-4 py-2.5 border border-stone-200 text-stone-700 rounded-xl text-sm font-semibold hover:bg-stone-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-save-3-line" /> Save Tab
            </button>
            <button
              onClick={() => handleSaveEdit()}
              className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-save-line" /> Save Property
            </button>
          </div>
        </div>
        {saveError && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <i className="ri-error-warning-line mr-2" />
            {saveError}
          </div>
        )}

        {/* Tab nav */}
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-6 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                tab === t.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <i className={t.icon} /> {t.label}
            </button>
          ))}
        </div>

        {/* ── BASIC INFO TAB ── */}
        {tab === 'basic' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left */}
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-stone-700">Property Details</h3>
                <div>
                  <label className="block text-xs text-stone-500 mb-1.5">Property Name</label>
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400" placeholder="e.g. Azure Cliff Villa" />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1.5">Full Location</label>
                  <input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400" placeholder="e.g. Candolim Beach, Goa" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1.5">City</label>
                    <input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1.5">State</label>
                    <input value={editing.state} onChange={(e) => setEditing({ ...editing, state: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1.5">Property Type</label>
                  <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400 bg-white cursor-pointer">
                    {availableTypes.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                  <div className="flex gap-2 mt-2">
                    <input
                      value={newTypeOption}
                      onChange={(e) => setNewTypeOption(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTypeOption())}
                      className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400"
                      placeholder="Add new type"
                    />
                    <button type="button" onClick={addTypeOption} className="px-3 py-2 bg-stone-100 text-stone-700 rounded-lg text-xs font-medium hover:bg-stone-200 cursor-pointer whitespace-nowrap">Add</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1.5">Tags (comma-separated)</label>
                  <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400" placeholder="Beachfront, Infinity Pool, Ocean View" />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-2">Selectable Tags</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableTags.map((tag) => (
                      <label key={tag} className="flex items-center gap-2 text-xs text-stone-600 border border-stone-200 rounded-lg px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tagsInput.split(',').map((t) => t.trim()).includes(tag)}
                          onChange={(e) => {
                            const current = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
                            const next = e.target.checked ? Array.from(new Set([...current, tag])) : current.filter((t) => t !== tag);
                            setTagsInput(next.join(', '));
                          }}
                        />
                        {tag}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      value={newTagOption}
                      onChange={(e) => setNewTagOption(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTagOption())}
                      className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400"
                      placeholder="Add new tag"
                    />
                    <button type="button" onClick={addTagOption} className="px-3 py-2 bg-stone-100 text-stone-700 rounded-lg text-xs font-medium hover:bg-stone-200 cursor-pointer whitespace-nowrap">Add</button>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                  <input type="checkbox" checked={editing.isExclusive ?? false} onChange={(e) => setEditing({ ...editing, isExclusive: e.target.checked })} />
                  Triprodeo Exclusive
                </label>
                <div>
                  <label className="block text-xs text-stone-500 mb-1.5">Description</label>
                  <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400 resize-none" rows={5} maxLength={1000} placeholder="Write a detailed description..." />
                  <p className="text-xs text-stone-400 text-right mt-1">{editing.description.length}/1000</p>
                </div>
              </div>
            </div>

            {/* Right */}
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-stone-700">Pricing &amp; Ratings</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1.5">Base Price / Night (₹)</label>
                    <input type="number" value={editing.pricePerNight || ''} onChange={(e) => setEditing({ ...editing, pricePerNight: Number(e.target.value) })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1.5">Original Price (₹)</label>
                    <input type="number" value={editing.originalPrice ?? ''} onChange={(e) => setEditing({ ...editing, originalPrice: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1.5">Rating</label>
                    <input type="number" min={1} max={5} step={0.1} value={editing.rating} onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1.5">Review Count</label>
                    <input type="number" value={editing.reviewCount} onChange={(e) => setEditing({ ...editing, reviewCount: Number(e.target.value) })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-stone-700">Layout</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1.5">Bedrooms</label>
                    <input type="number" min={1} value={editing.bedrooms} onChange={(e) => setEditing({ ...editing, bedrooms: Number(e.target.value) })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1.5">Bathrooms</label>
                    <input type="number" min={1} value={editing.bathrooms} onChange={(e) => setEditing({ ...editing, bathrooms: Number(e.target.value) })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400" />
                  </div>
                </div>
                <p className="text-xs text-stone-400 mt-2">Guest capacity is controlled from Room Types.</p>
                <div className="flex gap-6 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.verified} onChange={(e) => setEditing({ ...editing, verified: e.target.checked })} className="accent-stone-900" />
                    <span className="text-sm text-stone-700">Verified</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.superhost} onChange={(e) => setEditing({ ...editing, superhost: e.target.checked })} className="accent-stone-900" />
                    <span className="text-sm text-stone-700">Top Owner</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PHOTOS TAB ── */}
        {tab === 'photos' && (
          <div className="bg-white rounded-2xl border border-stone-100 p-5">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-stone-700">Property General Photos</h3>
              <p className="text-stone-400 text-xs mt-0.5">These appear in search results, the hero gallery, and at the top of the property page. Add at least 4–5 high-quality photos.</p>
            </div>
            <div className="mt-4">
              <PhotoManager
                photos={editing.images.length > 0 ? editing.images : ['']}
                onChange={(p) => setEditing({ ...editing, images: p })}
                label="Property Photos"
              />
            </div>
          </div>
        )}

        {/* ── AMENITIES TAB ── */}
        {tab === 'amenities' && (
          <div className="bg-white rounded-2xl border border-stone-100 p-5">
            <p className="text-stone-400 text-xs mb-5">These are the property-level amenities shown in the &quot;What This Place Offers&quot; section on the property page.</p>
            <AmenityPicker
              selected={editing.amenities}
              onChange={(a) => setEditing({ ...editing, amenities: a })}
              title="Property Amenities"
            />
          </div>
        )}

        {/* ── ROOMS TAB ── */}
        {tab === 'rooms' && (
          <div className="bg-white rounded-2xl border border-stone-100 p-5">
            <p className="text-stone-400 text-xs mb-5">
              Define room categories with individual pricing, capacity, bed types, per-room photos, and room-specific amenities. These appear as a &quot;Choose Your Room&quot; section on the property detail page.
            </p>
            <RoomTypeEditor
              rooms={editing.roomTypes}
              onChange={(r) => setEditing({ ...editing, roomTypes: r })}
            />
          </div>
        )}

        {/* ── ADD-ONS TAB ── */}
        {tab === 'addons' && (
          <div className="bg-white rounded-2xl border border-stone-100 p-5">
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-stone-700">Add-on Experiences</h3>
              <p className="text-stone-400 text-xs mt-1">Optional extras guests can select when booking. Each add-on has a name, price, uploaded image, and description.</p>
            </div>
            <div className="space-y-4 mb-4">
              {(editing.addOns ?? []).map((addon, idx) => (
                <div key={addon.id} className="bg-stone-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Add-on #{idx + 1}</span>
                    <button type="button" onClick={() => { const u = (editing.addOns ?? []).filter((_, i) => i !== idx); setEditing({ ...editing, addOns: u }); }} className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg cursor-pointer border border-stone-200">
                      <i className="ri-delete-bin-line text-sm" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Name</label>
                      <input value={addon.name} onChange={(e) => { const u = [...(editing.addOns ?? [])]; u[idx] = { ...u[idx], name: e.target.value }; setEditing({ ...editing, addOns: u }); }} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" placeholder="e.g. Couples Spa" />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Price (₹)</label>
                      <input type="number" value={addon.price || ''} onChange={(e) => { const u = [...(editing.addOns ?? [])]; u[idx] = { ...u[idx], price: Number(e.target.value) }; setEditing({ ...editing, addOns: u }); }} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" placeholder="2500" />
                    </div>
                    <div className="col-span-2">
                      <ImageUploader
                        images={addon.image ? [addon.image] : []}
                        onChange={(imgs) => { const u = [...(editing.addOns ?? [])]; u[idx] = { ...u[idx], image: imgs[0] ?? '' }; setEditing({ ...editing, addOns: u }); }}
                        label="Add-on Image"
                        multiple={false}
                        aspectHint="Landscape recommended"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-stone-500 mb-1">Description</label>
                      <input value={addon.description} onChange={(e) => { const u = [...(editing.addOns ?? [])]; u[idx] = { ...u[idx], description: e.target.value }; setEditing({ ...editing, addOns: u }); }} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" placeholder="Short description..." />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {(editing.addOns ?? []).length === 0 && (
              <div className="py-8 px-6 text-center border-2 border-dashed border-stone-200 rounded-2xl mb-4 bg-stone-50/60">
                <i className="ri-gift-line text-stone-300 text-3xl block mb-3" />
                <p className="text-stone-700 text-sm font-semibold mb-1">No Add-ons Added Yet</p>
                <p className="text-stone-400 text-xs max-w-xs mx-auto mb-3">
                  Add-ons are optional extras guests can book alongside their stay — like a couples spa, bonfire night, or private chef dinner. They will appear on the property page for guests to select.
                </p>
                <div className="flex flex-wrap gap-2 justify-center text-xs text-stone-500">
                  {['Couples Spa', 'Private Chef Dinner', 'Bonfire Night', 'Kayaking Session', 'Yoga Class', 'Airport Transfer'].map((ex) => (
                    <span key={ex} className="px-2.5 py-1 bg-white border border-stone-200 rounded-full">{ex}</span>
                  ))}
                </div>
              </div>
            )}
            <button type="button" onClick={() => { const newAddon: CMSAddOn = { id: uid('a'), name: '', price: 0, image: '', description: '' }; setEditing({ ...editing, addOns: [...(editing.addOns ?? []), newAddon] }); }} className="flex items-center gap-2 px-4 py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 cursor-pointer whitespace-nowrap">
              <i className="ri-add-line" /> Add Add-on
            </button>
          </div>
        )}

        {/* ── HOST INFO TAB ── */}
        {tab === 'host' && (
          <div className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-stone-700">Host Information</h3>
              <p className="text-stone-400 text-xs mt-1">This info appears on the property page in the host card section.</p>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1.5">Linked Resort Owner</label>
              <select
                value={selectedHostId}
                onChange={(e) => {
                  setSelectedHostId(e.target.value);
                  setEditing({ ...editing, hostId: e.target.value });
                }}
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400 bg-white"
              >
                <option value="">Select an owner</option>
                {hosts.map((host) => (
                  <option key={host.id} value={host.id}>
                    {host.name} ({host.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-stone-500 mb-1.5">Host Name</label>
                <input value={editing.host?.name ?? ''} onChange={(e) => setEditing({ ...editing, host: { ...(editing.host ?? { avatar: '', joinedYear: new Date().getFullYear(), superhost: false }), name: e.target.value } })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" placeholder="e.g. Priya Mehta" />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1.5">Joined Year</label>
                <input type="number" value={editing.host?.joinedYear ?? 2020} onChange={(e) => setEditing({ ...editing, host: { ...(editing.host ?? { name: '', avatar: '', superhost: false }), joinedYear: Number(e.target.value) } })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" min={2010} max={2030} />
              </div>
              <div className="sm:col-span-2">
                <ImageUploader
                  images={editing.host?.avatar ? [editing.host.avatar] : []}
                  onChange={(imgs) => setEditing({ ...editing, host: { ...(editing.host ?? { name: '', joinedYear: new Date().getFullYear(), superhost: false }), avatar: imgs[0] ?? '' } })}
                  label="Host Avatar"
                  multiple={false}
                  aspectHint="Square recommended"
                />
                {editing.host?.avatar && <img src={editing.host.avatar} alt="host" className="mt-2 w-16 h-16 rounded-full object-cover border border-stone-200" />}
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editing.host?.superhost ?? false} onChange={(e) => setEditing({ ...editing, host: { ...(editing.host ?? { name: '', avatar: '', joinedYear: new Date().getFullYear() }), superhost: e.target.checked } })} className="accent-stone-900" />
                  <span className="text-sm text-stone-700">Top Owner badge</span>
                </label>
              </div>
            </div>
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <h4 className="text-sm font-semibold text-stone-700">Rating Breakdown</h4>
              <p className="text-xs text-stone-400">Set category ratings shown in the Reviews section (1.0 – 5.0)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(['cleanliness', 'communication', 'checkIn', 'accuracy', 'location', 'value'] as const).map((key) => (
                  <div key={key}>
                    <label className="block text-xs text-stone-500 mb-1 capitalize">{key === 'checkIn' ? 'Check-in' : key}</label>
                    <input type="number" min={1} max={5} step={0.1} value={editing.categoryRatings?.[key] ?? 4.5} onChange={(e) => setEditing({ ...editing, categoryRatings: { ...editing.categoryRatings!, [key]: Number(e.target.value) } })} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DAY PACKAGE TAB ── */}
        {tab === 'daypackage' && (() => {
          const dp: CMSDayPackage = normalizeDayPackage(editing.dayPackage);
          const setDp = (val: CMSDayPackage) => setEditing({ ...editing, dayPackage: val });
          const mealPresets = ['Welcome Drink', 'Breakfast', 'Lunch Buffet', 'Evening Snacks', 'Tea & Coffee', 'Dessert'];
          const actPresets = ['Pool Access', 'Kayaking', 'Nature Walk', 'Bonfire', 'Yoga Session', 'Cycling', 'Bird Watching', 'Guided Trek'];
          const facPresets = ['Changing Room', 'Towels', 'Locker', 'Parking', 'WiFi', 'Rest Area', 'First Aid'];
          const packages = dp.packages ?? [];
          const setPackages = (packages: CMSDayPackageOption[]) => setDp({ ...dp, packages });
          const addPackage = () => {
            const next: CMSDayPackageOption = {
              id: uid('dp'),
              title: '',
              description: '',
              timing: dp.timing || '',
              pricePerPerson: dp.pricePerPerson || 0,
              maxGuests: dp.maxGuests,
              meals: [...(dp.meals ?? [])],
              activities: [...(dp.activities ?? [])],
              facilities: [...(dp.facilities ?? [])],
              image: dp.image || '',
            };
            setPackages([...packages, next]);
          };
          const updatePackage = (idx: number, patch: Partial<CMSDayPackageOption>) => {
            const next = [...packages];
            next[idx] = { ...next[idx], ...patch };
            setPackages(next);
          };
          const updatePackageList = (idx: number, key: 'meals' | 'activities' | 'facilities', list: string[]) => {
            updatePackage(idx, { [key]: normalizeStringList(list) });
          };
          const renderListEditor = (
            idx: number,
            key: 'meals' | 'activities' | 'facilities',
            label: string,
            presets: string[],
            values?: string[]
          ) => {
            const list = values ?? [];
            const inputId = `dp-pkg-${idx}-${key}-input`;
            return (
              <div>
                <label className="block text-xs text-stone-500 mb-1.5">{label}</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {list.map((item) => (
                    <span key={item} className="flex items-center gap-1 px-2 py-1 bg-white border border-stone-200 text-stone-600 text-xs rounded-full">
                      {item}
                      <button type="button" onClick={() => updatePackageList(idx, key, list.filter((x) => x !== item))} className="cursor-pointer hover:text-red-500">
                        <i className="ri-close-line" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    id={inputId}
                    className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400"
                    placeholder={`Add ${label.toLowerCase()}...`}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const input = e.target as HTMLInputElement;
                      const value = input.value.trim();
                      if (value && !list.includes(value)) {
                        updatePackageList(idx, key, [...list, value]);
                        input.value = '';
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById(inputId) as HTMLInputElement | null;
                      const value = input?.value.trim() ?? '';
                      if (value && !list.includes(value)) {
                        updatePackageList(idx, key, [...list, value]);
                        if (input) input.value = '';
                      }
                    }}
                    className="px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-xs font-medium hover:bg-stone-50 cursor-pointer whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {presets.filter((preset) => !list.includes(preset)).slice(0, 6).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => updatePackageList(idx, key, [...list, preset])}
                      className="px-2 py-1 text-xs border border-stone-200 rounded-lg text-stone-500 hover:bg-white cursor-pointer whitespace-nowrap"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            );
          };
          return (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-stone-100 p-5">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-700">Enable Day Package</h3>
                    <p className="text-stone-400 text-xs mt-0.5">Allow guests to visit for a day without overnight stay</p>
                  </div>
                  <button onClick={() => setDp({ ...dp, enabled: !dp.enabled })} className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${dp.enabled ? 'bg-stone-900' : 'bg-stone-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${dp.enabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
              {dp.enabled && (
                <>
                  <div className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-stone-700">Multiple Day Packages</h3>
                        <p className="text-stone-400 text-xs mt-1">Add variants such as half-day, full-day, pool access, or meal-inclusive packages.</p>
                      </div>
                      <button type="button" onClick={addPackage} className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-700 cursor-pointer whitespace-nowrap">
                        <i className="ri-add-line" /> Add Package
                      </button>
                    </div>
                    {packages.length === 0 && (
                      <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-center text-sm text-stone-400">
                        Add at least one day package with its own timing, price, image, meals, activities and facilities.
                      </div>
                    )}
                    {packages.map((pkg, idx) => (
                      <div key={pkg.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Package #{idx + 1}</span>
                          <button type="button" onClick={() => setPackages(packages.filter((_, i) => i !== idx))} className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg cursor-pointer">
                            <i className="ri-delete-bin-line text-sm" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-stone-500 mb-1.5">Package Name</label>
                            <input value={pkg.title} onChange={(e) => updatePackage(idx, { title: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" placeholder="e.g. Full Day Pool Package" />
                          </div>
                          <div>
                            <label className="block text-xs text-stone-500 mb-1.5">Timing</label>
                            <input value={pkg.timing ?? ''} onChange={(e) => updatePackage(idx, { timing: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" placeholder="e.g. 10 AM - 5 PM" />
                          </div>
                          <div>
                            <label className="block text-xs text-stone-500 mb-1.5">Price Per Person (₹)</label>
                            <input type="number" value={pkg.pricePerPerson || ''} onChange={(e) => updatePackage(idx, { pricePerPerson: Number(e.target.value) })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" />
                          </div>
                          <div>
                            <label className="block text-xs text-stone-500 mb-1.5">Max Guests</label>
                            <input type="number" value={pkg.maxGuests || ''} onChange={(e) => updatePackage(idx, { maxGuests: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs text-stone-500 mb-1.5">Description</label>
                            <textarea value={pkg.description ?? ''} onChange={(e) => updatePackage(idx, { description: e.target.value })} rows={2} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400 resize-none" />
                          </div>
                          <div className="sm:col-span-2">
                            <ImageUploader
                              images={pkg.image ? [pkg.image] : []}
                              onChange={(imgs) => updatePackage(idx, { image: imgs[0] ?? '' })}
                              label="Package Variant Image"
                              multiple={false}
                              aspectHint="Optional. Falls back to main package image."
                            />
                          </div>
                          <div className="sm:col-span-2 grid grid-cols-1 lg:grid-cols-3 gap-3 border-t border-stone-200 pt-3">
                            {renderListEditor(idx, 'meals', 'Meals', mealPresets, pkg.meals ?? [])}
                            {renderListEditor(idx, 'activities', 'Activities', actPresets, pkg.activities ?? [])}
                            {renderListEditor(idx, 'facilities', 'Facilities', facPresets, pkg.facilities ?? [])}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ── REVIEWS TAB ── */}
        {tab === 'reviews' && (
          <div className="bg-white rounded-2xl border border-stone-100 p-5">
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-stone-700">Guest Reviews</h3>
              <p className="text-stone-400 text-xs mt-1">Reviews shown on the property page. Add realistic guest reviews to build trust.</p>
            </div>
            <div className="space-y-4 mb-4">
              {(editing.reviews ?? []).map((review, idx) => (
                <div key={review.id} className="bg-stone-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Review #{idx + 1}</span>
                    <button type="button" onClick={() => { const u = (editing.reviews ?? []).filter((_, i) => i !== idx); setEditing({ ...editing, reviews: u }); }} className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg cursor-pointer border border-stone-200">
                      <i className="ri-delete-bin-line text-sm" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Guest Name</label>
                      <input value={review.user} onChange={(e) => { const u = [...(editing.reviews ?? [])]; u[idx] = { ...u[idx], user: e.target.value }; setEditing({ ...editing, reviews: u }); }} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" placeholder="e.g. Ananya Sharma" />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Location</label>
                      <input value={review.location} onChange={(e) => { const u = [...(editing.reviews ?? [])]; u[idx] = { ...u[idx], location: e.target.value }; setEditing({ ...editing, reviews: u }); }} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" placeholder="Mumbai" />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Date</label>
                      <input value={review.date} onChange={(e) => { const u = [...(editing.reviews ?? [])]; u[idx] = { ...u[idx], date: e.target.value }; setEditing({ ...editing, reviews: u }); }} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" placeholder="March 2025" />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Rating (1-5)</label>
                      <input type="number" min={1} max={5} value={review.rating} onChange={(e) => { const u = [...(editing.reviews ?? [])]; u[idx] = { ...u[idx], rating: Number(e.target.value) }; setEditing({ ...editing, reviews: u }); }} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Guest Avatar</label>
                      <input value={review.avatar} onChange={(e) => { const u = [...(editing.reviews ?? [])]; u[idx] = { ...u[idx], avatar: e.target.value }; setEditing({ ...editing, reviews: u }); }} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400" placeholder="https://..." />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-stone-500 mb-1">Review Text</label>
                      <textarea value={review.text} onChange={(e) => { const u = [...(editing.reviews ?? [])]; u[idx] = { ...u[idx], text: e.target.value }; setEditing({ ...editing, reviews: u }); }} rows={3} maxLength={500} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400 resize-none" placeholder="Write the guest review..." />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {(editing.reviews ?? []).length === 0 && (
              <div className="py-8 text-center border-2 border-dashed border-stone-200 rounded-2xl mb-4">
                <i className="ri-star-line text-stone-300 text-3xl block mb-2" />
                <p className="text-stone-400 text-sm">No reviews yet. Add guest reviews to build trust.</p>
              </div>
            )}
            <button type="button" onClick={() => { const newReview: CMSPropertyReview = { id: uid('rev'), user: '', avatar: '', location: '', date: '', rating: 5, text: '' }; setEditing({ ...editing, reviews: [...(editing.reviews ?? []), newReview] }); }} className="flex items-center gap-2 px-4 py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 cursor-pointer whitespace-nowrap">
              <i className="ri-add-line" /> Add Review
            </button>
          </div>
        )}

        {/* ── POLICIES TAB ── */}
        {tab === 'policies' && (
          <div className="bg-white rounded-2xl border border-stone-100 p-5">
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-stone-700">House Policies</h3>
              <p className="text-stone-400 text-xs mt-1">
                These policies are shown as bullet points on the property page under &quot;House Policies&quot;. Add each rule as a separate item.
              </p>
            </div>

            {/* Existing policies list */}
            <div className="space-y-2 mb-4">
              {(editing.housePolicies ?? []).map((policy, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-6 h-6 mt-2 flex items-center justify-center bg-stone-100 rounded-full">
                    <i className="ri-circle-fill text-stone-400" style={{ fontSize: '6px' }} />
                  </div>
                  <input
                    value={policy}
                    onChange={(e) => {
                      const updated = [...(editing.housePolicies ?? [])];
                      updated[idx] = e.target.value;
                      setEditing({ ...editing, housePolicies: updated });
                    }}
                    className="flex-1 px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400"
                    placeholder="e.g. No smoking inside the property"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (editing.housePolicies ?? []).filter((_, i) => i !== idx);
                      setEditing({ ...editing, housePolicies: updated });
                    }}
                    className="flex-shrink-0 w-9 h-9 mt-0.5 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg cursor-pointer transition-colors border border-stone-200"
                  >
                    <i className="ri-delete-bin-line text-sm" />
                  </button>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {(editing.housePolicies ?? []).length === 0 && (
              <div className="py-8 text-center border-2 border-dashed border-stone-200 rounded-2xl mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-stone-50 rounded-xl mx-auto mb-3">
                  <i className="ri-file-list-3-line text-stone-300 text-2xl" />
                </div>
                <p className="text-stone-400 text-sm">No policies added yet</p>
                <p className="text-stone-300 text-xs mt-1">Click &quot;Add Policy&quot; to define house rules for your guests</p>
              </div>
            )}

            {/* Add policy button */}
            <button
              type="button"
              onClick={() => {
                const updated = [...(editing.housePolicies ?? []), ''];
                setEditing({ ...editing, housePolicies: updated });
              }}
              className="flex items-center gap-2 px-4 py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line" /> Add Policy
            </button>

            {/* Preset policies */}
            <div className="mt-6 pt-5 border-t border-stone-100">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Quick Add Presets</p>
              <div className="flex flex-wrap gap-2">
                {[
                  'Check-in after 2:00 PM, Check-out before 11:00 AM',
                  'No smoking inside the property',
                  'Pets are not allowed',
                  'Parties and events require prior approval',
                  'Quiet hours from 10:00 PM to 8:00 AM',
                  'Valid ID required at check-in',
                  'No outside food or beverages allowed',
                  'Security deposit collected at check-in',
                  'Children under 12 must be supervised at all times',
                  'Guests are responsible for any property damage',
                ].map((preset) => {
                  const already = (editing.housePolicies ?? []).includes(preset);
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={already}
                      onClick={() => {
                        if (!already) {
                          setEditing({ ...editing, housePolicies: [...(editing.housePolicies ?? []), preset] });
                        }
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                        already
                          ? 'bg-stone-50 text-stone-300 border-stone-100 cursor-default'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:bg-stone-50'
                      }`}
                    >
                      {already && <i className="ri-check-line mr-1 text-emerald-500" />}
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-stone-900" style={{ fontFamily: "'Playfair Display', serif" }}>Properties</h2>
          <p className="text-stone-500 text-sm mt-0.5">{properties.length} propert{properties.length !== 1 ? 'ies' : 'y'} listed</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-emerald-600 text-sm flex items-center gap-1"><i className="ri-check-line" />Saved!</span>}
          <button onClick={handleAdd} className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap">
            <i className="ri-add-line" /> Add Property
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {properties.map((prop) => (
          <div key={prop.id} className="bg-white rounded-xl border border-stone-100 p-4 flex items-center gap-4">
            <div className="w-20 h-16 rounded-lg overflow-hidden shrink-0 bg-stone-100">
              {prop.images[0] && <img src={prop.images[0]} alt={prop.name} className="w-full h-full object-cover object-top" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-sm font-semibold text-stone-900 truncate">{prop.name}</span>
                {prop.verified && <span className="shrink-0 text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">Verified</span>}
                {prop.superhost && <span className="shrink-0 text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">Top Owner</span>}
              </div>
              <div className="text-xs text-stone-400">{prop.location}</div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-stone-600 font-medium">₹{prop.pricePerNight.toLocaleString()}/night</span>
                <span className="text-xs text-stone-400">{prop.bedrooms} bed · {prop.bathrooms} bath · {prop.maxGuests} guests</span>
                {(prop.roomTypes?.length ?? 0) > 0 && (
                  <span className="text-xs text-amber-600 font-medium flex items-center gap-0.5">
                    <i className="ri-hotel-bed-line" /> {prop.roomTypes.length} room type{prop.roomTypes.length !== 1 ? 's' : ''}
                  </span>
                )}
                {(prop.amenities?.length ?? 0) > 0 && (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
                    <i className="ri-checkbox-circle-line" /> {prop.amenities.length} amenities
                  </span>
                )}
                {(prop.housePolicies?.length ?? 0) > 0 && (
                  <span className="text-xs text-stone-500 font-medium flex items-center gap-0.5">
                    <i className="ri-file-list-3-line" /> {prop.housePolicies.length} policies
                  </span>
                )}
                <span className="flex items-center gap-0.5 text-xs text-amber-600"><i className="ri-star-fill text-xs" />{prop.rating}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => handleEdit(prop)} className="w-9 h-9 flex items-center justify-center bg-stone-100 rounded-lg text-stone-600 hover:bg-stone-200 transition-colors cursor-pointer">
                <i className="ri-edit-line text-sm" />
              </button>
              <button onClick={() => handleDelete(prop.id)} className="w-9 h-9 flex items-center justify-center bg-red-50 rounded-lg text-red-500 hover:bg-red-100 transition-colors cursor-pointer">
                <i className="ri-delete-bin-line text-sm" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
