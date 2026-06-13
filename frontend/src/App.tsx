import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import LoginPage from "./pages/LoginPage";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Layout from "./components/Layout";

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Array<"STUDENT" | "TEACHER" | "SUPERADMIN">;
}) {
  const { user, loading } = useAuth();

  if (loading) return <div className="center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            user?.role === "STUDENT" ? (
              <StudentDashboard />
            ) : user?.role === "TEACHER" ? (
              <TeacherDashboard />
            ) : (
              <AdminDashboard />
            )
          }
        />
      </Route>
    </Routes>
  );
}
