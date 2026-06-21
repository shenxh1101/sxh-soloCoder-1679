import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatMoney, formatDateTime } from '../../lib/format.js';
import { ShieldCheck, Clock, CheckCircle2, XCircle, TrendingUp, Users, DollarSign, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

interface ApprovalRow {
  id: number;
  application_id: number;
  estimated_cost: number;
  over_amount: number;
  decision: string;
  origin: string;
  destination: string;
  startTime: string;
  applicantName: string;
  applicationStatus: string;
}

export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();

  const [pending, setPending] = useState<ApprovalRow[]>([]);
  const [summary, setSummary] = useState({ pendingApprovals: 0, approved: 0, rejected: 0, total: 0 });
  const [budget, setBudget] = useState<Record<string, unknown> | null>(null);
  const [deptBudgetInfo, setDeptBudgetInfo] = useState<Record<string, unknown> | null>(null);
  const [budgetKpi, setBudgetKpi] = useState<Record<string, unknown> | null>(null);
  const [monthlyData, setMonthlyData] = useState<Array<{ label: string; value: number }>>([]);
  const [deptData, setDeptData] = useState<Array<{ label: string; value: number }>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [allPending, allApproved, allRejected, dash] = await Promise.all([
          api.approvals.list({ status: 'pending' }) as unknown as ApprovalRow[],
          api.approvals.list({ status: 'approved' }) as unknown as ApprovalRow[],
          api.approvals.list({ status: 'rejected' }) as unknown as ApprovalRow[],
          api.dashboard.summary(),
        ]);
        const pList = allPending || [];
        const aList = allApproved || [];
        const rList = allRejected || [];
        setPending(pList.slice(0, 5));
        setSummary({
          pendingApprovals: pList.length,
          approved: aList.length,
          rejected: rList.length,
          total: pList.length + aList.length + rList.length,
        });
        const ss = dash.supervisorStats as Record<string, number> | undefined;
        if (ss) {
          setSummary(prev => ({
            ...prev,
            pendingApprovals: ss.pendingApprovals ?? prev.pendingApprovals,
            approved: ss.approved ?? prev.approved,
            rejected: ss.rejected ?? prev.rejected,
            total: ss.total ?? prev.total,
          }));
        }
        if (user?.departmentId) {
          try { setBudget(await api.budgets.get(user.departmentId) as unknown as Record<string, unknown> | null); } catch {}
          try {
            const ba = await api.finance.budgetAnalysis() as unknown as { list: Array<Record<string, unknown>>; kpi: Record<string, unknown> };
            if (ba.list && ba.list.length > 0) setDeptBudgetInfo(ba.list[0]);
            if (ba.kpi) setBudgetKpi(ba.kpi);
          } catch {}
        }
        try {
          const monthlyRes = await api.finance.statistics({ type: 'monthly' }) as unknown as { data: Array<{ label: string; value: number }> };
          setMonthlyData((monthlyRes.data || []).map((d) => ({ label: d.label?.slice(5) || d.label, value: d.value })));
        } catch {}
        try {
          const deptRes = await api.finance.statistics({ type: 'department' }) as unknown as { data: Array<{ label: string; value: number }> };
          setDeptData(deptRes.data || []);
        } catch {}
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

      {deptBudgetInfo && (
        <div className="card bg-gradient-to-r from-primary-50 via-white to-warning-50">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary-600" /> {deptBudgetInfo.departmentName as string} · 预算执行分析
              </h3>
              <p className="text-xs text-slate-500 mt-1">统计周期：{(budgetKpi?.targetMonth as string) || '本月'} · 数据与财务审核同步</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`tag-pill text-xs ${
                deptBudgetInfo.riskLevel === 'overrun' ? 'bg-danger-500/15 text-danger-700' :
                deptBudgetInfo.riskLevel === 'warning' ? 'bg-warning-500/15 text-warning-700' :
                'bg-success-500/15 text-success-700'
              }`}>
                {deptBudgetInfo.riskLevel === 'overrun' ? '已超支' : deptBudgetInfo.riskLevel === 'warning' ? '风险预警' : '预算正常'}
              </span>
              <button onClick={() => navigate('/supervisor/budget')} className="btn-ghost text-xs">
                详情 <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="p-4 rounded-xl bg-white shadow-sm">
              <div className="text-xs text-slate-500">月度预算</div>
              <div className="text-2xl font-black text-primary-800 mt-1 font-mono">{formatMoney(deptBudgetInfo.monthlyBudget as number)}</div>
            </div>
            <div className="p-4 rounded-xl bg-white shadow-sm">
              <div className="text-xs text-slate-500 flex items-center gap-1">已审核费用 <span className="text-success-600">●</span></div>
              <div className="text-2xl font-black text-success-600 mt-1 font-mono">{formatMoney(deptBudgetInfo.approvedCost as number)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{deptBudgetInfo.approvedCount as number} 笔已通过</div>
            </div>
            <div className="p-4 rounded-xl bg-white shadow-sm">
              <div className="text-xs text-slate-500 flex items-center gap-1">待审核风险 <span className="text-warning-500">●</span></div>
              <div className="text-2xl font-black text-warning-600 mt-1 font-mono">{formatMoney(deptBudgetInfo.pendingCost as number)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{deptBudgetInfo.pendingCount as number} 笔待审核</div>
            </div>
            <div className="p-4 rounded-xl bg-white shadow-sm">
              <div className="text-xs text-slate-500">{(deptBudgetInfo.remainingBudget as number) > 0 ? '剩余预算' : '预计超支'}</div>
              <div className={`text-2xl font-black mt-1 font-mono ${(deptBudgetInfo.remainingBudget as number) > 0 ? 'text-primary-800' : 'text-danger-600'}`}>
                {formatMoney(Math.max(0, deptBudgetInfo.remainingBudget as number) || (deptBudgetInfo.estimatedOverrun as number))}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">使用率 {(deptBudgetInfo.usagePercent as number)?.toFixed(1)}%</div>
            </div>
          </div>
          <div className="mb-2">
            <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-success-500 to-success-400 transition-all"
                style={{ width: `${deptBudgetInfo.approvedPercent as number}%` }}
              />
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-warning-400 to-warning-500 transition-all"
                style={{ left: `${deptBudgetInfo.approvedPercent as number}%`, width: `${deptBudgetInfo.pendingPercent as number}%` }}
              />
              <div className="absolute top-0 h-full w-0.5 bg-danger-500/70" style={{ left: '80%' }} />
              <div className="absolute top-0 h-full w-0.5 bg-danger-600" style={{ left: '100%' }} />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-500">
              <span>0%</span>
              <span className="text-warning-600">预警线 80%</span>
              <span>100%</span>
            </div>
          </div>
          {deptBudgetInfo.riskLevel !== 'normal' && (
            <div className={`mt-3 p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
              deptBudgetInfo.riskLevel === 'overrun' ? 'bg-danger-500/10 border-danger-500/20 text-danger-700' : 'bg-warning-500/10 border-warning-500/20 text-warning-700'
            }`}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {deptBudgetInfo.riskLevel === 'overrun'
                ? `预算已超支 ${formatMoney(deptBudgetInfo.estimatedOverrun as number)}，待审核通过后将进一步扩大缺口，请严格管控费用。`
                : `预算使用率已达 {(deptBudgetInfo.usagePercent as number)?.toFixed(1)}%，接近预警线，请注意控制后续用车支出。`
              }
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
            <div className="py-12 text-center text-sm text-slate-400">暂无待审批事项</div>
          ) : (
            <div className="space-y-3">
              {pending.map((a) => (
                <div key={a.id} onClick={() => navigate('/supervisor/approvals')} className="p-3 rounded-xl border border-slate-100 hover:shadow-md hover:border-warning-200 transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-semibold text-sm text-primary-800 truncate">{a.origin} → {a.destination}</div>
                    {a.over_amount > 0 && <span className="tag-pill bg-danger-500/15 text-danger-600 shrink-0">超¥{a.over_amount.toFixed(0)}</span>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
                    <span>{a.applicantName} · {formatDateTime(a.startTime)}</span>
                    <span className="font-mono font-bold text-primary-700">{formatMoney(a.estimated_cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" /> 部门费用分布
          </h3>
          <div className="h-64">
            {deptData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deptData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}>
                    {deptData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoney(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-sm text-slate-400">暂无数据</div>}
          </div>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent-500" /> 月度费用趋势
          </h3>
          <div className="h-64">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef4fb" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatMoney(v)} />
                  <Bar dataKey="value" fill="#2e63a6" radius={[6, 6, 0, 0]} name="费用" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-sm text-slate-400">暂无数据</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
