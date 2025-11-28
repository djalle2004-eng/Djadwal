import { User, LoginCredentials, UserFormData, UserRole, RolePermissions } from '../types/shared';

/**
 * تسجيل الدخول
 */
export const login = async (credentials: LoginCredentials): Promise<{ user: User; token?: string }> => {
  try {
    if (typeof window === 'undefined' || !window.db?.login) {
      throw new Error('Authentication service not available');
    }

    const user = await window.db.login(credentials.username, credentials.password);
    
    if (user && user.id) {
      // تحميل الصلاحيات المخصصة من قاعدة البيانات
      let permissions: RolePermissions | null = null;
      try {
        const permissionsJson = await window.db.getUserPermissions(user.id);
        console.log('🔐 Permissions JSON from DB:', permissionsJson);
        if (permissionsJson) {
          permissions = JSON.parse(permissionsJson);
          console.log('✅ Custom permissions loaded:', permissions);
        } else {
          console.log('ℹ️ No custom permissions found, using role defaults');
        }
      } catch (error) {
        console.log('⚠️ Error loading permissions:', error);
      }
      
      // حفظ بيانات المستخدم مع الصلاحيات
      const userWithPermissions = { ...user, customPermissions: permissions };
      localStorage.setItem('currentUser', JSON.stringify(userWithPermissions));
      
      if (permissions) {
        localStorage.setItem('userPermissions', JSON.stringify(permissions));
      }
      
      if (credentials.remember_me) {
        localStorage.setItem('rememberMe', 'true');
      }
      
      return { user: userWithPermissions };
    } else {
      throw new Error('فشل تسجيل الدخول');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  try {
    const currentUser = getCurrentUser();
    
    if (currentUser && window.db?.logout) {
      await window.db.logout(currentUser.id);
    }
    
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userPermissions');
    localStorage.removeItem('rememberMe');
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

export const getCurrentUser = (): User | null => {
  try {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const hasPermission = (
  user: User | null,
  action: 'view' | 'create' | 'update' | 'delete',
  resource: string
): boolean => {
  if (!user) {
    console.log('⛔ No user, permission denied');
    return false;
  }
  if (user.role === 'admin') {
    console.log('✅ Admin user, permission granted for:', action, resource);
    return true;
  }
  
  // محاولة الحصول على الصلاحيات المخصصة من localStorage
  let permissions: RolePermissions;
  
  try {
    const customPermissionsStr = localStorage.getItem('userPermissions');
    if (customPermissionsStr) {
      permissions = JSON.parse(customPermissionsStr);
      console.log('🔑 Using custom permissions from localStorage:', resource, permissions[resource as keyof typeof permissions]);
    } else {
      // استخدام صلاحيات الدور الافتراضية
      permissions = getRolePermissions(user.role);
      console.log('📜 Using role default permissions for:', user.role, resource, permissions[resource as keyof typeof permissions]);
    }
  } catch (error) {
    console.error('Error parsing permissions:', error);
    permissions = getRolePermissions(user.role);
  }
  
  const resourcePermission = permissions[resource as keyof typeof permissions];
  
  if (!resourcePermission) {
    console.log('⚠️ No permission found for resource:', resource);
    return false;
  }
  
  const result = resourcePermission[action];
  console.log(`🔎 Permission check: ${action} on ${resource} =`, result);
  return result;
};

export const getRolePermissions = (role: UserRole) => {
  const allPermissions = { view: true, create: true, update: true, delete: true };
  const viewOnly = { view: true, create: false, update: false, delete: false };
  const noPermissions = { view: false, create: false, update: false, delete: false };
  
  const rolePermissionsMap = {
    admin: {
      academic_years: allPermissions,
      professors: allPermissions,
      courses: allPermissions,
      rooms: allPermissions,
      groups: allPermissions,
      departments: allPermissions,
      sessions: allPermissions,
      extra_sessions: allPermissions,
      reports: allPermissions,
      users: allPermissions,
      settings: allPermissions,
      backup: allPermissions,
    },
    schedule_manager: {
      academic_years: viewOnly,
      professors: viewOnly,
      courses: viewOnly,
      rooms: viewOnly,
      groups: viewOnly,
      departments: viewOnly,
      sessions: allPermissions,
      extra_sessions: allPermissions,
      reports: viewOnly,
      users: noPermissions,
      settings: noPermissions,
      backup: noPermissions,
    },
    staff: {
      academic_years: viewOnly,
      professors: viewOnly,
      courses: viewOnly,
      rooms: viewOnly,
      groups: viewOnly,
      departments: viewOnly,
      sessions: viewOnly,
      extra_sessions: viewOnly,
      reports: viewOnly,
      users: noPermissions,
      settings: noPermissions,
      backup: noPermissions,
    },
    professor: {
      academic_years: noPermissions,
      professors: noPermissions,
      courses: viewOnly,
      rooms: noPermissions,
      groups: noPermissions,
      departments: noPermissions,
      sessions: viewOnly,
      extra_sessions: viewOnly,
      reports: viewOnly,
      users: noPermissions,
      settings: noPermissions,
      backup: noPermissions,
    },
  };
  
  return rolePermissionsMap[role];
};

export const getUsers = async (): Promise<User[]> => {
  try {
    if (typeof window === 'undefined' || !window.db?.getUsers) {
      throw new Error('User service not available');
    }
    return await window.db.getUsers();
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const addUser = async (userData: UserFormData): Promise<User> => {
  try {
    if (typeof window === 'undefined' || !window.db?.addUser) {
      throw new Error('User service not available');
    }
    return await window.db.addUser(userData);
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
};

export const updateUser = async (id: number, userData: Partial<UserFormData>): Promise<User> => {
  try {
    if (typeof window === 'undefined' || !window.db?.updateUser) {
      throw new Error('User service not available');
    }
    return await window.db.updateUser(id, userData);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const deleteUser = async (id: number): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db?.deleteUser) {
      throw new Error('User service not available');
    }
    await window.db.deleteUser(id);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

export const changePassword = async (userId: number, oldPassword: string, newPassword: string): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db?.changePassword) {
      throw new Error('Password service not available');
    }
    
    const result = await window.db.changePassword(userId, oldPassword, newPassword);
    if (!result.success) {
      throw new Error(result.message || 'فشل تغيير كلمة المرور');
    }
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

export const resetPassword = async (userId: number, newPassword: string): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db?.resetPassword) {
      throw new Error('Password service not available');
    }
    
    const result = await window.db.resetPassword(userId, newPassword);
    if (!result.success) {
      throw new Error(result.message || 'فشل إعادة تعيين كلمة المرور');
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
};

export const toggleUserStatus = async (userId: number, isActive: boolean): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !window.db?.toggleUserStatus) {
      throw new Error('User service not available');
    }
    await window.db.toggleUserStatus(userId, isActive);
  } catch (error) {
    console.error('Error toggling user status:', error);
    throw error;
  }
};

export const getAuditLogs = async (filters?: { userId?: number; action?: string; startDate?: string; endDate?: string }) => {
  try {
    if (typeof window === 'undefined' || !window.db?.getAuditLogs) {
      throw new Error('Audit service not available');
    }
    return await window.db.getAuditLogs(filters);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
};