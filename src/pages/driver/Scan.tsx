import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatDateTime, formatDuration, formatMoney, tripStatusLabel, tripStatusColor } from '../../lib/format.js';
import type { DriverTask, Trip } from '../../../shared/types.js';
import { ScanLine, QrCode, Car, MapPin, User, Phone, Play, LogOut, Clock, AlertCircle, Gauge, CheckCircle2, ChevronDown } from 'lucide-react';

export default function ScanPage() {
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [tasks, setTasks] = useState<DriverTask[]>([]);
  const [activeTask, setActiveTask] = useState<DriverTask | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [odoStart, setOdoStart] = useState('');
  const [odoEnd, setOdoEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const ts = await api.driver.todayTasks() as unknown as DriverTask[];
      setTasks(ts);
      const ongoing = ts.find((t) => t.status === 'departed') || ts.find((t) => t.status === 'pending');
      if (ongoing) setActiveTask(ongoing);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const depart = async () => {
    if (!activeTask || !odoStart) { toast.warning('请填写出发里程数'); return; }
    try {
      setSubmitting(true);
      await api.driver.depart(activeTask.tripId, +odoStart);
      toast.success('扫码出发成功！祝您一路平安');
      load();
    } catch (e) { toast.error((e as { message?: string }).message || '出发失败'); }
    finally { setSubmitting(false); }
  };

  const arrive = async () => {
    if (!activeTask || !odoEnd) { toast.warning('请填写到达里程数'); return; }
    try {
      setSubmitting(true);
      const r = await api.driver.arrive(activeTask.tripId, +odoEnd) as unknown as { anomaly: boolean; anomalyMessage?: string; cost: { mileage: number; durationMin: number; totalCost: number } };
      if (r.anomaly) {
        toast.warning(r.anomalyMessage || '里程异常，已通知调度员核查');
      } else {
        toast.success(`行程完成！里程${r.cost.mileage}km，费用${formatMoney(r.cost.totalCost)}已自动结算`);
      }
      load();
    } catch (e) { toast.error((e as { message?: string }).message || '操作失败'); }
    finally { setSubmitting(false); }
  };

  const estimateDuration = activeTask ? Math.max(10, Math.round(((activeTask.estimatedDistance || 30) / 60) * 60)) : 30;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="card bg-gradient-to-r from-primary-800 via-primary-700 to-accent-600 text-white overflow-hidden relative">
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="absolute -right-10 -bottom-20 w-56 h-56 rounded-full bg-white/5 blur-2xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-black flex items-center gap-3">
                <ScanLine className="w-8 h-8" /> 扫码执行中心
              </h2>
              <p className="text-sm text-white/70 mt-1">选择任务 → 扫码出发 → 记录里程 → 扫码到达</p>
            </div>
            <button onClick={() => setShowQr(!showQr)} className="bg-white/15 hover:bg-white/25 backdrop-blur px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all">
              <QrCode className="w-5 h-5" /> {showQr ? '收起二维码' : '显示我的二维码'}
            </button>
          </div>

          {showQr && (
            <div className="bg-white rounded-2xl p-6 animate-fadeInUp text-slate-700">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-48 h-48 shrink-0 flex items-center justify-center bg-slate-50 rounded-xl border-4 border-primary-100 overflow-hidden">
                  <div className="grid grid-cols-10 gap-0.5 p-3">
                    {Array.from({ length: 100 }, (_, i) => <div key={i} className={`w-3 h-3 rounded-[2px] ${Math.random() > 0.45 ? 'bg-primary-900' : 'bg-transparent'}`} />)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-primary-800">司机身份二维码</h3>
                  <p className="text-sm text-slate-500 mt-1">员工可扫描此二维码确认司机身份并评价服务</p>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between"><span className="text-slate-500">司机工号</span><span className="font-mono font-semibold">DRV-2024001</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-500">扫码时间</span><span className="font-mono">{formatDateTime(new Date())}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-500">状态</span><span className="text-success-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />在线</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-1 space-y-3 max-h-[560px] overflow-y-auto pr-1">
          <h3 className="text-sm font-bold text-primary-800 sticky top-0 bg-white py-2 flex items-center gap-2 z-10">
            <List className="w-4 h-4 text-accent-500" /> 今日任务列表
            <ChevronDown className="w-4 h-4 text-slate-400 lg:hidden ml-auto" />
          </h3>
          {tasks.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">暂无任务</div>
          ) : (
            tasks.map((t) => (
              <button
                key={t.tripId}
                onClick={() => setActiveTask(t)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${activeTask?.tripId === t.tripId ? 'border-accent-400 bg-accent-50 shadow-md' : t.status === 'departed' ? 'border-accent-200 bg-accent-50/40 hover:shadow-md' : 'border-slate-100 hover:border-primary-200 hover:shadow-sm'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-mono text-slate-400">#{String(t.tripId).padStart(6, '0')}</div>
                  <span className={`tag-pill text-[10px] ${tripStatusColor[t.status]}`}>{tripStatusLabel[t.status]}</span>
                </div>
                <div className="text-sm font-bold text-primary-900 line-clamp-1">{t.origin} → {t.destination}</div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                  <Clock className="w-3 h-3" />{t.startTime.slice(11, 16)} <span className="text-slate-300">·</span> {t.vehiclePlateNumber}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {activeTask ? (
            <div className="card space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`tag-pill ${tripStatusColor[activeTask.status]}`}>{tripStatusLabel[activeTask.status]}</span>
                    <span className="tag-pill bg-primary-100 text-primary-700">派车单 {String(activeTask.dispatchId).padStart(6, '0')}</span>
                  </div>
                  <h3 className="text-2xl font-black text-primary-900 flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-accent-500" /> {activeTask.origin}
                    <span className="text-slate-300 mx-2">→</span>
                    {activeTask.destination}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">预估费用</div>
                  <div className="text-3xl font-black text-primary-800 font-mono">{formatMoney(activeTask.estimatedCost)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { k: '出发时间', v: formatDateTime(activeTask.startTime), c: <Clock className="w-4 h-4" /> },
                  { k: '乘客人数', v: `${activeTask.passengers}人`, c: <User className="w-4 h-4" /> },
                  { k: '预估里程', v: `${activeTask.estimatedDistance}km`, c: <Gauge className="w-4 h-4" /> },
                  { k: '预估时长', v: formatDuration(estimateDuration), c: <Car className="w-4 h-4" /> },
                ].map((x, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">{x.c} {x.k}</div>
                    <div className="text-sm font-bold text-primary-800">{x.v}</div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-100">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-warning-500/15 text-warning-600 font-bold flex items-center justify-center text-lg">客</div>
                    <div>
                      <div className="font-bold text-primary-800">用车人：{activeTask.applicantName}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {activeTask.applicantPhone || '138****8888'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary-600/15 text-primary-600 font-bold flex items-center justify-center text-lg">
                      <Car className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-primary-800">{activeTask.vehiclePlateNumber}</div>
                      <div className="text-xs text-slate-500">{activeTask.vehicleBrand} {activeTask.vehicleModel}</div>
                    </div>
                  </div>
                </div>
              </div>

              {activeTask.status === 'pending' && (
                <div className="space-y-4">
                  <div>
                    <label className="label flex items-center gap-2"><Gauge className="w-4 h-4 text-accent-500" /> 出发时仪表盘里程 (km)</label>
                    <input type="number" className="input text-lg font-mono" placeholder="例如：25680" value={odoStart} onChange={(e) => setOdoStart(e.target.value)} min={0} step={1} />
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />请如实填写，系统将自动校验里程合理性</p>
                  </div>
                  <button onClick={depart} disabled={submitting || !odoStart} className="btn-accent w-full !h-14 !text-base font-bold !rounded-xl">
                    <Play className="w-6 h-6" /> 扫码出发，开始行程
                  </button>
                </div>
              )}

              {activeTask.status === 'departed' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-gradient-to-r from-accent-500/15 to-primary-500/10 border-2 border-accent-300 animate-pulseRing">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-accent-700 font-semibold">行程进行中</div>
                        <div className="text-sm text-slate-600 mt-1">请安全驾驶，到达后扫码确认</div>
                      </div>
                      <div className="w-16 h-16 rounded-full bg-accent-500 flex items-center justify-center text-white animate-pulse">
                        <Car className="w-8 h-8" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="label flex items-center gap-2"><Gauge className="w-4 h-4 text-accent-500" /> 到达时仪表盘里程 (km)</label>
                    <input type="number" className="input text-lg font-mono" placeholder="必须大于出发里程" value={odoEnd} onChange={(e) => setOdoEnd(e.target.value)} min={+odoStart || 0} step={1} />
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />里程异常（平均速度＜5或＞120km/h，或＞预估2.5倍）将通知调度员核查</p>
                  </div>
                  <button onClick={arrive} disabled={submitting || !odoEnd} className="btn-success w-full !h-14 !text-base font-bold !rounded-xl">
                    <LogOut className="w-6 h-6" /> 扫码到达，结束行程
                  </button>
                </div>
              )}

              {activeTask.status === 'completed' && (
                <div className="space-y-4">
                  <div className="p-5 rounded-xl bg-success-50 border-2 border-success-200 text-center">
                    <CheckCircle2 className="w-14 h-14 mx-auto text-success-500 mb-2" />
                    <div className="text-xl font-bold text-success-700">行程已完成</div>
                    <div className="text-sm text-slate-600 mt-1">费用已自动结算并推送财务生成电子账单</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-white border border-slate-100 text-center">
                      <div className="text-xs text-slate-500">实际里程</div>
                      <div className="text-lg font-black text-primary-800 font-mono mt-1">{activeTask.actualMileage || (activeTask as unknown as Record<string, unknown>).mileage || '-'} km</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-100 text-center">
                      <div className="text-xs text-slate-500">实际时长</div>
                      <div className="text-lg font-black text-primary-800 font-mono mt-1">{formatDuration(((activeTask.actualDuration || 0) as number) || 0)}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-100 text-center">
                      <div className="text-xs text-slate-500">结算金额</div>
                      <div className="text-lg font-black text-accent-600 font-mono mt-1">{formatMoney(activeTask.actualCost ?? 0)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card text-center py-20">
              <Car className="w-20 h-20 mx-auto text-slate-200 mb-4" />
              <p className="text-slate-500">请在左侧选择一个任务开始执行</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function List(props: { className?: string }) {
  return (<svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>);
}
