import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { applicationStatusLabel, applicationStatusColor, formatDateTime, formatMoney, carTypeLabel } from '../../lib/format.js';
import { ListChecks, Filter, ChevronRight, Search, FilePlus } from 'lucide-react';
import type { Application, ApplicationStatus } from '../../../shared/types.js';

const statusFilters: { id: ApplicationStatus | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'pending', label: '待派车' },
  { id: 'pending_approval', label: '待审批' },
  { id: 'dispatched', label: '已派车' },
  { id: 'in_progress', label: '进行中' },
  { id: 'completed', label: '已完成' },
  { id: 'rejected', label: '已拒绝' },
];

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [list, setList] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [status, setStatus] = useState<ApplicationStatus | 'all'>((params.get('status') as ApplicationStatus | 'all') || 'all');
  const [keyword, setKeyword] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const r = await api.applications.list({ status: status === 'all' ? undefined : status, page, size });
      setList(r.list); setTotal(r.total);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, status, setLoading]);

  const filtered = keyword ? list.filter((a) => `${a.origin}${a.destination}${a.reason}`.includes(keyword)) : list;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-accent-500" /> 我的用车申请
            <span className="ml-2 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">共 {total} 条</span>
          </h3>
          <button onClick={() => navigate('/employee/apply')} className="btn-primary">
            <FilePlus className="w-4 h-4" /> 新建申请
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索起始地/目的地/事由" className="input pl-10" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400" />
            {statusFilters.map((s) => (
              <button key={s.id} onClick={() => { setStatus(s.id); setPage(1); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${status === s.id ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-primary-50 hover:text-primary-700'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>行程</th><th>时间</th><th>人数</th><th>车型偏好</th><th>预估费用</th><th>状态</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">暂无申请记录</td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id} onClick={() => navigate(`/employee/application/${a.id}`)} className="cursor-pointer">
                  <td>
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-primary-800 truncate">{a.origin} → {a.destination}</div>
                        <div className="text-[11px] text-slate-400 truncate">{a.reason}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="text-xs text-slate-600">{formatDateTime(a.startTime)}</div>
                    <div className="text-[11px] text-slate-400">至 {formatDateTime(a.endTime).slice(5)}</div>
                  </td>
                  <td className="text-sm"><span className="tag-pill bg-primary-100 text-primary-700">{a.passengers}人</span></td>
                  <td className="text-sm">{a.carTypePreference ? carTypeLabel[a.carTypePreference] : '不限'}</td>
                  <td className="text-sm font-semibold text-primary-800 font-mono">{formatMoney(a.estimatedDistanceKm ? (30 + 3.5 * a.estimatedDistanceKm) : 135)}</td>
                  <td><span className={`tag-pill ${applicationStatusColor[a.status]}`}>{applicationStatusLabel[a.status]}</span></td>
                  <td>
                    <button className="text-accent-600 hover:text-accent-700 text-xs font-medium flex items-center gap-0.5">
                      详情 <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > size && (
          <div className="flex items-center justify-end gap-2 mt-5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs !py-1.5 !px-3">上一页</button>
            <span className="text-xs text-slate-500">第 {page} / {Math.ceil(total / size)} 页</span>
            <button onClick={() => setPage((p) => Math.min(Math.ceil(total / size), p + 1))} disabled={page * size >= total} className="btn-secondary text-xs !py-1.5 !px-3">下一页</button>
          </div>
        )}
      </div>
    </div>
  );
}
