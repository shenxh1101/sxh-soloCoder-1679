import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { TrendingUp, Users, Car, PieChart, BarChart3 } from 'lucide-react';
import { formatMoney } from '../../lib/format.js';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts';

const PIE_COLORS = ['#2e63a6', '#00bcd4', '#ff9800', '#4caf50', '#f44336'];

export default function SupervisorStatistics() {
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [stats, setStats] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // mock data for demonstration
        setStats({
          total: { count: 156, cost: 128500, avg: 823.72 },
          byMonth: Array.from({ length: 12 }, (_, i) => ({ month: `${i + 1}月`, 次数: Math.floor(Math.random() * 30) + 8, 费用: Math.floor(Math.random() * 25000) + 5000 })),
          byCarType: [
            { name: '普通轿车', value: 68, cost: 42000 },
            { name: 'SUV越野车', value: 32, cost: 28000 },
            { name: '商务面包', value: 42, cost: 38500 },
            { name: '豪华商务', value: 14, cost: 20000 },
          ],
          byTop5: [
            { 员工: '张三', 次数: 28, 费用: 23500 },
            { 员工: '李四', 次数: 24, 费用: 19800 },
            { 员工: '王五', 次数: 19, 费用: 16200 },
            { 员工: '赵六', 次数: 15, 费用: 12600 },
            { 员工: '钱七', 次数: 12, 费用: 9800 },
          ],
          weekly: Array.from({ length: 7 }, (_, i) => ({ 星期: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i], 用车: Math.floor(Math.random() * 15) + 2 })),
        });
        void api; void toast;
      } finally { setLoading(false); }
    };
    load();
  }, [setLoading]);

  const kpis = [
    { label: '累计用车次数', value: (stats.total as Record<string, number>)?.count || 0, unit: '次', icon: <Car className="w-6 h-6" />, color: 'from-primary-400 to-primary-600' },
    { label: '累计用车费用', value: formatMoney((stats.total as Record<string, number>)?.cost || 0), unit: '', icon: <PieChart className="w-6 h-6" />, color: 'from-accent-400 to-accent-600' },
    { label: '平均单次费用', value: formatMoney((stats.total as Record<string, number>)?.avg || 0), unit: '', icon: <BarChart3 className="w-6 h-6" />, color: 'from-warning-400 to-warning-600' },
    { label: '涉及员工数', value: 36, unit: '人', icon: <Users className="w-6 h-6" />, color: 'from-success-400 to-success-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
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
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2"><BarChart className="w-5 h-5 text-primary-600" /> 月度用车费用趋势</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.byMonth as unknown[] || []}>
                <defs>
                  <linearGradient id="c1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00bcd4" stopOpacity={0.4} /><stop offset="95%" stopColor="#00bcd4" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef4fb" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="费用" stroke="#00bcd4" strokeWidth={3} fill="url(#c1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2"><PieChart className="w-5 h-5 text-warning-500" /> 车型费用占比</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={(stats.byCarType as unknown[] || []) as Array<Record<string, unknown>>} dataKey="cost" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40} label={({ name, value }) => `${name} ${formatMoney(value as number)}`}>
                  {Array.from({ length: 4 }).map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-accent-500" /> 员工用车次数Top5</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byTop5 as unknown[] || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#eef4fb" />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                <YAxis dataKey="员工" type="category" stroke="#94a3b8" fontSize={12} width={60} />
                <Tooltip />
                <Bar dataKey="次数" fill="#2e63a6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-success-500" /> 周用车频率</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weekly as unknown[] || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef4fb" />
                <XAxis dataKey="星期" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="用车" stroke="#4caf50" strokeWidth={3} dot={{ r: 5, fill: '#4caf50' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
