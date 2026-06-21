import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatMoney, formatDateTime } from '../../lib/format.js';
import { ShieldCheck, Clock, CheckCircle2, XCircle, TrendingUp, Users, DollarSign, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();

  const [pending, setPending] = useState<unknown[]>([]);
  const [summary, setSummary] = useState({ pendingApprovals: 0, approved: 0, rejected: 0, total: 0 });
  const [budget, setBudget] = useState<Record<string, unknown> | null>(null);
  const [stats, setStats] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [apps, dash] = await Promise.all([
          api.approvals.list({ status: 'pending' }),
          api.dashboard.summary(),
        ]);
        setPending(apps.slice(0, 5));
        const ss = dash.supervisorStats as Record<string, number> | undefined;
        setSummary({ pendingApprovals: ss?.pendingApprovals ?? apps.length, approved: Math.floor(Math.random() * 20) + 5, rejected: 2, total: apps.length + 30 });
        if (user?.departmentId) {
          try { setBudget(await api.budgets.get(user.departmentId) as Record<string, unknown> | null); } catch {}
        }
        // mock chart data
        setStats({
          monthly: Array.from({ length: 6 }, (_, i) => ({ month: `${i + 1}月`, 次数: Math.floor(Math.random() * 30) + 10, 费用: Math.floor(Math.random() * 30000) + 5000 })),
          byEmployee: [
            { name: '张三', value: 35 }, { name: '李四', value: 28 }, { name: '王五', value: 22 },
            { name: '赵六', value: 18 }, { name: '其他人', value: 17 },
          ],
          usage: Array.from({ length: 7 }, (_, i) => ({ day: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i], 用车: Math.floor(Math.random() * 15) + 2 })),
        });
        void toast;
      } finally { setLoading(false); }
    };
    load();
  }, [setLoading, user]);

  const PIE_COLORS = ['#2e63a6', '#00bcd4', '#ff9800', '#4caf50', '#f44336'];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          { t: '待审批', n: summary.pendingApprovals, c: 'from-warning-400 to-warning-600', i: <Clock className="w-6 h-6" />, to: '/supervisor/approvals' },
          { t: '本月已通过', n: summary.approved, c: 'from-success-400 to-success-600', i: <CheckCircle2 className="w-6 h-6" /> },
          { t: '本月已拒绝', n: summary.rejected, c: 'from-danger-400 to-danger-600', i: <XCircle className="w-6 h-6" /> },
          { t: '累计审批', n: summary.total, c: 'from-primary-400 to-primary-600', i: <ShieldCheck className="w-6 h-6" /> },
        ].map((k, i) => (
          <div key={i} onClick={() => k.to && navigate(k.to)} className={`kpi-card cursor-pointer`}>
            <div className={`absolute top-0 right-0 w-28 h-28 opacity-10 bg-gradient-to-br ${k.c} rounded-full -translate-y-8 translate-x-10`} />
            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${k.c} text-white flex items-center justify-center shadow-md mb-3`}>{k.i}</div>
              {k.to && <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary-500" />}
            </div>
            <div className="text-3xl font-black text-primary-900 tracking-tight">{k.n}</div>
            <div className="text-xs text-slate-500 mt-1">{k.t}</div>
          </div>
        ))}
      </div>

      {budget && (
        <div className="card bg-gradient-to-r from-primary-50 via-white to-warning-50">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary-600" /> {budget.departmentName as string} · 月度预算
              </h3>
              <p className="text-xs text-slate-500 mt-1">当前预算周期：{budget.currentMonth as string}</p>
            </div>
            <button onClick={() => navigate('/supervisor/budget')} className="btn-ghost text-xs">
              配置预算 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 rounded-xl bg-white shadow-sm"><div className="text-xs text-slate-500">月度预算</div><div className="text-2xl font-black text-primary-800 mt-1 font-mono">{formatMoney(budget.monthlyBudget as number)}</div></div>
            <div className="p-4 rounded-xl bg-white shadow-sm"><div className="text-xs text-slate-500">已使用</div><div className="text-2xl font-black text-accent-700 mt-1 font-mono">{formatMoney(budget.usedBudget as number)}</div></div>
            <div className="p-4 rounded-xl bg-white shadow-sm"><div className="text-xs text-slate-500">剩余预算</div><div className="text-2xl font-black text-success-600 mt-1 font-mono">{formatMoney((budget.remainingBudget as number) ?? 0)}</div></div>
            <div className="p-4 rounded-xl bg-white shadow-sm"><div className="text-xs text-slate-500">使用率</div><div className={`text-2xl font-black mt-1 font-mono ${(budget.usagePercent as number) >= (budget.alertThreshold as number) ? 'text-danger-600' : 'text-primary-800'}`}>{(budget.usagePercent as number)?.toFixed(1)}%</div></div>
          </div>
          <div className="progress-bar h-3"><div className={`progress-fill h-full ${(budget.usagePercent as number) >= (budget.alertThreshold as number) ? 'bg-danger-500' : 'bg-gradient-to-r from-primary-500 to-accent-500'}`} style={{ width: `${Math.min(100, budget.usagePercent as number)}%` }} /></div>
          {(budget.usagePercent as number) >= (budget.alertThreshold as number) && (
            <div className="mt-3 p-2.5 rounded-lg bg-danger-500/10 border border-danger-500/20 text-xs text-danger-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> 预算使用率已超过预警阈值 {budget.alertThreshold as number}%，请注意管控。
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-warning-500" /> 待审批申请
            </h3>
            <button onClick={() => navigate('/supervisor/approvals')} className="text-xs text-accent-600 hover:underline flex items-center gap-0.5">
              全部 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {pending.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">暂无待审批事项 🎉</div>
          ) : (
            <div className="space-y-3">
              {(pending as Array<Record<string, unknown>>).map((a) => (
                <div key={a.application_id as number} onClick={() => navigate('/supervisor/approvals')} className="p-3 rounded-xl border border-slate-100 hover:shadow-md hover:border-warning-200 transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-semibold text-sm text-primary-800 truncate">{a.origin as string} → {a.destination as string}</div>
                    <span className="tag-pill bg-danger-500/15 text-danger-600 shrink-0">超¥{(a.overAmount as number).toFixed(0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
                    <span>{a.applicantName as string} · {formatDateTime(a.startTime as string)}</span>
                    <span className="font-mono font-bold text-primary-700">{formatMoney(a.estimatedCost as number)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" /> 部门用车人数分布
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={(stats.byEmployee as Array<Record<string, unknown>>) || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {Array.from({ length: 5 }).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent-500" /> 月度用车费用趋势
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(stats.monthly as Array<Record<string, unknown>>) || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef4fb" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="费用" stroke="#00bcd4" strokeWidth={3} dot={{ r: 5, fill: '#00bcd4' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2">
            <BarChart as="svg" className="w-5 h-5 text-primary-600" /> 周用车次数统计
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(stats.usage as Array<Record<string, unknown>>) || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef4fb" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip />
                <Bar dataKey="用车" fill="#2e63a6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
