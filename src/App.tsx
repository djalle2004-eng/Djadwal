import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { Calendar, Users, BookOpen, DoorOpen, Users2, CalendarClock, BookCheck, Search, ClipboardList, Layers, Printer, CalendarDays, ArrowLeftRight, Move, UserCog, Database, LogOut, User, ScrollText } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Professors from "./pages/Professors";
import Courses from "./pages/Courses";
import Rooms from "./pages/Rooms";
import Groups from "./pages/Groups";
import Sessions from "./pages/Sessions";
import CourseAssignments from "./pages/CourseAssignments";
import AvailableRooms from "./pages/AvailableRooms";
import ProfessorWorkload from "./pages/ProfessorWorkload";
import AcademicYears from "./pages/AcademicYears";
import TestLucide from "./components/TestLucide"; // Test d'icône Lucide
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { UserAuth } from "./context/AuthContext";
import { AcademicYearProvider } from "./context/AcademicYearContext";
import { AssignmentProvider } from "./context/AssignmentContext";
import Schedule from './pages/Schedule';
import GroupSchedules from './pages/GroupSchedules';
import PrintSettings from './pages/PrintSettingsNew';
import SessionSwap from './pages/SessionSwap';
import SessionMove from './pages/SessionMove';
import UsersPage from './pages/Users';
import BackupRestore from './pages/BackupRestore';
import AuditLog from './pages/AuditLog';
import DatabaseSettings from './pages/DatabaseSettings';


const navigation = [
  { name: "لوحة التحكم", href: "/", icon: Calendar, resource: null }, // الداشبورد متاح للجميع
  { name: "السنوات الدراسية", href: "/academic-years", icon: Layers, resource: "academic_years" },
  { name: "الأساتذة", href: "/professors", icon: Users, resource: "professors" },
  { name: "المقاييس", href: "/courses", icon: BookOpen, resource: "courses" },
  { name: "التكاليف", href: "/course-assignments", icon: BookCheck, resource: "sessions" },
  { name: "القاعات", href: "/rooms", icon: DoorOpen, resource: "rooms" },
  { name: "الأفواج والتخصصات", href: "/groups", icon: Users2, resource: "groups" },
  { name: "الحصص", href: "/sessions", icon: CalendarClock, resource: "sessions" },
  { name: "القاعات المتاحة", href: "/available-rooms", icon: Search, resource: "rooms" },
  { name: "عبء العمل للأساتذة", href: "/professor-workload", icon: ClipboardList, resource: "reports" },
  { name: "الجدول الزمني", href: "/schedule", icon: Calendar, resource: "sessions" },
  { name: "جداول الأفواج", href: "/group-schedules", icon: CalendarDays, resource: "reports" },
  { name: "تبديل الحصص", href: "/session-swap", icon: ArrowLeftRight, resource: "sessions" },
  { name: "نقل الحصص", href: "/session-move", icon: Move, resource: "sessions" },
  { name: "إعدادات الطباعة", href: "/print-settings", icon: Printer, resource: "settings" },
  { name: "إدارة المستخدمين", href: "/users", icon: UserCog, resource: "users", adminOnly: true },
  { name: "النسخ الاحتياطي", href: "/backup", icon: Database, resource: "backup", adminOnly: true },
  { name: "سجل الأنشطة", href: "/audit-log", icon: ScrollText, resource: "users", adminOnly: true },
];

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, signOut } = UserAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        <Sidebar navigation={navigation} />
        <div className="flex-1 flex flex-col">
          {/* Header Bar */}
          <header className="bg-white border-b border-gray-200 px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 space-x-reverse">
                <User className="h-5 w-5 text-gray-500" />
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.full_name || user?.username || 'مستخدم'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user?.role === 'admin' ? 'مدير النظام' : user?.role || 'مستخدم'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 space-x-reverse px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </header>
          
          {/* Main Content */}
          <main className="flex-1 p-8">
            <TestLucide />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

const routes = [
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout><Dashboard /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/academic-years",
    element: (
      <ProtectedRoute>
        <Layout><AcademicYears /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/professors",
    element: (
      <ProtectedRoute>
        <Layout><Professors /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/courses",
    element: (
      <ProtectedRoute>
        <Layout><Courses /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/course-assignments",
    element: (
      <ProtectedRoute>
        <Layout><CourseAssignments /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/rooms",
    element: (
      <ProtectedRoute>
        <Layout><Rooms /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/groups",
    element: (
      <ProtectedRoute>
        <Layout><Groups /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/sessions",
    element: (
      <ProtectedRoute>
        <Layout><Sessions /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/available-rooms",
    element: (
      <ProtectedRoute>
        <Layout><AvailableRooms /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/professor-workload",
    element: (
      <ProtectedRoute>
        <Layout><ProfessorWorkload /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/schedule",
    element: (
      <ProtectedRoute>
        <Layout><Schedule /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/group-schedules",
    element: (
      <ProtectedRoute>
        <Layout><GroupSchedules /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/session-swap",
    element: (
      <ProtectedRoute>
        <Layout><SessionSwap /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/session-move",
    element: (
      <ProtectedRoute>
        <Layout><SessionMove /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/print-settings",
    element: (
      <ProtectedRoute>
        <Layout><PrintSettings /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/users",
    element: (
      <ProtectedRoute>
        <Layout><UsersPage /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/database-settings",
    element: <DatabaseSettings />, // لا يحتاج لـ ProtectedRoute أو Layout
  },
  // المسار الافتراضي - توجيه إلى الصفحة الرئيسية
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
  {
    path: "/backup",
    element: (
      <ProtectedRoute>
        <Layout><BackupRestore /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/audit-log",
    element: (
      <ProtectedRoute>
        <Layout><AuditLog /></Layout>
      </ProtectedRoute>
    ),
  },
];

const router = createBrowserRouter(routes);

function App() {
  return (
    <AcademicYearProvider>
      <AssignmentProvider>
        <RouterProvider router={router} />
      </AssignmentProvider>
    </AcademicYearProvider>
  );
}

export default App;
