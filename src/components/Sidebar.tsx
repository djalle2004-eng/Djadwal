import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from "lucide-react";
import { usePermissions } from '../hooks/usePermissions';

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  resource?: string | null;
  adminOnly?: boolean;
}

interface SidebarProps {
  navigation: NavigationItem[];
}

export default function Sidebar({ navigation }: SidebarProps) {
  const location = useLocation();
  const { isAdmin, can } = usePermissions();

  // فلترة عناصر القائمة بناءً على الصلاحيات
  const filteredNavigation = navigation.filter((item) => {
    // تحقق من adminOnly أولاً
    if (item.adminOnly && !isAdmin) {
      return false;
    }
    
    // إذا كان resource = null (مثل الداشبورد)، عرضه للجميع
    if (item.resource === null || item.resource === undefined) {
      return true;
    }
    
    // تحقق من صلاحية 'view' للمورد
    return can('view', item.resource);
  });

  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200">
      <div className="flex items-center h-16 px-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Djadwal</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {filteredNavigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                isActive
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <item.icon
                className={`mr-3 h-5 w-5 ${
                  isActive ? 'text-indigo-500' : 'text-gray-400'
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}