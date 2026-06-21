import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatMoney } from '../../lib/format.js';
import { Receipt, Clock, CheckCircle2, TrendingUp, ChevronRight, PieChart, BarChart3, DollarSign, FileText } from 'lucide-react';

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [stats, setStats] = useState({ totalBills: 0, pendingBills: 0, totalCost: 0, avgCost: 0, approvedCost: 0 });
  const [recentBills, setRecentBills] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [billsRes, statRes] = await Promise.all([
          api.finance.bills({ page: 1, size: 5 }),
          api.finance.statistics({ type: 'monthly' }),
        ]);
        const billsData = billsRes as unknown as { list: Array<Record<string, unknown>>; total: number };
        const statData = statRes as unknown as { summary: { totalBills: number; totalCost: number; avgCost: number } };
        setRecentBills(billsData.list || []);
        const pending = (billsData.list || []).filter((b) => b.auditStatus === 'pending').length;
        setStats({
          totalBills: statData.summary?.totalBills || billsData.total || 0,
          pendingBills: pending || 0,
          totalCost: statData.summary?.totalCost || 0,
          avgCost: statData.summary?.avgCost || 0,
          approvedCost: statData.summary?.totalCost || 0,
        });
        void toast;
      } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const kpis = [
    { t: '账单总数', n: stats.totalBills, c: 'from-primary-400 to-primary-600', i: <Receipt className="w-6 h-6" />, go: '/finance/bills' },
    { t: '待审核', n: stats.pendingBills, c: 'from-warning-400 to-warning-600', i: <Clock className="w-6 h-6" />, go: '/finance/bills' },
    { t: '总费用', n: formatMoney(stats.totalCost), c: 'from-accent-400 to-accent-600', i: <DollarSign className="w-6 h-6" />, go: '/finance/statistics' },
    { t: '平均单笔', n: formatMoney(stats.avgCost), c: 'from-success-400 to-success-600', i: <TrendingUp className="w-6 h-6" />, go: '/finance/statistics' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map((k, i) => (
          <button key={i} onClick={() => navigate(k.go)} className="kpi-card text-left hover:shadow-cardHover transition-all">
            <div className={`absolute top-0 right-0 w-28 h-28 opacity-10 bg-gradient-to-br ${k.c} rounded-full -translate-y-8 translate-x-10`} />
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${k.c} text-white flex items-center justify-center shadow-md mb-3`}>{k.i}</div>
            <div className="text-3xl font-black text-primary-900 tracking-tight font-mono">{k.n}</div>
            <div className="text-xs text-slate-500 mt-1">{k.t}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-primary-800 flex items-center gap-2"><Clock className="w-5 h-5 text-warning-500" /> 待审核账单</h3>
            <button onClick={() => navigate('/finance/bills')} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium">查看全部 <ChevronRight className="w-3 h-3" /></button>
          </div>
          {recentBills.filter((b) => b.auditStatus === 'pending').length === 0 ? (
            <div className="py-10 text-center"><CheckCircle2 className="w-12 h-12 mx-auto text-success-300 mb-2" /><p className="text-xs text-slate-400">暂无待审核账单</p></div>
          ) : (
            <div className="space-y-3">
              {recentBills.filter((b) => b.auditStatus === 'pending').map((b, i) => (
                <div key={i} className="p-4 rounded-xl border border-warning-200 bg-warning-50/30 hover:shadow-md transition-all cursor-pointer" onClick={() => navigate('/finance/bills')}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-slate-400">{b.billNo as string}</span>
                    <span className="tag-pill bg-warning-500/15 text-warning-600">待审核</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-primary-900">{b.applicantName as string} · {b.departmentName as string}</div>
                      <div className="text-xs text-slate-500">里程 {(b.actualMileage as number)?.toLocaleString()}km · 时长{(b.actualDurationMin as number)}分钟</div>
                    </div>
                    <div className="text-xl font-black text-primary-800 font-mono">{formatMoney(b.totalCost as number)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-primary-800 flex items-center gap-2"><FileText className="w-5 h-5 text-accent-500" /> 最近账单</h3>
            <button onClick={() => navigate('/finance/bills')} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium">查看全部 <ChevronRight className="w-3 h-3" /></button>
          </div>
          {recentBills.length === 0 ? (
            <div className="py-10 text-center"><Receipt className="w-12 h-12 mx-auto text-slate-200 mb-2" /><p className="text-xs text-slate-400">暂无账单</p></div>
          ) : (
            <div className="space-y-2">
              {recentBills.slice(0, 5).map((b, i) => {
                const statusColors: Record<string, string> = { pending: 'bg-warning-500/15 text-warning-600', approved: 'bg-success-500/15 text-success-600', rejected: 'bg-danger-500/15 text-danger-600' };
                const statusLabels: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回' };
                return (
                  <div key={i} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-all flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${b.auditStatus === 'pending' ? 'bg-warning-500/10 text-warning-600' : b.auditStatus === 'approved' ? 'bg-success-500/10 text-success-600' : 'bg-danger-500/10 text-danger-600'}`}>
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="text-sm font-bold text-primary-900 truncate">{b.applicantName as string}</span><span className="tag-pill text-[10px] bg-slate-100 text-slate-600">{b.departmentName as string}</span></div>
                      <div className="text-[11px] text-slate-400 font-mono">{b.billNo as string}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black text-primary-800 font-mono">{formatMoney(b.totalCost as number)}</div>
                      <span className={`tag-pill text-[10px] ${statusColors[b.auditStatus as string] || ''}`}>{statusLabels[b.auditStatus as string] || b.auditStatus}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
