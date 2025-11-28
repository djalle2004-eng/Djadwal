import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { Alert, Box } from '@mui/material';

interface PermissionGuardProps {
  action: 'view' | 'create' | 'update' | 'delete';
  resource: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
}

/**
 * مكون لحماية العناصر بناءً على الصلاحيات
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  action,
  resource,
  children,
  fallback,
  showError = false
}) => {
  const { can } = usePermissions();
  
  if (!can(action, resource)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (showError) {
      return (
        <Box sx={{ p: 2 }}>
          <Alert severity="error">
            ليس لديك صلاحية لتنفيذ هذا الإجراء
          </Alert>
        </Box>
      );
    }
    
    return null;
  }
  
  return <>{children}</>;
};

interface RoleGuardProps {
  roles: Array<'admin' | 'schedule_manager' | 'staff' | 'professor'>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
}

/**
 * مكون لحماية العناصر بناءً على الدور
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  roles,
  children,
  fallback,
  showError = false
}) => {
  const { user } = usePermissions();
  
  if (!user || !roles.includes(user.role)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (showError) {
      return (
        <Box sx={{ p: 2 }}>
          <Alert severity="error">
            ليس لديك الصلاحية للوصول إلى هذا القسم
          </Alert>
        </Box>
      );
    }
    
    return null;
  }
  
  return <>{children}</>;
};