import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatDateTime, formatMoney, applicationStatusLabel, applicationStatusColor, vehicleStatusLabel, vehicleStatusColor, driverStatusLabel, driverStatusColor, carTypeLabel } from '../../lib/format.js';
import type { Application, MatchSuggestion } from '../../../shared/types.js';
import { FilePlus, Search, Zap, Car, Users, ChevronRight, CheckCircle2, Star, AlertTriangle, AlertOctagon, Clock, ShieldCheck, Target, Ban } from 'lucide-react';

type PendingRow = Application & { autoDispatchFailed?: boolean; failReason?: string };

export default function DispatchCenter() {
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [selected, setSelected] = useState<PendingRow | null>(null);
  const [suggestion, setSuggestion] = useState<MatchSuggestion | null>(null);
  const [selVehicleId, setSelVehicleId] = useState<number | null>(null);
  const [selDriverId, setSelDriverId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const r = await api.dispatch.pending();
      setPending(r as unknown as PendingRow[]);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const suggest = async (app: PendingRow) => {
    setSelected(app);
    setSelVehicleId(null);
    setSelDriverId(null);
    try {
      setLoading(true);
      const r = await api.dispatch.suggest(app.id);
      setSuggestion(r as unknown as MatchSuggestion);
      const vs = (r as MatchSuggestion).vehicles;
      const ds = (r as MatchSuggestion).drivers;
      if (vs.length) setSelVehicleId(vs[0].vehicle.id);
      if (ds.length) setSelDriverId(ds[0].driver.id);
    } catch (e) { toast.error((e as { message?: string }).message || '匹配失败'); }
    finally { setLoading(false); }
  };

  const assign = async (appId: number, vehicleId: number, driverId: number) => {
    try {
      setAssigning(true);
      await api.dispatch.assign(appId, { vehicleId, driverId });
      toast.success('派车成功！已通知司机和申请人');
      setSuggestion(null); setSelected(null);
      setSelVehicleId(null); setSelDriverId(null);
      load();
    } catch (e) { toast.error((e as { message?: string }).message || '派车失败'); }
    finally { setAssigning(false); }
  };

  const failBadge = (r: string) => {
    if (r.includes('司机排班') || r.includes('司机')) {
      return { text: r, cls: 'bg-danger-500/15 text-danger-700 border-danger-200', icon: <Users className="w-3 h-3" /> };
    }
    if (r.includes('车辆')) {
      return { text: r, cls: 'bg-warning-500/15 text-warning-700 border-warning-200', icon: <Car className="w-3 h-3" /> };
    }
    if (r.includes('确认')) {
      return { text: r, cls: 'bg-primary-500/15 text-primary-700 border-primary-200', icon: <Target className="w-3 h-3" /> };
    }
    return { text: r, cls: 'bg-slate-500/15 text-slate-700 border-slate-200', icon: <AlertTriangle className="w-3 h-3" /> };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-1 card max-h-[700px] overflow-y-auto">
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-white py-1 z-10">
            <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
              <FilePlus className="w-5 h-5 text-warning-500" /> 待派车申请 ({pending.length})
            </h3>
          </div>
          {pending.length === 0 ? (
            <div className="py-12 text-center"><CheckCircle2 className="w-12 h-12 mx-auto text-success-300 mb-2" /><p className="text-sm text-slate-400">暂无待派车</p></div>
          ) : (
            <div className="space-y-3">
              {pending.map((a) => {
                const badge = a.failReason ? failBadge(a.failReason) : null;
                return (
                  <button key={a.id} onClick={() => suggest(a)} className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selected?.id === a.id ? 'border-accent-400 bg-accent-50/30 shadow-md' : 'border-slate-100 hover:border-primary-200 hover:shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`tag-pill ${applicationStatusColor[a.status]}`}>{applicationStatusLabel[a.status]}</span>
                        {a.autoDispatchFailed && badge && (
                          <span className={`tag-pill border ${badge.cls} flex items-center gap-1`}>
                            {badge.icon} {badge.text}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">#{String(a.id).padStart(6, '0')}</span>
                    </div>
                    <div className="text-sm font-bold text-primary-900 line-clamp-1">{a.origin} → {a.destination}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{a.applicantName}</span>
                      <span>· {a.departmentName}</span>
                      <span className="font-mono text-primary-700 font-semibold">{formatMoney(a.estimatedCost ?? 0)}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDateTime(a.startTime).slice(5, 16)} ~ {formatDateTime(a.endTime).slice(11, 16)}
                      <span className="ml-1">· {a.carTypePreference ? carTypeLabel[a.carTypePreference] : '不限车型'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="xl:col-span-2 space-y-5">
          {selected ? (
            <>
              <div className="card">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                  <h3 className="text-base font-bold text-primary-800">申请详情</h3>
                  {selected.failReason && (
                    <div className={`tag-pill border ${failBadge(selected.failReason).cls} text-xs flex items-center gap-1.5 px-3 py-1.5`}>
                      <AlertOctagon className="w-3.5 h-3.5" /> 自动派车失败原因：{selected.failReason}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50"><div className="text-[11px] text-slate-500">申请人</div><div className="text-sm font-bold text-primary-800">{selected.applicantName}</div></div>
                  <div className="p-3 rounded-xl bg-slate-50"><div className="text-[11px] text-slate-500">部门</div><div className="text-sm font-bold text-primary-800">{selected.departmentName || '-'}</div></div>
                  <div className="p-3 rounded-xl bg-slate-50"><div className="text-[11px] text-slate-500">乘车人数</div><div className="text-sm font-bold text-primary-800">{selected.passengers}人</div></div>
                  <div className="p-3 rounded-xl bg-slate-50"><div className="text-[11px] text-slate-500">预估费用</div><div className="text-sm font-bold text-accent-600 font-mono">{formatMoney(selected.estimatedCost ?? 0)}</div></div>
                </div>
                <div className="mt-3 p-3 rounded-xl bg-primary-50/50">
                  <div className="text-[11px] text-slate-500 mb-1">行程</div>
                  <div className="text-sm font-bold text-primary-900">{selected.origin} → {selected.destination}</div>
                  <div className="text-xs text-slate-500 mt-1">事由：{selected.reason}</div>
                </div>
              </div>

              {suggestion && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="card">
                    <h3 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2"><Car className="w-4 h-4 text-primary-600" /> 候选车辆</h3>
                    {suggestion.vehicles.length === 0 ? (
                      <div className="py-6 text-center">
                        <Ban className="w-10 h-10 mx-auto text-danger-300 mb-2" />
                        <p className="text-sm text-danger-600 font-semibold">无可用车辆</p>
                        <p className="text-xs text-slate-400 mt-1">请检查维修保养或调整用车时间</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {suggestion.vehicles.map((v, i) => {
                          const hasConflict = (v.conflicts?.length ?? 0) > 0;
                          const sel = selVehicleId === v.vehicle.id;
                          return (
                            <button
                              key={i}
                              onClick={() => setSelVehicleId(v.vehicle.id)}
                              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${sel ? 'border-primary-500 bg-primary-50/60 shadow-md' : hasConflict ? 'border-warning-200 bg-warning-50/30 hover:border-warning-300' : 'border-slate-100 hover:border-primary-200'}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-primary-900 flex items-center gap-1.5">
                                    {sel && <CheckCircle2 className="w-4 h-4 text-primary-600" />}
                                    {v.vehicle.plateNumber}
                                  </span>
                                  <span className={`tag-pill ${v.score >= 80 ? 'bg-success-500/15 text-success-700' : v.score >= 60 ? 'bg-primary-500/15 text-primary-700' : 'bg-warning-500/15 text-warning-700'} text-[10px]`}>推荐度 {v.score}</span>
                                </div>
                                <span className={`tag-pill ${vehicleStatusColor[v.vehicle.status]}`}>{vehicleStatusLabel[v.vehicle.status]}</span>
                              </div>
                              <div className="text-xs text-slate-500">{v.vehicle.brand} {v.vehicle.model} · {carTypeLabel[v.vehicle.carType]} · {v.vehicle.seatingCapacity}座 · {v.vehicle.currentMileage.toLocaleString()}km</div>
                              <div className="mt-1.5 flex items-start gap-1 text-xs text-accent-600 flex-wrap">
                                <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0" /> 推荐理由：{v.reason || '综合推荐'}
                              </div>
                              {hasConflict && (
                                <div className="mt-2 space-y-1">
                                  {v.conflicts!.slice(0, 2).map((c, ci) => (
                                    <div key={ci} className="text-[11px] text-warning-700 bg-warning-500/10 border border-warning-500/20 rounded px-2 py-1 flex items-center gap-1.5">
                                      <AlertTriangle className="w-3 h-3 shrink-0" /> 冲突说明：{c}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="card">
                    <h3 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-accent-500" /> 候选司机</h3>
                    {suggestion.drivers.length === 0 ? (
                      <div className="py-6 text-center">
                        <Ban className="w-10 h-10 mx-auto text-danger-300 mb-2" />
                        <p className="text-sm text-danger-600 font-semibold">无可用司机</p>
                        <p className="text-xs text-slate-400 mt-1">该时段无司机排班在岗</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {suggestion.drivers.map((d, i) => {
                          const hasConflict = (d.conflicts?.length ?? 0) > 0;
                          const sel = selDriverId === d.driver.id;
                          return (
                            <button
                              key={i}
                              onClick={() => setSelDriverId(d.driver.id)}
                              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${sel ? 'border-accent-500 bg-accent-50/60 shadow-md' : hasConflict ? 'border-warning-200 bg-warning-50/30 hover:border-warning-300' : 'border-slate-100 hover:border-accent-200'}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-primary-900 flex items-center gap-1.5">
                                    {sel && <CheckCircle2 className="w-4 h-4 text-accent-600" />}
                                    {d.driver.name}
                                  </span>
                                  <span className={`tag-pill ${d.score >= 80 ? 'bg-success-500/15 text-success-700' : d.score >= 60 ? 'bg-accent-500/15 text-accent-700' : 'bg-warning-500/15 text-warning-700'} text-[10px]`}>推荐度 {d.score}</span>
                                </div>
                                <span className={`tag-pill ${driverStatusColor[d.driver.status]}`}>{driverStatusLabel[d.driver.status]}</span>
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                <Star className="w-3 h-3 inline text-warning-500 fill-warning-400" />{d.driver.avgRating}分 · {d.driver.totalTrips}次服务 · {d.driver.licenseType}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">📱 {d.driver.phone}</div>
                              <div className="mt-1.5 flex items-start gap-1 text-xs text-accent-600 flex-wrap">
                                <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0" /> 推荐理由：{d.reason || '综合推荐'}
                              </div>
                              {hasConflict && (
                                <div className="mt-2 space-y-1">
                                  {d.conflicts!.slice(0, 2).map((c, ci) => (
                                    <div key={ci} className="text-[11px] text-warning-700 bg-warning-500/10 border border-warning-500/20 rounded px-2 py-1 flex items-center gap-1.5">
                                      <AlertTriangle className="w-3 h-3 shrink-0" /> 冲突说明：{c}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {suggestion && selVehicleId != null && selDriverId != null && (
                <button
                  onClick={() => assign(selected.id, selVehicleId, selDriverId)}
                  disabled={assigning}
                  className="btn-accent w-full !h-12 !text-base font-bold !rounded-xl flex items-center justify-center gap-2"
                >
                  <Zap className="w-5 h-5" /> {assigning ? '派车中...' : `确认派车（车辆#${selVehicleId} + 司机#${selDriverId}）`}
                </button>
              )}

              {suggestion && (selVehicleId == null || selDriverId == null) && selVehicleId !== undefined && (
                <div className="card bg-warning-50 border-warning-200 text-warning-700 text-sm text-center py-4">
                  请分别在左右侧选好车辆和司机后派车
                </div>
              )}
            </>
          ) : (
            <div className="card text-center py-20">
              <FilePlus className="w-16 h-16 mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400">请在左侧选择一个申请进行智能匹配</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
