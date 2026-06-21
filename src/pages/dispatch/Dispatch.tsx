import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatDateTime, formatMoney, applicationStatusLabel, applicationStatusColor, vehicleStatusLabel, vehicleStatusColor, driverStatusLabel, driverStatusColor } from '../../lib/format.js';
import type { Application, MatchSuggestion } from '../../../shared/types.js';
import { FilePlus, Search, Zap, Car, Users, ChevronRight, CheckCircle2, Star } from 'lucide-react';

export default function DispatchCenter() {
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [pending, setPending] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [suggestion, setSuggestion] = useState<MatchSuggestion | null>(null);
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const r = await api.dispatch.pending();
      setPending(r as unknown as Application[]);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const suggest = async (app: Application) => {
    setSelected(app);
    try {
      setLoading(true);
      const r = await api.dispatch.suggest(app.id);
      setSuggestion(r as unknown as MatchSuggestion);
    } catch (e) { toast.error((e as { message?: string }).message || '匹配失败'); }
    finally { setLoading(false); }
  };

  const assign = async (appId: number, vehicleId: number, driverId: number) => {
    try {
      setAssigning(true);
      await api.dispatch.assign(appId, { vehicleId, driverId });
      toast.success('派车成功！已通知司机和申请人');
      setSuggestion(null); setSelected(null);
      load();
    } catch (e) { toast.error((e as { message?: string }).message || '派车失败'); }
    finally { setAssigning(false); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-1 card max-h-[700px] overflow-y-auto">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2 sticky top-0 bg-white py-1 z-10">
            <FilePlus className="w-5 h-5 text-warning-500" /> 待派车申请 ({pending.length})
          </h3>
          {pending.length === 0 ? (
            <div className="py-12 text-center"><CheckCircle2 className="w-12 h-12 mx-auto text-success-300 mb-2" /><p className="text-sm text-slate-400">暂无待派车</p></div>
          ) : (
            <div className="space-y-3">
              {pending.map((a) => (
                <button key={a.id} onClick={() => suggest(a)} className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selected?.id === a.id ? 'border-accent-400 bg-accent-50/30 shadow-md' : 'border-slate-100 hover:border-primary-200 hover:shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`tag-pill ${applicationStatusColor[a.status]}`}>{applicationStatusLabel[a.status]}</span>
                    <span className="text-[10px] text-slate-400 font-mono">#{String(a.id).padStart(6, '0')}</span>
                  </div>
                  <div className="text-sm font-bold text-primary-900 line-clamp-1">{a.origin} → {a.destination}</div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span>{a.applicantName}</span>
                    <span>· {formatDateTime(a.startTime).slice(5, 16)}</span>
                    <span className="font-mono text-primary-700 font-semibold">{formatMoney(a.estimatedCost ?? 0)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="xl:col-span-2 space-y-5">
          {selected ? (
            <>
              <div className="card">
                <h3 className="text-base font-bold text-primary-800 mb-3">申请详情</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50"><div className="text-[11px] text-slate-500">申请人</div><div className="text-sm font-bold text-primary-800">{selected.applicantName}</div></div>
                  <div className="p-3 rounded-xl bg-slate-50"><div className="text-[11px] text-slate-500">出发时间</div><div className="text-sm font-bold text-primary-800">{formatDateTime(selected.startTime).slice(5, 16)}</div></div>
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
                    <h3 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2"><Car className="w-4 h-4 text-primary-600" /> 推荐车辆</h3>
                    {suggestion.vehicles.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">暂无可用车辆</p>
                    ) : (
                      <div className="space-y-3">
                        {suggestion.vehicles.map((v, i) => (
                          <div key={i} className="p-3 rounded-xl border border-slate-100 hover:border-primary-200 transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-primary-900">{v.vehicle.plateNumber}</span>
                                <span className="tag-pill bg-primary-100 text-primary-700 text-[10px]">推荐度 {v.score}</span>
                              </div>
                              <span className={`tag-pill ${vehicleStatusColor[v.vehicle.status]}`}>{vehicleStatusLabel[v.vehicle.status]}</span>
                            </div>
                            <div className="text-xs text-slate-500">{v.vehicle.brand} {v.vehicle.model} · {v.vehicle.seatingCapacity}座 · {v.vehicle.currentMileage.toLocaleString()}km</div>
                            <div className="text-xs text-accent-600 mt-1">{v.reason}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card">
                    <h3 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-accent-500" /> 推荐司机</h3>
                    {suggestion.drivers.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">暂无可用司机</p>
                    ) : (
                      <div className="space-y-3">
                        {suggestion.drivers.map((d, i) => (
                          <div key={i} className="p-3 rounded-xl border border-slate-100 hover:border-accent-200 transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-primary-900">{d.driver.name}</span>
                                <span className="tag-pill bg-accent-100 text-accent-700 text-[10px]">推荐度 {d.score}</span>
                              </div>
                              <span className={`tag-pill ${driverStatusColor[d.driver.status]}`}>{driverStatusLabel[d.driver.status]}</span>
                            </div>
                            <div className="text-xs text-slate-500">{d.driver.phone} · <Star className="w-3 h-3 inline text-warning-500" />{d.driver.avgRating} · {d.driver.totalTrips}次</div>
                            <div className="text-xs text-accent-600 mt-1">{d.reason}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {suggestion && suggestion.vehicles.length > 0 && suggestion.drivers.length > 0 && (
                <button
                  onClick={() => assign(selected.id, suggestion.vehicles[0].vehicle.id, suggestion.drivers[0].driver.id)}
                  disabled={assigning}
                  className="btn-accent w-full !h-12 !text-base font-bold !rounded-xl"
                >
                  <Zap className="w-5 h-5" /> {assigning ? '派车中...' : '一键智能派车'}
                </button>
              )}

              {suggestion && (suggestion.vehicles.length === 0 || suggestion.drivers.length === 0) && (
                <div className="card bg-warning-50 border-warning-200 text-warning-700 text-sm text-center py-4">
                  当前时段暂无可用车辆或司机，请稍后重试或手动调整
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
