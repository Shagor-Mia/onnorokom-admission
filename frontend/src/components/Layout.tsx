import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { StudentIdBar } from './StudentIdBar';

const links = [
  { to: '/', label: 'ভর্তি কার্যক্রম', short: 'ক্যাটালগ', icon: 'grid_view', end: true },
  { to: '/my-applications', label: 'আমার আবেদনসমূহ', short: 'আবেদনসমূহ', icon: 'description', end: false },
  { to: '/admin', label: 'স্কুল অ্যাডমিন', short: 'অ্যাডমিন', icon: 'admin_panel_settings', end: false },
];

/** Header, student ID box, page content, footer and (on phones) a bottom navigation bar. */
export function Layout() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-space-md py-space-sm text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        মূল অংশে যান
      </a>

      <header className="sticky top-0 z-40 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="bg-primary px-gutter-mobile py-space-xs text-on-primary md:px-gutter">
          <div className="mx-auto flex max-w-page items-center justify-between gap-space-md text-label-sm">
            <span>
              {isAdmin ? 'স্কুল অ্যাডমিন • শ্রেণি ও আসন ব্যবস্থাপনা' : 'অনলাইন ভর্তি • আগে আবেদন করলে আগে পাবে • কোনো lottery নেই'}
            </span>
            <span className="hidden items-center gap-1 sm:inline-flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-secondary-fixed-dim" /> Seat সংখ্যা সরাসরি হালনাগাদ
            </span>
          </div>
        </div>

        <div className="page flex h-16 items-center justify-between gap-space-md md:h-20">
          <NavLink to="/" className="flex min-w-0 items-center gap-space-sm md:gap-space-md" aria-label="বিদ্যালয় ভর্তি পোর্টাল — হোম">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Icon name="school" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-space-xs">
                <span className="truncate text-headline-sm text-on-surface">বিদ্যালয় ভর্তি পোর্টাল</span>
                {isAdmin ? (
                  <span className="pill hidden bg-primary text-on-primary sm:inline-flex">অ্যাডমিন প্যানেল</span>
                ) : (
                  <span className="pill hidden bg-secondary-container text-on-secondary-container lg:inline-flex">
                    প্রথম আসলে প্রথম পাবেন (FCFS)
                  </span>
                )}
              </span>
              <span className="truncate text-label-md text-on-surface-variant">
                {isAdmin ? 'প্রশাসনিক প্যানেল (Admin Portal)' : 'অনলাইন ভর্তি আবেদন ও আসন সংরক্ষণ'}
              </span>
            </span>
          </NavLink>

          <nav aria-label="প্রধান মেনু" className="hidden md:block">
            <ul className="flex items-center gap-space-xs">
              {links.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `rounded-lg px-space-md py-space-sm text-label-lg transition-colors ${
                        isActive ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="border-t border-surface-container bg-surface-container-low">
          <div className="page py-space-sm">
            <StudentIdBar />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="page flex-1 py-space-lg outline-none md:py-space-xl">
        <Outlet />
      </main>

      <footer className="mb-16 border-t border-surface-container bg-surface-container-low md:mb-0">
        <div className="page flex flex-col gap-space-sm py-space-lg text-body-sm text-on-surface-variant md:flex-row md:items-center md:justify-between">
          <p className="font-semibold text-on-surface">বিদ্যালয় ভর্তি পোর্টাল — Demo</p>
          <p>
            “ভর্তি ফি দিন” একটি simulated payment — কোনো আসল লেনদেন হয় না। জন্ম নিবন্ধন নম্বর শুধু শিক্ষার্থী চিহ্নিত করতে
            ব্যবহৃত হয়; এটি সরকারি যাচাই নয়।
          </p>
        </div>
      </footer>

      <nav
        aria-label="মোবাইল মেনু"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-container bg-surface-container-lowest md:hidden"
      >
        <ul className="grid grid-cols-3">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-space-sm text-label-sm ${
                    isActive ? 'text-secondary' : 'text-on-surface-variant'
                  }`
                }
              >
                <Icon name={link.icon} />
                {link.short}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
