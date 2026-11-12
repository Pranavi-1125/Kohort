import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { firebaseConfigured } from './firebase';
import Layout from './components/Layout';
import SetupScreen from './components/SetupScreen';
import { Spinner, ErrorBox } from './components/ui';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Planner = lazy(() => import('./pages/Planner'));
const Assignments = lazy(() => import('./pages/Assignments'));
const Focus = lazy(() => import('./pages/Focus'));
const GroupSession = lazy(() => import('./pages/GroupSession'));
const Rooms = lazy(() => import('./pages/Rooms'));
const RoomDetail = lazy(() => import('./pages/RoomDetail'));
const Messages = lazy(() => import('./pages/Messages'));
const Profile = lazy(() => import('./pages/Profile'));

function Protected({ children }) {
  const { firebaseUser, user, loading, profileError, retryProfile, logout } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-screen"><Spinner /></div>;
  if (!firebaseUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (profileError) {
    return (
      <div className="center-screen"><div className="stack" style={{ maxWidth: 460 }}>
        <ErrorBox message={profileError} onRetry={retryProfile} />
        <button className="btn btn-ghost" onClick={logout}>Sign out</button>
      </div></div>
    );
  }
  if (!user) return <div className="center-screen"><Spinner /></div>;
  return children;
}

export default function App() {
  if (!firebaseConfigured) return <SetupScreen />;
  return (
    <Suspense fallback={<div className="center-screen"><Spinner /></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="planner" element={<Planner />} />
          <Route path="assignments" element={<Assignments />} />
          <Route path="focus" element={<Focus />} />
          <Route path="focus/group/:id" element={<GroupSession />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="rooms/:id" element={<RoomDetail />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:id" element={<Messages />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
