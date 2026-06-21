import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatMoney } from '../../lib/format.js';
import { TrendingUp, Car, BarChart3, PieChart } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

const PIE_COLORS = ['#2e63a6', '#00bcd4', '#ff9800', '#4caf50', '#f44336'];

export default function SupervisorStatistics() {
  const user = useAppStore((s) => s.user);
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [monthly, setMonthly] = useState<Array<Record<string, unknown>>>([]);
  const [byCarType, setByCarType] = useState<Array<Record<string, unknown>>>([]);
  const [summary, setSummary] = useState({ totalBills: 0, totalCost: 0, avgCost: 0 });

  useEffect(() => {
    const load = async () => {
      if (!user?.departmentId) return;
      try {
        setLoading(true);
        const [m, c] = await Promise.all([
          api.finance.statistics({ type: 'monthly' }),
          api.finance.statistics({ type: 'carType' }),
        ]);
        const md = m as unknown as { data: Array<Record<string, unknown>>; summary: { totalBills: number; totalCost: number; avgCost: number } };
        const cd = c as unknown as { data: Array<Record<string, unknown>> };
        setMonthly(md.data || []);
        setByCarType(cd.data || []);
        if (md.summary) setSummary(md.summary);
      } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
      finally { setLoading(false); }
    };
    load();
  }, [user, setLoading]);

  const kpis = [
    { label: '累计用车次数', value: summary.totalBills, unit: '次', icon: <Car className="w-6 h-6" />, color: 'from-primary-400 to-primary-600' },
    { label: '累计用车费用', value: formatMoney(summary.totalCost), unit: '', icon: <PieChart className="w-6 h-6" />, color: 'from-accent-400 to-accent-600' },
    { label: '平均单次费用', value: formatMoney(summary.avgCost), unit: '', icon: <BarChart3 className="w-6 h-6" />, color: 'from-warning-400 to-warning-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {kpis.map((k, i) => (
          <div key={i} className="kpi-card">
            <div className={`absolute top-0 right-0 w-28 h-28 opacity-10 bg-gradient-to-br ${k.color} rounded-full -translate-y-8 translate-x-10`} />
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${k.color} text-white flex items-center justify-center shadow-md mb-3`}>{k.icon}</div>
            <div className="text-3xl font-black text-primary-900 tracking-tight font-mono">{k.value}<span className="text-sm font-normal text-slate-500 ml-1">{k.unit}</span></div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">{k.label} <TrendingUp className="w-3 h-3 text-success-500" /></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary-600" /> 月度用车费用趋势</h3>
          <div className="h-72">
            {monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="c1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00bcd4" stopOpacity={0.4} /><stop offset="95%" stopColor="#00bcd4" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef4fb" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip formatter={(v: number) => formatMoney(v)} />
                  <Area type="monotone" dataKey="value" stroke="#00bcd4" strokeWidth={3} fill="url(#c1)" name="费用" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-sm text-slate-400">暂无数据</div>}
          </div>
        </div>

        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2"><PieChart className="w-5 h-5 text-warning-500" /> 车型费用占比</h3>
          <div className="h-72">
            {byCarType.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RPieChart>
                  <Pie data={byCarType} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={40} label={({ name, value }) => `${name} ${formatMoney(value as number)}`}>
                    {byCarType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoney(v)} />
                </RPieChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-sm text-slate-400">暂无数据</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
