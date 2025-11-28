import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, LoginCredentials } from '../types/shared';
import * as authService from '../services/authService';

// واجهة سياق المصادقة
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (action: 'view' | 'create' | 'update' | 'delete', resource: string) => boolean;
  isAdmin: boolean;
  isScheduleManager: boolean;
  isStaff: boolean;
  isProfessor: boolean;
}

// إنشاء السياق
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// مزود السياق
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // التحقق من حالة الجلسة عند التحميل
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error('خطأ في استعادة بيانات الجلسة:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkUserSession();
  }, []);

  // دالة تسجيل الدخول
  const signIn = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      const { user: loggedInUser } = await authService.login(credentials);
      setUser(loggedInUser);
    } catch (error) {
      console.error('خطأ في تسجيل الدخول:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // دالة تسجيل الخروج
  const signOut = async () => {
    try {
      setIsLoading(true);
      if (user) {
        await authService.logout();
      }
      setUser(null);
    } catch (error) {
      console.error('خطأ في تسجيل الخروج:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // التحقق من الصلاحية
  const hasPermission = (action: 'view' | 'create' | 'update' | 'delete', resource: string): boolean => {
    return authService.hasPermission(user, action, resource);
  };

  // خصائص مختصرة للأدوار
  const isAdmin = user?.role === 'admin';
  const isScheduleManager = user?.role === 'schedule_manager';
  const isStaff = user?.role === 'staff';
  const isProfessor = user?.role === 'professor';

  // قيمة السياق
  const contextValue: AuthContextType = {
    user,
    isLoading,
    signIn,
    signOut,
    hasPermission,
    isAdmin,
    isScheduleManager,
    isStaff,
    isProfessor
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// خطاف مخصص للوصول إلى السياق
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('يجب استخدام useAuth داخل AuthProvider');
  }
  return context;
};

// خطاف قديم للتوافق مع الأنظمة القديمة
export const UserAuth = useAuth;
