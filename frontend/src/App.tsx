import { Link, Route, Routes } from 'react-router-dom';
import { EmptyState } from './components/Alert';
import { Layout } from './components/Layout';
import { AdminPage } from './pages/AdminPage';
import { ApplicationPage } from './pages/ApplicationPage';
import { ClassListPage } from './pages/ClassListPage';
import { CreateClassPage } from './pages/CreateClassPage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ClassListPage />} />
        <Route path="applications/:holdId" element={<ApplicationPage />} />
        <Route path="my-applications" element={<MyApplicationsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="admin/classes/new" element={<CreateClassPage />} />
        <Route
          path="*"
          element={
            <EmptyState icon="explore_off" title="পেজটি পাওয়া যায়নি">
              <Link to="/" className="btn-primary">
                Class তালিকায় ফিরে যান
              </Link>
            </EmptyState>
          }
        />
      </Route>
    </Routes>
  );
}
