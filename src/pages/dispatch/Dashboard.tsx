import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatMoney, vehicleStatusLabel, vehicleStatusColor, driverStatusLabel, driverStatusColor, maintenanceAlertLevelColor } from '../../lib/format.js';
import type { Vehicle } from '../../../shared/types.js';
import { Car, Users, FileCheck, Clock, ChevronRight, AlertTriangle, UserCheck, AlertOctagon, Gauge, Star, Activity } from 'lucide-react';

export default function DispatcherDashboard() {
  const navigate = useNavigate();
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [stats, setStats] = useState({ vehicles: {} as Record<string, number>, pendingBills: 0, maintenanceAlertCount: 0, monthlyCost: 0 });
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [recentApps, setRecentApps] = useState<Array<Record<string, unknown>>>([]);
  const [driverList, setDriverList] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const dash = await api.dashboard.summary() as unknown as Record<string, unknown>;
        const vehicleStats = (dash.vehicleStats || {}) as Record<string, number>;
        const total = Object.values(vehicleStats).reduce((a, b) => a + b, 0);
        setStats({
          vehicles: { ...vehicleStats, total },
          pendingBills: (dash.pendingBills as number) || 0,
          maintenanceAlertCount: (dash.maintenanceAlertCount as number) || 0,
          monthlyCost: 0,
        });

        try {
          const mv = await api.maintenance.alerts() as unknown as Array<Record<string, unknown>>;
          setMaintenanceAlerts(mv.filter((m) => m.alertLevel !== 'normal').slice(0, 5));
        } catch {}
        try {
          const apps = await api.applications.list({ size: 5 }) as unknown as { list?: Array<Record<string, unknown>> };
          setRecentApps(apps.list || []);
        } catch {}
        try {
          const dr = await api.drivers.list() as unknown as Array<Record<string, unknown>>;
          setDriverList(dr);
        } catch {}
        void toast;
      } finally { setLoading(false); }
    };
    load();
  }, [setLoading]);

  const kpis = [
    { t: '车辆总数', n: stats.vehicles.total || 0, s: `${stats.vehicles.in_use || 0}在途 ${stats.vehicles.idle || 0}空闲`, c: 'from-primary-400 to-primary-600', i: <Car className="w-6 h-6" />, go: '/dispatcher/vehicles' },
    { t: '保养预警', n: stats.maintenanceAlertCount || 0, s: '需关注', c: 'from-warning-400 to-warning-600', i: <AlertTriangle className="w-6 h-6" />, go: '/dispatcher/maintenance' },
    { t: '待派车申请', n: recentApps.length, s: '需紧急处理', c: 'from-accent-400 to-accent-600', i: <Clock className="w-6 h-6" />, go: '/dispatcher/dispatch' },
    { t: '待审账单', n: stats.pendingBills || 0, s: '财务待处理', c: 'from-success-400 to-success-600', i: <FileCheck className="w-6 h-6" />, go: '/finance/bills' },
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
            <button onClick={() => navigate('/dispatcher/dispatch')} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium">查看全部 <ChevronRight className="w-3 h-3" /></button>
          </div>
          {recentApps.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">暂无待处理</div>
          ) : (
            <div className="space-y-3">
              {recentApps.slice(0, 5).map((a: Record<string, unknown>) => (
                <div key={a.id as number} className="p-4 rounded-xl border border-slate-100 hover:border-accent-200 hover:bg-accent-50/30 cursor-pointer transition-all flex flex-wrap items-center gap-4" onClick={() => navigate('/dispatcher/dispatch')}>
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
            <button onClick={() => navigate('/dispatcher/maintenance')} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium">查看全部 <ChevronRight className="w-3 h-3" /></button>
          </div>
          {maintenanceAlerts.length === 0 ? (
            <div className="py-8 text-center"><UserCheck className="w-12 h-12 mx-auto text-success-400 mb-2" /><p className="text-xs text-slate-400">全部车辆状态良好</p></div>
          ) : (
            <div className="space-y-3">
              {maintenanceAlerts.map((m: Record<string, unknown>, i: number) => {
                const level = m.alertLevel as string;
                const v = (m.vehicle as Record<string, unknown>) || {};
                return (
                  <div key={i} className={`p-3 rounded-xl border-2 ${level === 'danger' ? 'bg-danger-50 border-danger-300' : 'bg-warning-50 border-warning-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold text-sm ${level === 'danger' ? 'text-danger-700' : 'text-warning-700'}`}>
                        {level === 'danger' ? <AlertOctagon className="w-4 h-4 inline mr-1" /> : <AlertTriangle className="w-4 h-4 inline mr-1" />}
                        {v.plateNumber as string}
                      </span>
                      <span className={`tag-pill text-[10px] ${maintenanceAlertLevelColor(level)}`}>{level === 'danger' ? '需立即保养' : '即将到期'}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {v.brand as string} {v.model as string} · 已行驶{(m.currentMileage as number)?.toLocaleString()}km
                    </div>
                    <div className={`text-xs font-semibold mt-1 ${level === 'danger' ? 'text-danger-600' : 'text-warning-600'}`}>
                      距离下次保养：{(m.distanceToMaintenance as number)?.toLocaleString()} km
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
            <button onClick={() => navigate('/dispatcher/vehicles')} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium">管理 <ChevronRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-3">
            {(['idle', 'in_use', 'maintenance', 'repair'] as const).map((status) => {
              const count = stats.vehicles[status] || 0;
              const pct = Math.round((count / Math.max(1, stats.vehicles.total || 1)) * 100);
              return (
                <div key={status} className="group">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-primary-800">{vehicleStatusLabel[status] || status}</span>
                    <span className="font-mono font-bold text-primary-900">{count} 辆 <span className="text-slate-400 text-xs">({pct}%)</span></span>
                  </div>
                  <div className="progress-bar h-3"><div className={`progress-fill ${vehicleStatusColor[status]}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-primary-800 flex items-center gap-2"><Users className="w-5 h-5 text-accent-500" /> 司机状态概览</h3>
            <button onClick={() => navigate('/dispatcher/drivers')} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium">管理 <ChevronRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-3">
            {driverList.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">暂无司机</div>
            ) : (
              driverList.slice(0, 5).map((d, i) => {
                const st = (d.status as string) || 'off_duty';
                return (
                  <div key={i} className="p-3 rounded-xl border border-slate-100 hover:shadow-sm hover:border-primary-200 transition-all flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white font-bold flex items-center justify-center shrink-0 text-lg">
                      {(d.name as string)?.slice(-1) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary-900 text-sm">{d.name as string}</span>
                        <span className={`tag-pill text-[10px] ${driverStatusColor[st as keyof typeof driverStatusColor] || 'bg-slate-100 text-slate-600'}`}>{driverStatusLabel[st as keyof typeof driverStatusLabel] || st}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{d.phone as string}</span>
                        <span>·</span>
                        <span className="text-warning-600 flex items-center gap-0.5"><Star className="w-3 h-3" />{(d.avgRating as number)?.toFixed(1)}</span>
                        <span>·</span>
                        <span><Gauge className="w-3 h-3 inline" /> {d.totalTrips as number}次</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
