import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { UserAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user } = UserAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      console.log('المستخدم غير مسجل الدخول، توجيه إلى صفحة تسجيل الدخول');
    }
  }, [user]);

  if (!user) {
    // توجيه المستخدم لصفحة تسجيل الدخول مع حفظ المسار الأصلي للعودة إليه بعد التسجيل
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
} 