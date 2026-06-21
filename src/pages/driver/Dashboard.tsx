import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatDateTime, formatMoney, tripStatusLabel, tripStatusColor, ratingStars } from '../../lib/format.js';
import type { DriverTask } from '../../../shared/types.js';
import { Car, Clock, CheckCircle2, ListChecks, Calendar, ScanLine, ChevronRight, MapPin, Star, User, Phone } from 'lucide-react';

export default function DriverDashboard() {
  const navigate = useNavigate();
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [tasks, setTasks] = useState<DriverTask[]>([]);
  const [stats, setStats] = useState({ today: 0, completed: 0, totalTrips: 0, rating: 4.9 });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [ts, dash] = await Promise.all([
          api.driver.todayTasks(),
          api.dashboard.summary(),
        ]);
        setTasks(ts as unknown as DriverTask[]);
        const ds = dash.driverStats as Record<string, number> | undefined;
        setStats({ today: ds?.todayTasks ?? ts.length, completed: ds?.todayCompleted ?? 0, totalTrips: 327, rating: 4.87 });
        void toast;
      } finally { setLoading(false); }
    };
    load();
  }, [setLoading]);

  const ongoing = tasks.find((t) => t.status === 'departed');
  const upcoming = tasks.filter((t) => t.status === 'pending');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          { t: '今日任务', n: stats.today, c: 'from-accent-400 to-accent-600', i: <ListChecks className="w-6 h-6" /> },
          { t: '今日完成', n: stats.completed, c: 'from-success-400 to-success-600', i: <CheckCircle2 className="w-6 h-6" /> },
          { t: '累计服务', n: stats.totalTrips + '次', c: 'from-primary-400 to-primary-600', i: <Car className="w-6 h-6" /> },
          { t: '服务评分', n: `${stats.rating}分`, c: 'from-warning-400 to-warning-600', i: <Star className="w-6 h-6 fill-white/40" /> },
        ].map((k, i) => (
          <div key={i} className="kpi-card">
            <div className={`absolute top-0 right-0 w-28 h-28 opacity-10 bg-gradient-to-br ${k.c} rounded-full -translate-y-8 translate-x-10`} />
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${k.c} text-white flex items-center justify-center shadow-md mb-3`}>{k.i}</div>
            <div className="text-3xl font-black text-primary-900 tracking-tight">{k.n}</div>
            <div className="text-xs text-slate-500 mt-1">{k.t}</div>
          </div>
        ))}
      </div>

      {ongoing && (
        <div onClick={() => navigate('/driver/scan')} className="card border-2 border-accent-400 bg-gradient-to-r from-accent-50 via-white cursor-pointer hover:shadow-cardHover transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="tag-pill bg-accent-500/15 text-accent-700 animate-pulseRing">进行中</span>
              <span className="text-xs text-slate-500">点击查看详情/扫码</span>
            </div>
            <ChevronRight className="w-5 h-5 text-accent-500" />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-[11px] text-slate-500">行程</div>
              <div className="text-xl font-bold text-primary-900">{ongoing.origin} → {ongoing.destination}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">出发时间</div>
              <div className="text-lg font-semibold text-primary-800">{formatDateTime(ongoing.actualDeparture || ongoing.startTime)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">车辆</div>
              <div className="text-lg font-semibold text-primary-800">{ongoing.vehiclePlateNumber}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-primary-800 flex items-center gap-2"><Clock className="w-5 h-5 text-primary-600" /> 今日任务时间轴</h3>
            <button onClick={() => navigate('/driver/scan')} className="btn-primary text-xs">
              <ScanLine className="w-3.5 h-3.5" /> 扫码执行
            </button>
          </div>
          {tasks.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">今日暂无任务安排</p>
            </div>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-100" />
              {tasks.map((t, i) => (
                <div key={t.tripId} className="relative mb-6 last:mb-0 animate-fadeInUp" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className={`absolute -left-5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${t.status === 'completed' ? 'bg-success-500' : t.status === 'departed' ? 'bg-accent-500 animate-pulseRing' : 'bg-primary-400'}`}>
                    {t.status === 'completed' ? '✓' : i + 1}
                  </div>
                  <div className={`p-4 rounded-xl border transition-all cursor-pointer ${t.status === 'departed' ? 'border-accent-200 bg-accent-50/30 shadow-md' : t.status === 'completed' ? 'border-success-200 bg-success-50/30' : 'border-slate-100 hover:shadow-md hover:border-primary-200'}`} onClick={() => navigate('/driver/scan')}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`tag-pill ${tripStatusColor[t.status]}`}>{tripStatusLabel[t.status]}</span>
                          <span className="text-xs font-mono text-slate-400">#{String(t.tripId).padStart(6, '0')}</span>
                        </div>
                        <div className="text-sm font-bold text-primary-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-accent-500 shrink-0" /> {t.origin} <span className="text-slate-300 mx-1">→</span> {t.destination}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                          <span>⏰ {formatDateTime(t.startTime)} ~ {formatDateTime(t.endTime).slice(11)}</span>
                          <span>👥 {t.passengers}人</span>
                          <span className="font-mono text-primary-700 font-semibold">{formatMoney(t.estimatedCost)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`tag-pill ${t.status === 'completed' ? 'bg-success-100 text-success-700' : 'bg-primary-100 text-primary-700'}`}>{t.vehiclePlateNumber}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{t.vehicleBrand} {t.vehicleModel}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-7 h-7 rounded-full bg-warning-500/15 text-warning-600 font-bold flex items-center justify-center text-xs">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-primary-800">{t.applicantName}</div>
                          {t.applicantPhone && <div className="text-[11px] text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" />{t.applicantPhone}</div>}
                        </div>
                      </div>
                      <button className="btn-accent text-xs !py-1.5 !px-3">
                        {t.status === 'pending' ? '前往执行' : t.status === 'departed' ? '扫码到达' : '查看详情'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="card bg-gradient-to-br from-primary-700 to-primary-900 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl font-bold">王</div>
              <div>
                <h3 className="text-lg font-bold">王师傅</h3>
                <div className="flex items-center gap-1.5 text-xs text-warning-300 mt-1">
                  <span className="text-lg">{ratingStars(stats.rating)}</span>
                  <span className="font-bold">{stats.rating}</span> 分 · 已服务{stats.totalTrips}次
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate('/driver/trips')} className="p-3 rounded-xl bg-white/10 backdrop-blur hover:bg-white/20 transition-all text-left">
                <ListChecks className="w-5 h-5 mb-1 text-accent-300" />
                <div className="text-sm font-semibold">我的行程</div>
                <div className="text-[11px] text-white/60">查看历史记录</div>
              </button>
              <button onClick={() => navigate('/driver/schedule')} className="p-3 rounded-xl bg-white/10 backdrop-blur hover:bg-white/20 transition-all text-left">
                <Calendar className="w-5 h-5 mb-1 text-accent-300" />
                <div className="text-sm font-semibold">排班日历</div>
                <div className="text-[11px] text-white/60">查看本月排班</div>
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-accent-500" /> 待执行任务（{upcoming.length}）</h3>
            {upcoming.length === 0 ? <p className="py-4 text-center text-xs text-slate-400">暂无待执行任务</p> : (
              <div className="space-y-2">
                {upcoming.slice(0, 3).map((t) => (
                  <div key={t.tripId} className="p-3 rounded-lg bg-slate-50 hover:bg-primary-50 cursor-pointer transition-all flex items-center gap-3" onClick={() => navigate('/driver/scan')}>
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {t.startTime.slice(11, 16)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary-800 truncate">{t.origin} → {t.destination}</div>
                      <div className="text-[11px] text-slate-400">{t.vehiclePlateNumber} · {t.passengers}人</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => navigate('/driver/scan')} className="w-full card bg-gradient-to-r from-accent-500 to-accent-600 text-white hover:shadow-lg transition-all flex items-center justify-center gap-3 h-16">
            <ScanLine className="w-6 h-6" />
            <div className="text-left">
              <div className="text-lg font-bold">扫码执行</div>
              <div className="text-xs text-accent-100">出发 / 到达 · 记录里程</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
