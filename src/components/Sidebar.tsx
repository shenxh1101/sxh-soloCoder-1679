import {
  LayoutDashboard, FilePlus, ListChecks, Bell, ShieldCheck, BarChart3, Wallet,
  Clock, Calendar, ScanLine, MapPin, Users, Wrench, Receipt, PieChart,
  FileSpreadsheet, ChevronLeft, ChevronRight, Car, FileText
} from 'lucide-react';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { useMemo } from 'react';
import { roleLabel } from '../lib/format.js';
import type { UserRole } from '../../shared/types';

const navItems: Record<UserRole, Array<{ to: string; label: string; icon: JSX.Element }>> = {
  admin: [
    { to: '/dispatcher/dashboard', label: '调度总览', icon: <LayoutDashboard className="w-5 h-5" /> },
    { to: '/dispatcher/vehicles', label: '车辆管理', icon: <Car className="w-5 h-5" /> },
    { to: '/dispatcher/drivers', label: '司机管理', icon: <Users className="w-5 h-5" /> },
    { to: '/dispatcher/dispatch', label: '派车中心', icon: <FilePlus className="w-5 h-5" /> },
    { to: '/dispatcher/maintenance', label: '保养提醒', icon: <Wrench className="w-5 h-5" /> },
    { to: '/finance/dashboard', label: '财务概览', icon: <BarChart3 className="w-5 h-5" /> },
    { to: '/finance/bills', label: '账单管理', icon: <Receipt className="w-5 h-5" /> },
    { to: '/finance/statistics', label: '费用统计', icon: <PieChart className="w-5 h-5" /> },
  ],
  employee: [
    { to: '/employee/dashboard', label: '工作台', icon: <LayoutDashboard className="w-5 h-5" /> },
    { to: '/employee/apply', label: '申请用车', icon: <FilePlus className="w-5 h-5" /> },
    { to: '/employee/applications', label: '我的申请', icon: <ListChecks className="w-5 h-5" /> },
  ],
  supervisor: [
    { to: '/supervisor/dashboard', label: '工作台', icon: <LayoutDashboard className="w-5 h-5" /> },
    { to: '/supervisor/approvals', label: '审批中心', icon: <ShieldCheck className="w-5 h-5" /> },
    { to: '/supervisor/statistics', label: '部门统计', icon: <BarChart3 className="w-5 h-5" /> },
    { to: '/supervisor/budget', label: '预算管理', icon: <Wallet className="w-5 h-5" /> },
  ],
  driver: [
    { to: '/driver/dashboard', label: '工作台', icon: <LayoutDashboard className="w-5 h-5" /> },
    { to: '/driver/scan', label: '扫码执行', icon: <ScanLine className="w-5 h-5" /> },
    { to: '/driver/trips', label: '我的行程', icon: <MapPin className="w-5 h-5" /> },
    { to: '/driver/schedule', label: '排班日历', icon: <Calendar className="w-5 h-5" /> },
  ],
  dispatcher: [
    { to: '/dispatcher/dashboard', label: '调度总览', icon: <LayoutDashboard className="w-5 h-5" /> },
    { to: '/dispatcher/vehicles', label: '车辆管理', icon: <Car className="w-5 h-5" /> },
    { to: '/dispatcher/drivers', label: '司机管理', icon: <Users className="w-5 h-5" /> },
    { to: '/dispatcher/dispatch', label: '派车中心', icon: <FilePlus className="w-5 h-5" /> },
    { to: '/dispatcher/maintenance', label: '保养提醒', icon: <Wrench className="w-5 h-5" /> },
  ],
  finance: [
    { to: '/finance/dashboard', label: '财务概览', icon: <LayoutDashboard className="w-5 h-5" /> },
    { to: '/finance/bills', label: '账单管理', icon: <Receipt className="w-5 h-5" /> },
    { to: '/finance/statistics', label: '费用统计', icon: <PieChart className="w-5 h-5" /> },
    { to: '/finance/reports', label: '报表导出', icon: <FileSpreadsheet className="w-5 h-5" /> },
  ],
};

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppStore((s) => s.user);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggle = useAppStore((s) => s.toggleSidebar);

  const role = useMemo(() => user?.role ?? 'employee', [user]);
  const items = navItems[role] || [];
  const notificationsPath = '/notifications';
  const notifActive = location.pathname === notificationsPath;

  return (
    <aside
      className={`relative h-screen flex-shrink-0 transition-all duration-300 bg-gradient-to-b from-primary-800 via-primary-700 to-primary-900 text-white shadow-xl ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="flex flex-col h-full">
        <div
          className="h-16 flex items-center justify-center gap-2 border-b border-white/10 cursor-pointer"
          onClick={() => navigate(user ? `/${user.role}/dashboard` : '/login')}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-lg shadow-accent-500/30">
            <Car className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="font-bold text-lg tracking-tight">
              <span className="bg-gradient-to-r from-white to-accent-200 bg-clip-text text-transparent">公务调度</span>
            </div>
          )}
        </div>

        {user && !collapsed && (
          <div className="px-4 py-3 border-b border-white/10">
            <div className="text-xs text-white/50 mb-1">当前角色</div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-500/20 text-accent-200">
                {roleLabel[role]}
              </span>
              <span className="text-sm font-medium truncate">{user.name}</span>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}

          <NavLink
            to={notificationsPath}
            className={`sidebar-item ${notifActive ? 'active' : ''}`}
            title={collapsed ? '通知中心' : undefined}
          >
            <Bell className="w-5 h-5" />
            {!collapsed && <span>通知中心</span>}
          </NavLink>
        </nav>

        <button
          onClick={toggle}
          className="h-12 border-t border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title={collapsed ? '展开' : '收起'}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  );
}
