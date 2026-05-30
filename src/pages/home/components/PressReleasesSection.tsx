import { loadCMSData } from '@/pages/admin/cmsStore';
import { CMSPressRelease } from '@/pages/admin/types';

const fallbackReleases: CMSPressRelease[] = [
  { id: 'pr1', date: 'Apr 2026', title: 'Triprodeo expands curated stays across India', source: 'Triprodeo Newsroom' },
  { id: 'pr2', date: 'Mar 2026', title: 'New host tools launch for premium resort partners', source: 'Platform Update' },
  { id: 'pr3', date: 'Feb 2026', title: 'AI Trip Planner adds real-time property recommendations', source: 'Product Brief' },
];

export default function PressReleasesSection() {
  const releases = (loadCMSData().pressReleases ?? fallbackReleases).filter((release) => release.title.trim()).slice(0, 3);

  if (releases.length === 0) return null;

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-stone-400 text-xs uppercase tracking-widest font-semibold mb-2">Newsroom</p>
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              Press Releases
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {releases.map((release) => {
            const card = (
              <article className="h-full border border-stone-200 rounded-2xl p-5 bg-stone-50 hover:bg-white hover:shadow-sm transition-all">
                <p className="text-xs text-stone-400 font-semibold mb-3">{release.date}</p>
                <h3 className="text-stone-900 font-semibold leading-snug mb-3">{release.title}</h3>
                <p className="text-stone-500 text-sm">{release.source}</p>
              </article>
            );

            return release.url ? (
              <a key={release.id} href={release.url} target="_blank" rel="noreferrer" className="block">{card}</a>
            ) : (
              <div key={release.id}>{card}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
