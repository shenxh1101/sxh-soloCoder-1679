import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAppStore, useToast } from '../store/appStore.js';
import { formatDateTime } from '../lib/format.js';
import type { Notification } from '../../shared/types.js';
import { Bell, CheckCheck, Trash2, ExternalLink, Inbox } from 'lucide-react';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const setLoading = useAppStore((s) => s.setLoading);
  const setUnreadCount = useAppStore((s) => s.setUnreadCount);
  const toast = useToast();
  const [list, setList] = useState<Notification[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const r = await api.notifications.list() as unknown as { list: Notification[]; unreadCount: number };
      setList(r.list || []);
      setUnreadCount(r.unreadCount || 0);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const readOne = async (id: number) => {
    try {
      await api.notifications.read(id);
      setList((prev) => prev.map((n) => n.id === id ? { ...n, isRead: 1 } : n));
      setUnreadCount(Math.max(0, list.filter((n) => !n.isRead && n.id !== id).length));
    } catch {}
  };

  const readAll = async () => {
    try {
      await api.notifications.readAll();
      setList((prev) => prev.map((n) => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
      toast.success('已全部标记为已读');
    } catch (e) { toast.error((e as { message?: string }).message || '操作失败'); }
  };

  const handleClick = (n: Notification) => {
    if (!n.isRead) readOne(n.id);
    if (n.relatedType === 'application' && n.relatedId) navigate(`/employee/applications/${n.relatedId}`);
    if (n.relatedType === 'dispatch' && n.relatedId) navigate('/driver/scan');
    if (n.relatedType === 'bill' && n.relatedId) navigate('/finance/bills');
    if (n.relatedType === 'approval' && n.relatedId) navigate('/supervisor/approvals');
  };

  const typeColors: Record<string, string> = {
    approval: 'bg-indigo-500', dispatch: 'bg-accent-500', bill: 'bg-success-500',
    maintenance: 'bg-warning-500', system: 'bg-primary-500', rating: 'bg-purple-500',
  };
  const typeLabels: Record<string, string> = {
    approval: '审批', dispatch: '派车', bill: '账单', maintenance: '保养', system: '系统', rating: '评分',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-600" /> 通知中心
            <span className="ml-2 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">{list.filter((n) => !n.isRead).length} 条未读</span>
          </h3>
          {list.some((n) => !n.isRead) && (
            <button onClick={readAll} className="btn-ghost text-xs flex items-center gap-1">
              <CheckCheck className="w-4 h-4" /> 全部已读
            </button>
          )}
        </div>

        {list.length === 0 ? (
          <div className="py-16 text-center"><Inbox className="w-16 h-16 mx-auto text-slate-200 mb-3" /><p className="text-sm text-slate-400">暂无通知</p></div>
        ) : (
          <div className="space-y-2">
            {list.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${n.isRead ? 'border-slate-100 bg-white' : 'border-primary-200 bg-primary-50/30 hover:shadow-md'}`}
              >
                <div className={`w-10 h-10 rounded-xl ${typeColors[n.type] || 'bg-slate-400'} text-white flex items-center justify-center shrink-0 text-xs font-bold`}>
                  {typeLabels[n.type] || '通知'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`text-sm font-bold ${n.isRead ? 'text-primary-800' : 'text-primary-900'}`}>{n.title}</h4>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />}
                  </div>
                  <p className={`text-xs ${n.isRead ? 'text-slate-400' : 'text-slate-600'} line-clamp-2`}>{n.content}</p>
                  <div className="text-[10px] text-slate-400 mt-1.5">{formatDateTime(n.createdAt)}</div>
                </div>
                {n.relatedType && <ExternalLink className="w-4 h-4 text-slate-300 shrink-0 mt-1" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
