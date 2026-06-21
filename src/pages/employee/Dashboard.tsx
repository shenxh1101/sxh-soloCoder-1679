import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, useToast } from '../../store/appStore.js';
import { api } from '../../lib/api.js';
import { formatDateTime, formatMoney, applicationStatusLabel, applicationStatusColor } from '../../lib/format.js';
import { FilePlus, ListChecks, Clock, CheckCircle2, ChevronRight, Car, FileText } from 'lucide-react';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [stats, setStats] = useState({ ongoing: 0, completed: 0, total: 0, pendingCost: 0 });
  const [recent, setRecent] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [apps, dash] = await Promise.all([
          api.applications.list({ size: 5, page: 1 }),
          api.dashboard.summary(),
        ]);
        setRecent(apps.list as unknown as Array<Record<string, unknown>>);
        const es = (dash.employeeStats || {}) as Record<string, number>;
        const cost = dash.pendingCost as number | undefined;
        setStats({
          ongoing: es.ongoing || 0,
          completed: es.completed || 0,
          total: es.total || 0,
          pendingCost: cost ?? 0,
        });
        void toast;
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [setLoading, user]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          { t: '进行中', n: stats.ongoing, c: 'from-accent-400 to-accent-600', i: <Clock className="w-6 h-6" /> },
          { t: '已完成', n: stats.completed, c: 'from-success-400 to-success-600', i: <CheckCircle2 className="w-6 h-6" /> },
          { t: '累计申请', n: stats.total, c: 'from-primary-400 to-primary-600', i: <ListChecks className="w-6 h-6" /> },
          { t: '本月已消费', n: `¥${stats.pendingCost}`, c: 'from-warning-400 to-warning-600', i: <FileText className="w-6 h-6" /> },
        ].map((k, idx) => (
          <div key={idx} className="kpi-card">
            <div className={`absolute top-0 right-0 w-28 h-28 opacity-10 bg-gradient-to-br ${k.c} rounded-full -translate-y-8 translate-x-10`} />
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${k.c} text-white flex items-center justify-center shadow-md mb-3`}>{k.i}</div>
            <div className="text-2xl font-black text-primary-900 tracking-tight">{k.n}</div>
            <div className="text-xs text-slate-500 mt-1">{k.t}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-accent-500" /> 我的申请记录
            </h3>
            <button onClick={() => navigate('/employee/applications')} className="text-xs text-accent-600 hover:text-accent-700 font-medium flex items-center gap-1">
              查看全部 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">暂无申请记录，点击下方按钮发起用车申请</div>
          ) : (
            <div className="space-y-3">
              {recent.map((r) => (
                <div key={r.id as number} onClick={() => navigate(`/employee/application/${r.id}`)} className="p-4 rounded-xl border border-slate-100 hover:shadow-md hover:border-primary-100 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-primary-800 truncate">{r.origin as string} → {r.destination as string}</span>
                        <span className={`tag-pill ${applicationStatusColor[r.status as keyof typeof applicationStatusColor] || 'bg-slate-100'}`}>
                          {applicationStatusLabel[r.status as keyof typeof applicationStatusLabel] || (r.status as React.ReactNode)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                        <span>⏰ {formatDateTime(r.startTime as string)} ~ {formatDateTime(r.endTime as string)}</span>
                        <span>👥 {r.passengers as number}人</span>
                        {r.applicantName && <span>{r.applicantName as string}</span>}
                      </div>
                      <p className="mt-2 text-xs text-slate-400 truncate">事由：{r.reason as string}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Car className="w-6 h-6 text-accent-300" />
            </div>
            <div>
              <h3 className="text-base font-bold">快速发起用车</h3>
              <p className="text-xs text-white/60 mt-0.5">智能匹配最优车辆与司机</p>
            </div>
          </div>
          <ul className="space-y-2 mb-6 text-sm text-white/80">
            {['在线申请实时派车', '自动预算检查与审批', '扫码出发行程记录', '行程结束服务评价'].map((t, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-accent-500/20 text-accent-300 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                {t}
              </li>
            ))}
          </ul>
          <button onClick={() => navigate('/employee/apply')} className="w-full h-11 rounded-xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-accent-500/30 transition-all hover:scale-[1.02]">
            <FilePlus className="w-5 h-5" /> 立即申请用车
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-warning-500" /> 待处理事项
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recent.filter((r) => !['completed', 'rejected', 'cancelled'].includes(r.status as string)).slice(0, 2).length === 0 ? (
            <div className="md:col-span-2 py-8 text-center text-sm text-slate-400">暂无待处理事项 🎉</div>
          ) : (
            recent.filter((r) => !['completed', 'rejected', 'cancelled'].includes(r.status as string)).slice(0, 2).map((r) => (
              <div key={r.id as number} className="p-4 rounded-xl border-l-4 border-accent-500 bg-gradient-to-r from-accent-50 to-transparent flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-primary-800">{r.origin as string} → {r.destination as string}</div>
                  <div className="text-xs text-slate-500 mt-1">{formatDateTime(r.startTime as string)}</div>
                </div>
                <span className={`tag-pill ${applicationStatusColor[r.status as keyof typeof applicationStatusColor] || ''}`}>
                  {applicationStatusLabel[r.status as keyof typeof applicationStatusLabel]}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
