import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatDateTime, formatDuration, formatMoney, tripStatusLabel, tripStatusColor } from '../../lib/format.js';
import type { Trip } from '../../../shared/types.js';
import { Search, Filter, ChevronDown, Car, MapPin, Clock, Gauge, Star } from 'lucide-react';

export default function DriverTrips() {
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [list, setList] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState('all');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const all = (await api.driver.trips()) as unknown as Record<string, unknown>[];
        setList(all);
      } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
      finally { setLoading(false); }
    };
    load();
  }, [setLoading]);

  const filtered = list.filter((t: Record<string, unknown>) => {
    if (status !== 'all' && t.status !== status) return false;
    if (keyword) {
      const kw = keyword.toLowerCase();
      return String(t.origin).toLowerCase().includes(kw) || String(t.destination).toLowerCase().includes(kw) || String(t.vehiclePlateNumber || t.plateNumber || '').toLowerCase().includes(kw);
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
            <Car className="w-5 h-5 text-primary-600" /> 我的行程
            <span className="ml-2 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">共 {filtered.length} 条</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索目的地 / 车牌" className="input !pl-9 !w-48" />
            </div>
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-32">
              <option value="all">全部状态</option>
              <option value="pending">待出发</option>
              <option value="departed">进行中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 -ml-8" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center"><Clock className="w-16 h-16 mx-auto text-slate-200 mb-3" /><p className="text-sm text-slate-400">暂无行程记录</p></div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t: Record<string, unknown>) => {
              const st = t.status as Trip['status'];
              const rating = t.rating as number | undefined;
              return (
                <div key={t.tripId as number} className={`p-5 rounded-xl border-2 transition-all hover:shadow-md ${st === 'completed' ? 'border-success-100' : st === 'departed' ? 'border-accent-200 bg-accent-50/20' : 'border-slate-100'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${st === 'completed' ? 'bg-success-500/10 text-success-600' : st === 'departed' ? 'bg-accent-500/15 text-accent-600 animate-pulse' : 'bg-primary-100 text-primary-600'}`}>
                        <MapPin className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="text-base font-bold text-primary-900 truncate">{t.origin as string} → {t.destination as string}</h4>
                          <span className={`tag-pill ${tripStatusColor[st]}`}>{tripStatusLabel[st]}</span>
                          <span className="tag-pill bg-primary-100 text-primary-700 text-[10px] font-mono">#{String(t.tripId as number).padStart(6, '0')}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDateTime(t.scheduledStartTime || t.startTime as string)} ~ {formatDateTime(t.scheduledEndTime || t.endTime as string).slice(11)}</span>
                          {st === 'completed' && <span className="flex items-center gap-1 text-success-600"><Gauge className="w-3 h-3" /> 行驶 {t.mileage || t.actualMileage || 0} km</span>}
                          <span className="font-mono font-semibold text-primary-700">{t.vehiclePlateNumber as string}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-black text-primary-800 font-mono">{formatMoney((t.cost || t.estimatedCost || 0) as number)}</div>
                      <div className="text-[11px] text-slate-400">{st === 'completed' ? '结算金额' : '预估费用'}</div>
                      {st === 'completed' && (
                        <div className="mt-1.5 text-xs text-warning-500 flex items-center justify-end gap-0.5">
                          <span className="text-base">{rating ? '★'.repeat(Math.round(rating)) : '—'}</span>
                          <span className="ml-1">{rating ? rating.toFixed(1) : '未评分'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-[11px] text-slate-500 mb-1">计划时长</div>
                      <div className="text-sm font-bold text-primary-800">{formatDuration(((t.plannedDuration || 0) as number) || estimateDuration(t))}</div>
                    </div>
                    {st === 'completed' && (
                      <div className="p-3 rounded-lg bg-success-50 border border-success-100">
                        <div className="text-[11px] text-slate-500 mb-1">实际时长</div>
                        <div className="text-sm font-bold text-success-700">{formatDuration(((t.actualDuration || 0) as number) || 0)}</div>
                      </div>
                    )}
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-[11px] text-slate-500 mb-1">乘客数</div>
                      <div className="text-sm font-bold text-primary-800">{(t.passengers || 0) as number} 人</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                        <Star className="w-3 h-3 text-warning-500" /> 服务评分
                      </div>
                      <div className="text-sm font-bold text-warning-600">{rating ? `${rating.toFixed(1)} 分` : '待评价'}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function estimateDuration(t: Record<string, unknown>) {
  return Math.max(10, Math.round(((t.estimatedDistance || 30) as number) * 1.5));
}
