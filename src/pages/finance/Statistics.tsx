import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatMoney } from '../../lib/format.js';
import { BarChart3, PieChart, TrendingUp, DollarSign } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, Legend
} from 'recharts';

const PIE_COLORS = ['#2e63a6', '#00bcd4', '#ff9800', '#4caf50', '#f44336', '#9c27b0'];

export default function FinanceStatistics() {
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [monthly, setMonthly] = useState<Array<Record<string, unknown>>>([]);
  const [byDept, setByDept] = useState<Array<Record<string, unknown>>>([]);
  const [byCarType, setByCarType] = useState<Array<Record<string, unknown>>>([]);
  const [summary, setSummary] = useState({ totalBills: 0, totalCost: 0, avgCost: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [m, d, c] = await Promise.all([
          api.finance.statistics({ type: 'monthly' }),
          api.finance.statistics({ type: 'department' }),
          api.finance.statistics({ type: 'carType' }),
        ]);
        const md = m as unknown as { data: Array<Record<string, unknown>>; summary: { totalBills: number; totalCost: number; avgCost: number } };
        const dd = d as unknown as { data: Array<Record<string, unknown>> };
        const cd = c as unknown as { data: Array<Record<string, unknown>> };
        setMonthly(md.data || []);
        setByDept(dd.data || []);
        setByCarType(cd.data || []);
        if (md.summary) setSummary(md.summary);
      } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
      finally { setLoading(false); }
    };
    load();
  }, [setLoading]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="kpi-card">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center shadow-md mb-3"><DollarSign className="w-6 h-6" /></div>
          <div className="text-3xl font-black text-primary-900 tracking-tight font-mono">{formatMoney(summary.totalCost)}</div>
          <div className="text-xs text-slate-500 mt-1">已审核总费用</div>
        </div>
        <div className="kpi-card">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white flex items-center justify-center shadow-md mb-3"><BarChart3 className="w-6 h-6" /></div>
          <div className="text-3xl font-black text-primary-900 tracking-tight font-mono">{summary.totalBills}</div>
          <div className="text-xs text-slate-500 mt-1">已审核账单数</div>
        </div>
        <div className="kpi-card">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-400 to-success-600 text-white flex items-center justify-center shadow-md mb-3"><TrendingUp className="w-6 h-6" /></div>
          <div className="text-3xl font-black text-primary-900 tracking-tight font-mono">{formatMoney(summary.avgCost)}</div>
          <div className="text-xs text-slate-500 mt-1">平均单笔费用</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary-600" /> 月度费用趋势</h3>
          <div className="h-72">
            {monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef4fb" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip formatter={(v: number) => formatMoney(v)} />
                  <Bar dataKey="value" fill="#00bcd4" radius={[6, 6, 0, 0]} name="费用" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-sm text-slate-400">暂无数据</div>}
          </div>
        </div>

        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2"><PieChart className="w-5 h-5 text-accent-500" /> 部门费用占比</h3>
          <div className="h-72">
            {byDept.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RPieChart>
                  <Pie data={byDept} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={40} label={({ name, value }) => `${name} ${formatMoney(value as number)}`}>
                    {byDept.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoney(v)} />
                  <Legend />
                </RPieChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-sm text-slate-400">暂无数据</div>}
          </div>
        </div>

        <div className="card xl:col-span-2">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-success-500" /> 车型费用分布</h3>
          <div className="h-64">
            {byCarType.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCarType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef4fb" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                  <YAxis dataKey="label" type="category" stroke="#94a3b8" fontSize={12} width={80} />
                  <Tooltip formatter={(v: number) => formatMoney(v)} />
                  <Bar dataKey="value" fill="#2e63a6" radius={[0, 6, 6, 0]} name="费用" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-sm text-slate-400">暂无数据</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
