import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatMoney, vehicleStatusLabel, vehicleStatusColor, driverStatusLabel, driverStatusColor, maintenanceAlertLevelColor } from '../../lib/format.js';
import type { Vehicle, Driver } from '../../../shared/types.js';
import { Car, Users, FileCheck, Clock, ChevronRight, AlertTriangle, UserCheck, AlertOctagon, Gauge, Star, Activity } from 'lucide-react';

export default function DispatcherDashboard() {
  const navigate = useNavigate();
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [stats, setStats] = useState({ vehicles: { total: 7, inUse: 3, idle: 3, maintenance: 1 }, drivers: { total: 3, onDuty: 2, idle: 1 }, pending: { approvals: 5, dispatch: 8 }, monthlyCost: 58230 });
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [recentApps, setRecentApps] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const dash = await api.dashboard.summary() as unknown as Record<string, unknown>;
        if (dash.vehicleStats) setStats((s) => ({ ...s, vehicles: dash.vehicleStats as Record<string, number> }));
        if (dash.driverStats) setStats((s) => ({ ...s, drivers: dash.driverStats as Record<string, number> }));
        if (dash.monthlyCost) setStats((s) => ({ ...s, monthlyCost: dash.monthlyCost as number }));

        try {
          const mv = await api.maintenance.getAlerts() as unknown as Array<Record<string, unknown>>;
          setMaintenanceAlerts(mv.filter((m) => m.alertLevel !== 'normal').slice(0, 5));
        } catch {}
        try {
          const apps = await api.applications.list({ pageSize: 5 }) as unknown as { list?: Array<Record<string, unknown>> };
          setRecentApps(apps.list || []);
        } catch {}
        void toast;
      } finally { setLoading(false); }
    };
    load();
  }, [setLoading]);

  const kpis = [
    { t: '车辆总数', n: stats.vehicles.total, s: `${stats.vehicles.inUse}在途 ${stats.vehicles.idle}空闲`, c: 'from-primary-400 to-primary-600', i: <Car className="w-6 h-6" />, go: '/dispatch/vehicles' },
    { t: '司机总数', n: stats.drivers.total, s: `${stats.drivers.onDuty}出勤 ${stats.drivers.idle}休息`, c: 'from-accent-400 to-accent-600', i: <Users className="w-6 h-6" />, go: '/dispatch/drivers' },
    { t: '待派车申请', n: 12, s: '需紧急处理', c: 'from-warning-400 to-warning-600', i: <Clock className="w-6 h-6" />, go: '/dispatch/dispatch' },
    { t: '月度费用', n: formatMoney(stats.monthlyCost), s: '本月累计', c: 'from-success-400 to-success-600', i: <FileCheck className="w-6 h-6" />, go: '/finance/bills' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map((k, i) => (
          <button key={i} onClick={() => navigate(k.go)} className="kpi-card text-left hover:shadow-cardHover transition-all">
            <div className={`absolute top-0 right-0 w-28 h-28 opacity-10 bg-gradient-to-br ${k.c} rounded-full -translate-y-8 translate-x-10`} />
            <div className="flex items-start justify-between mb-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${k.c} text-white flex items-center justify-center shadow-md`}>{k.i}</div>
              <ChevronRight className="w-5 h-5 text-slate-300 hover:text-primary-500" />
            </div>
            <div className="text-3xl font-black text-primary-900 tracking-tight font-mono">{k.n}</div>
            <div className="text-xs text-slate-500 mt-1">{k.t} <span className="text-primary-600 font-medium ml-1">{k.s}</span></div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-primary-800 flex items-center gap-2"><Clock className="w-5 h-5 text-warning-500" /> 待派车申请</h3>
            <button onClick={() => navigate('/dispatch/dispatch')} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium">查看全部 <ChevronRight className="w-3 h-3" /></button>
          </div>
          {recentApps.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">暂无待处理</div>
          ) : (
            <div className="space-y-3">
              {recentApps.slice(0, 5).map((a: Record<string, unknown>) => (
                <div key={a.id as number} className="p-4 rounded-xl border border-slate-100 hover:border-accent-200 hover:bg-accent-50/30 cursor-pointer transition-all flex flex-wrap items-center gap-4" onClick={() => navigate('/dispatch/dispatch')}>
                  <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-primary-900 text-sm truncate">{a.origin as string} → {a.destination as string}</span>
                      <span className="text-[10px] text-slate-400 font-mono">#{String(a.id as number).padStart(6, '0')}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                      <span>{a.applicantName as string}</span>
                      <span>· {a.startTime ? String(a.startTime).slice(5, 16) : ''}</span>
                      <span className="text-primary-700 font-semibold">{formatMoney((a.estimatedCost || 0) as number)}</span>
                    </div>
                  </div>
                  <button className="btn-primary text-xs !py-1.5 !px-3">智能派车</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-primary-800 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning-500" /> 保养预警</h3>
            <button onClick={() => navigate('/dispatch/maintenance')} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium">查看全部 <ChevronRight className="w-3 h-3" /></button>
          </div>
          {maintenanceAlerts.length === 0 ? (
            <div className="py-8 text-center"><UserCheck className="w-12 h-12 mx-auto text-success-400 mb-2" /><p className="text-xs text-slate-400">全部车辆状态良好</p></div>
          ) : (
            <div className="space-y-3">
              {maintenanceAlerts.map((m: Record<string, unknown>, i: number) => {
                const level = m.alertLevel as string;
                return (
                  <div key={i} className={`p-3 rounded-xl border-2 ${level === 'danger' ? 'bg-danger-50 border-danger-300' : 'bg-warning-50 border-warning-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold text-sm ${level === 'danger' ? 'text-danger-700' : 'text-warning-700'}`}>
                        {level === 'danger' ? <AlertOctagon className="w-4 h-4 inline mr-1" /> : <AlertTriangle className="w-4 h-4 inline mr-1" />}
                        {m.vehiclePlateNumber as string}
                      </span>
                      <span className={`tag-pill text-[10px] ${maintenanceAlertLevelColor(level)}`}>{level === 'danger' ? '需立即保养' : '即将到期'}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {m.vehicleBrand as string} {m.vehicleModel as string} · 已行驶{(m.mileage as number)?.toLocaleString()}km
                    </div>
                    <div className={`text-xs font-semibold mt-1 ${level === 'danger' ? 'text-danger-600' : 'text-warning-600'}`}>
                      距离下次保养：{(m.milesUntilService as number)?.toLocaleString()} km
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-primary-800 flex items-center gap-2"><Car className="w-5 h-5 text-primary-600" /> 车辆状态概览</h3>
            <button onClick={() => navigate('/dispatch/vehicles')} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium">管理 <ChevronRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-3">
            {['inUse', 'idle', 'maintenance', 'available'].map((status, i) => {
              const count = [stats.vehicles.inUse, stats.vehicles.idle, stats.vehicles.maintenance, Math.max(0, stats.vehicles.total - stats.vehicles.inUse - stats.vehicles.idle - stats.vehicles.maintenance)][i];
              const pct = Math.round((count / Math.max(1, stats.vehicles.total)) * 100);
              return (
                <div key={status} className="group">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-primary-800">{vehicleStatusLabel[status as keyof typeof vehicleStatusLabel] || status}</span>
                    <span className="font-mono font-bold text-primary-900">{count} 辆 <span className="text-slate-400 text-xs">({pct}%)</span></span>
                  </div>
                  <div className="progress-bar h-3"><div className={`progress-fill ${vehicleStatusColor[status as keyof typeof vehicleStatusColor] || 'bg-primary-500'.replace('bg-', 'bg-')}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-primary-800 flex items-center gap-2"><Users className="w-5 h-5 text-accent-500" /> 司机状态概览</h3>
            <button onClick={() => navigate('/dispatch/drivers')} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium">管理 <ChevronRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-3">
            {Array.from({ length: Math.min(stats.drivers.total, 3) }, (_, i) => {
              const names = ['王建国', '李志远', '张师傅'];
              const plateNums = ['京A·99168', '京A·33612', '京A·10086'];
              const rating = [4.92, 4.88, 4.78];
              const trips = [120, 98, 76];
              const statuses: Driver['status'][] = ['on_duty', 'on_duty', 'resting'];
              const st = statuses[i];
              return (
                <div key={i} className="p-3 rounded-xl border border-slate-100 hover:shadow-sm hover:border-primary-200 transition-all flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white font-bold flex items-center justify-center shrink-0 text-lg">
                    {names[i][0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary-900 text-sm">{names[i]}</span>
                      <span className={`tag-pill text-[10px] ${driverStatusColor[st]}`}>{driverStatusLabel[st]}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{plateNums[i]}</span>
                      <span>·</span>
                      <span className="text-warning-600 flex items-center gap-0.5"><Star className="w-3 h-3" />{rating[i]}</span>
                      <span>·</span>
                      <span><Gauge className="w-3 h-3 inline" /> {trips[i]}次</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
