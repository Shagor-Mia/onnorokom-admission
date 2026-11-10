import { NavLink, Outlet } from 'react-router-dom';
import { StudentIdBar } from './StudentIdBar';

const links = [
  { to: '/', label: 'Class তালিকা', end: true },
  { to: '/my-applications', label: 'আমার আবেদন', end: false },
  { to: '/admin', label: 'School admin', end: false },
];

export function Layout() {
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        মূল অংশে যান
      </a>
      <header className="header">
        <div className="header__inner container">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true">
              ভ
            </span>
            <div>
              <p className="brand__title">বিদ্যালয় ভর্তি পোর্টাল</p>
              <p className="brand__subtitle">আগে আবেদন করলে আগে পাবে · কোনো lottery নেই</p>
            </div>
          </div>
          <nav aria-label="প্রধান মেনু">
            <ul className="nav">
              {links.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="container">
          <StudentIdBar />
        </div>
      </header>
      <main id="main" className="container main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="footer container">
        <p>
          Demo পোর্টাল: “ভর্তি ফি দিন” একটি simulated payment — কোনো আসল লেনদেন হয় না। জন্ম নিবন্ধন নম্বর
          শুধু শিক্ষার্থী চিহ্নিত করতে ব্যবহৃত হয়, এটি নিরাপদ পরিচয় যাচাই নয়।
        </p>
      </footer>
    </div>
  );
}
