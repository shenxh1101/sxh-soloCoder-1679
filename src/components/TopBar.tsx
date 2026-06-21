import { Bell, LogOut, User, ChevronDown, Settings } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { api } from '../lib/api.js';
import { getInitials, formatDateTime, roleLabel, roleColor } from '../lib/format.js';

export default function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const unreadCount = useAppStore((s) => s.unreadCount);
  const setUnreadCount = useAppStore((s) => s.setUnreadCount);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState<Array<Record<string, unknown>>>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      api.notifications.list({ read: 'unread' }).then((r) => {
        setUnreadCount(r.unreadCount);
        setNotifs(r.list.slice(0, 6) as Array<Record<string, unknown>>);
      }).catch(() => {});
    }
  }, [user, setUnreadCount]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 shrink-0 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary-800 tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div ref={notifRef} className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setNotifOpen(!notifOpen); }}
            className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary-50 text-primary-700 transition-colors"
            title="通知"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1.5 min-w-4 h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-danger-500 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-12 w-96 bg-white rounded-card shadow-cardHover border border-slate-100 overflow-hidden animate-fadeInUp">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h3 className="font-semibold text-primary-800">通知中心</h3>
                {unreadCount > 0 && (
                  <button
                    className="text-xs text-accent-600 hover:text-accent-700"
                    onClick={() => api.notifications.readAll().then(() => { setNotifs([]); setUnreadCount(0); })}
                  >全部已读</button>
                )}
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">暂无新通知</div>
                ) : (
                  notifs.map((n) => (
                    <div
                      key={n.id as number}
                      className={`px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-primary-50/50 transition-colors ${!n.isRead ? 'bg-accent-50/30' : ''}`}
                      onClick={() => {
                        api.notifications.read(n.id as number).catch(() => {});
                        setNotifOpen(false);
                        navigate('/notifications');
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`tag-pill mt-0.5 ${typeColor(n.type as string)}`}>{typeLabel(n.type as string)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary-800 truncate">{n.title as string}</p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.content as string}</p>
                          <p className="text-[11px] text-slate-400 mt-1">{formatDateTime(n.createdAt as string)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-2 border-t border-slate-100 bg-primary-50/30">
                <button onClick={() => { setNotifOpen(false); navigate('/notifications'); }} className="w-full text-xs text-center text-accent-600 hover:text-accent-700 font-medium py-1">
                  查看全部通知 →
                </button>
              </div>
            </div>
          )}
        </div>

        <div ref={menuRef} className="relative ml-1">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="flex items-center gap-3 pl-1 pr-2 py-1 rounded-full hover:bg-primary-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-sm font-semibold shadow-md">
              {getInitials(user.name)}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-semibold text-primary-800 leading-tight">{user.name}</div>
              <div className="flex items-center gap-1">
                <span className={`tag-pill text-[10px] ${roleColor[user.role]}`}>{roleLabel[user.role]}</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-56 bg-white rounded-card shadow-cardHover border border-slate-100 overflow-hidden animate-fadeInUp py-1">
              <div className="px-4 py-3 border-b border-slate-50 bg-gradient-to-r from-primary-50 to-transparent">
                <div className="text-sm font-semibold text-primary-800">{user.name}</div>
                <div className="text-xs text-slate-500">{user.phone || '未设置手机'}</div>
              </div>
              <button onClick={() => { setMenuOpen(false); navigate('/notifications'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-primary-50">
                <User className="w-4 h-4" /> 个人中心
              </button>
              <button onClick={() => { setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-primary-50">
                <Settings className="w-4 h-4" /> 账号设置
              </button>
              <div className="border-t border-slate-50 my-1" />
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50">
                <LogOut className="w-4 h-4" /> 退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const typeLabel = (t: string) => ({ approval: '审批', dispatch: '派车', trip: '行程', maintenance: '保养', bill: '账单', system: '系统' }[t] || '通知');
const typeColor = (t: string) => ({
  approval: 'bg-warning-500/15 text-warning-600',
  dispatch: 'bg-primary-100 text-primary-700',
  trip: 'bg-accent-100 text-accent-700',
  maintenance: 'bg-warning-500/15 text-warning-600',
  bill: 'bg-rose-100 text-rose-700',
  system: 'bg-slate-100 text-slate-600',
}[t] || 'bg-slate-100 text-slate-600');
