import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, GraduationCap, LayoutGrid, User, Settings } from 'lucide-react';

export default function PortalLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    // We should ideally check auth state here or in a ProtectedRoute wrapper
    // For now, assuming parent route handles protection or component checks cookies

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/signout', { method: 'POST' });
            navigate('/portal/login');
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="min-h-screen bg-gray-50 font-sans" dir="rtl">
            {/* Navbar */}
            <nav className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                <GraduationCap className="h-8 w-8 text-indigo-600 ml-2" />
                                <span className="text-xl font-bold text-gray-900">بوابة الأساتذة</span>
                            </div>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8 sm:space-x-reverse mr-8">
                                <Link
                                    to="/portal/preferences"
                                    className={`${isActive('/portal/preferences')
                                            ? 'border-indigo-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                        } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                                >
                                    <LayoutGrid className="w-4 h-4 ml-2" />
                                    رغبات التدريس
                                </Link>
                                <Link
                                    to="/portal/profile"
                                    className={`${isActive('/portal/profile')
                                            ? 'border-indigo-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                        } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                                >
                                    <User className="w-4 h-4 ml-2" />
                                    الملف الشخصي
                                </Link>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 bg-white hover:text-gray-700 focus:outline-none transition"
                            >
                                <LogOut className="h-4 w-4 ml-2" />
                                تسجيل خروج
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="py-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
