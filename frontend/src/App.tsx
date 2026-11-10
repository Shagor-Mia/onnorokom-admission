import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminPage } from './pages/AdminPage';
import { ApplicationPage } from './pages/ApplicationPage';
import { ClassListPage } from './pages/ClassListPage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ClassListPage />} />
        <Route path="applications/:holdId" element={<ApplicationPage />} />
        <Route path="my-applications" element={<MyApplicationsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route
          path="*"
          element={
            <div className="empty">
              <p>পেজটি পাওয়া যায়নি।</p>
              <Link to="/">Class তালিকায় ফিরে যান</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
