import { useEffect, useMemo, useState } from 'react';
import { CMSDayPackage } from '@/pages/admin/types';
import DayPackageEnquiryModal from './DayPackageEnquiryModal';

interface Props {
  dayPackage: CMSDayPackage;
  propertyId: string;
  propertyName: string;
}

export default function DayPackageSection({ dayPackage, propertyId, propertyName }: Props) {
  const [showModal, setShowModal] = useState(false);
  const packages = useMemo(() => dayPackage.packages ?? [], [dayPackage.packages]);
  const [activePackageId, setActivePackageId] = useState(packages[0]?.id ?? 'main');
  useEffect(() => {
    if (packages.length > 0 && !packages.some((pkg) => pkg.id === activePackageId)) {
      setActivePackageId(packages[0].id);
    }
  }, [activePackageId, packages]);
  if (!dayPackage.enabled) return null;
  const activePackage = packages.find((pkg) => pkg.id === activePackageId);
  // Per-package details are authoritative; fall back to legacy single-package
  // fields only for older properties that predate multiple day packages.
  const display = {
    image: activePackage?.image || dayPackage.image,
    timing: activePackage?.timing || dayPackage.timing,
    pricePerPerson: activePackage?.pricePerPerson || dayPackage.pricePerPerson,
    description: activePackage?.description || dayPackage.description,
    meals: activePackage?.meals?.length ? activePackage.meals : dayPackage.meals,
    activities: activePackage?.activities?.length ? activePackage.activities : dayPackage.activities,
    facilities: activePackage?.facilities?.length ? activePackage.facilities : dayPackage.facilities,
  };
  const bookingPackage = {
    timing: activePackage?.timing || dayPackage.timing || 'Full Day',
    pricePerPerson: activePackage?.pricePerPerson || dayPackage.pricePerPerson,
    maxGuests: activePackage?.maxGuests ?? dayPackage.maxGuests,
  };

  const groups = [
    {
      icon: 'ri-restaurant-2-line',
      label: 'Meals Included',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      items: display.meals,
    },
    {
      icon: 'ri-run-line',
      label: 'Activities',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      items: display.activities,
    },
    {
      icon: 'ri-building-4-line',
      label: 'Facilities',
      color: 'text-stone-600',
      bg: 'bg-stone-50',
      border: 'border-stone-100',
      items: display.facilities,
    },
  ];

  return (
    <div className="border-t border-stone-100 pt-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 flex items-center justify-center bg-amber-100 rounded-lg">
          <i className="ri-sun-line text-amber-600 text-sm" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-900" style={{ fontFamily: "'Playfair Display', serif" }}>
            Day Package
          </h2>
          <p className="text-stone-400 text-xs mt-0.5">No overnight stay required — experience {propertyName} for a day</p>
        </div>
        <span className="ml-auto shrink-0 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-full">
          Day Outing Available
        </span>
      </div>

      {/* Hero card */}
      <div className="mt-5 rounded-2xl overflow-hidden border border-stone-100">
        {display.image && (
          <div className="w-full h-52 overflow-hidden">
            <img
              src={display.image}
              alt="Day Package"
              className="w-full h-full object-cover object-top"
            />
          </div>
        )}
        <div className="p-5 bg-stone-50">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 text-stone-700 text-sm">
              <i className="ri-time-line text-stone-400" />
              <span className="font-medium">{display.timing || 'Timing not specified'}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-stone-900">
                &#x20B9;{(display.pricePerPerson || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-stone-500 text-sm">/ person</span>
            </div>
          </div>
          {display.description && (
            <p className="text-stone-600 text-sm leading-relaxed mb-4">{display.description}</p>
          )}
        </div>
      </div>

      {packages.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-stone-900 mb-3">Choose a Day Package</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {packages.map((pkg) => {
              const selected = activePackageId === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setActivePackageId(pkg.id)}
                  className={`text-left rounded-2xl border p-4 transition-colors cursor-pointer ${
                    selected ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:border-stone-400 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-900 text-sm">{pkg.title || 'Day Package'}</p>
                      <p className="text-xs text-stone-500 mt-1">{pkg.timing || dayPackage.timing || 'Full Day'}</p>
                    </div>
                    <span className="text-sm font-bold text-stone-900">₹{(pkg.pricePerPerson || dayPackage.pricePerPerson).toLocaleString('en-IN')}</span>
                  </div>
                  {pkg.description && <p className="text-xs text-stone-500 mt-2 line-clamp-2">{pkg.description}</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Inclusions grid */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {groups.map((group) => (
          group.items.length > 0 && (
            <div key={group.label} className={`rounded-2xl border ${group.border} ${group.bg} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 flex items-center justify-center rounded-lg bg-white`}>
                  <i className={`${group.icon} ${group.color} text-sm`} />
                </div>
                <span className="text-sm font-semibold text-stone-800">{group.label}</span>
              </div>
              <ul className="space-y-1.5">
                {group.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                    <i className="ri-checkbox-circle-fill text-emerald-500 text-xs mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )
        ))}
      </div>

      {/* CTA */}
      <div className="mt-5 flex items-center gap-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
        <div className="w-10 h-10 flex items-center justify-center bg-amber-100 rounded-xl shrink-0">
          <i className="ri-sun-line text-amber-600 text-lg" />
        </div>
        <div className="flex-1">
          <p className="text-stone-900 font-semibold text-sm">Interested in a Day Visit?</p>
          <p className="text-stone-500 text-xs mt-0.5">Pick your date and group size — host will confirm within 24 hrs</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap"
        >
          Book Day Package
        </button>
      </div>

      {showModal && (
        <DayPackageEnquiryModal
          propertyId={propertyId}
          propertyName={propertyName}
          pricePerPerson={bookingPackage.pricePerPerson}
          timing={bookingPackage.timing}
          maxGuests={bookingPackage.maxGuests}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
