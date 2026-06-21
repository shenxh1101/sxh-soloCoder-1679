import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { applicationStatusLabel, applicationStatusColor, formatDateTime, formatMoney, formatDuration, carTypeLabel, billAuditStatusLabel, billAuditStatusColor, tripStatusLabel, tripStatusColor, ratingStars } from '../../lib/format.js';
import type { Application, Rating } from '../../../shared/types.js';
import { ArrowLeft, Car, User, MapPin, Clock, Calendar, CheckCircle2, AlertTriangle, Star, DollarSign, FileCheck } from 'lucide-react';

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [app, setApp] = useState<(Application & Record<string, unknown>) | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true);
        const [detail, r] = await Promise.all([
          api.applications.detail(+id),
          (async () => {
            try {
              const d = await api.applications.detail(+id);
              if (d.dispatch?.trip?.id) {
                return api.ratings.getByTrip(d.dispatch.trip.id) as Promise<Rating | null>;
              }
              return null;
            } catch { return null; }
          })(),
        ]);
        setApp(detail as (Application & Record<string, unknown>));
        setRating(r);
      } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
      finally { setLoading(false); }
    };
    load();
  }, [id, setLoading]);

  if (!app) return <div className="text-center py-12 text-slate-400">加载中...</div>;

  const dispatch = app.dispatch as Record<string, unknown> | undefined;
  const trip = dispatch?.trip as Record<string, unknown> | undefined;
  const approval = app.approval as Record<string, unknown> | undefined;
  const bill = (app as unknown as { bill?: Record<string, unknown> }).bill;
  const vehicle = dispatch?.vehicle as Record<string, unknown> | undefined;
  const driver = dispatch?.driver as Record<string, unknown> | undefined;

  const showRatingBtn = app.status === 'completed' && !rating;
  const tripId = trip?.id as number | undefined;

  const steps: { label: string; done: boolean; active: boolean; color: string }[] = [
    { label: '提交申请', done: true, active: false, color: 'bg-success-500' },
    { label: '预算审批', done: ['approved', 'rejected', 'dispatched', 'in_progress', 'completed'].includes(app.status) || app.status === 'pending_approval' && (approval?.decision === 'approved' || approval?.decision === 'rejected'), active: app.status === 'pending_approval' && approval?.decision !== 'approved' && approval?.decision !== 'rejected', color: app.status === 'rejected' ? 'bg-danger-500' : 'bg-success-500' },
    { label: '车辆派车', done: ['dispatched', 'in_progress', 'completed'].includes(app.status), active: app.status === 'pending' || app.status === 'approved', color: 'bg-primary-500' },
    { label: '行程进行', done: app.status === 'completed', active: app.status === 'in_progress', color: 'bg-accent-500' },
    { label: '完成结算', done: !!bill && (bill.auditStatus === 'approved' || bill.auditStatus === 'rejected'), active: app.status === 'completed' && (!bill || bill.auditStatus === 'pending'), color: 'bg-warning-500' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <button onClick={() => navigate(-1)} className="btn-ghost text-sm !p-0 gap-1">
        <ArrowLeft className="w-4 h-4" /> 返回列表
      </button>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-primary-900 flex items-center gap-3">
              <MapPin className="w-6 h-6 text-accent-500" />
              {app.origin} → {app.destination}
            </h2>
            <p className="text-sm text-slate-500 mt-1">申请单号：VD{String(app.id).padStart(8, '0')}</p>
          </div>
          <span className={`tag-pill text-sm px-4 py-1.5 ${applicationStatusColor[app.status]}`}>
            {applicationStatusLabel[app.status]}
          </span>
        </div>

        <div className="py-4 relative">
          <div className="absolute left-4 right-4 top-[22px] h-1 bg-slate-100 rounded" />
          <div className="flex justify-between relative">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-2 w-[20%] z-10">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md ${s.done ? s.color : s.active ? 'bg-accent-500 animate-pulseRing' : 'bg-slate-200'}`}>
                  {s.done ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                </div>
                <div className={`text-xs font-semibold ${s.done || s.active ? 'text-primary-800' : 'text-slate-400'} text-center`}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <h3 className="text-sm font-bold text-primary-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-primary-600" /> 行程详情
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500 mb-1">申请人</div>
                <div className="font-semibold text-primary-800 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  {app.applicantName || '-'} · {app.departmentName || ''}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">乘车人数</div>
                <div className="font-semibold text-primary-800">{app.passengers} 人</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">出发时间</div>
                <div className="font-semibold text-primary-800 flex items-center gap-1"><Clock className="w-4 h-4 text-slate-400" />{formatDateTime(app.startTime)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">返回时间</div>
                <div className="font-semibold text-primary-800 flex items-center gap-1"><Clock className="w-4 h-4 text-slate-400" />{formatDateTime(app.endTime)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">车型偏好</div>
                <div className="font-semibold text-primary-800">{app.carTypePreference ? carTypeLabel[app.carTypePreference] : '不限'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">预估距离</div>
                <div className="font-semibold text-primary-800">{app.estimatedDistanceKm ?? '约30'} km</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-slate-500 mb-1">用车事由</div>
                <div className="p-3 rounded-lg bg-primary-50/50 text-primary-800 text-sm leading-relaxed">{app.reason}</div>
              </div>
            </div>
          </div>

          {approval && (
            <div className={`card ${approval.decision === 'rejected' ? 'border-2 border-danger-200' : approval.decision === 'approved' ? 'border-2 border-success-200' : 'border-2 border-warning-200'}`}>
              <h3 className="text-sm font-bold text-primary-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <FileCheck className="w-4 h-4 text-primary-600" /> 审批信息
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                <div><div className="text-xs text-slate-500 mb-1">审批人</div><div className="font-semibold">{approval.supervisorName || '-'}</div></div>
                <div><div className="text-xs text-slate-500 mb-1">审批状态</div>
                  <span className={`tag-pill ${approval.decision === 'approved' ? 'bg-success-500/15 text-success-600' : approval.decision === 'rejected' ? 'bg-danger-500/15 text-danger-600' : 'bg-warning-500/15 text-warning-600'}`}>
                    {approval.decision === 'approved' ? '审批通过' : approval.decision === 'rejected' ? '审批未通过' : '待审批'}
                  </span>
                </div>
                <div><div className="text-xs text-slate-500 mb-1">预估费用</div><div className="font-semibold text-primary-800 font-mono">{formatMoney(approval.estimatedCost as number)}</div></div>
                <div><div className="text-xs text-slate-500 mb-1">超出预算</div><div className="font-semibold text-danger-600 font-mono">{formatMoney(approval.overAmount as number)}</div></div>
              </div>
              {(approval.comment || app.rejectionReason) && (
                <div className="p-3 rounded-lg bg-slate-50 text-sm text-slate-700">
                  💬 {approval.comment || app.rejectionReason}
                </div>
              )}
            </div>
          )}

          {dispatch && vehicle && driver && (
            <div className="card">
              <h3 className="text-sm font-bold text-primary-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <Car className="w-4 h-4 text-primary-600" /> 派车信息
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary-50 to-accent-50/50 border border-primary-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-md">
                      <Car className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-primary-900">{vehicle.plateNumber as string}</div>
                      <div className="text-xs text-slate-500">{vehicle.brand as string} {vehicle.model as string}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                    <div><span className="text-slate-500">车型：</span>{carTypeLabel[vehicle.carType as keyof typeof carTypeLabel]}</div>
                    <div><span className="text-slate-500">座位：</span>{vehicle.seatingCapacity as number}座</div>
                    <div><span className="text-slate-500">里程：</span>{(vehicle.currentMileage as number).toLocaleString()}km</div>
                    <div><span className="text-slate-500">匹配分：</span><span className="text-accent-600 font-bold">{dispatch.matchScore as number || 85}</span></div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-warning-500/5 to-accent-50/30 border border-warning-200/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-warning-400 to-warning-600 text-white flex items-center justify-center shadow-md font-bold text-lg">
                      {(driver.name as string).slice(-2)}
                    </div>
                    <div>
                      <div className="font-bold text-primary-900">{driver.name as string}</div>
                      <div className="text-xs text-warning-600 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-warning-400" /> {driver.avgRating as number}分 · 已服务{driver.totalTrips as number}次
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div><span className="text-slate-500">联系电话：</span><span className="font-mono">{driver.phone as string}</span></div>
                    <div><span className="text-slate-500">驾照类型：</span>{driver.licenseType as string}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {trip && trip.status !== 'pending' && (
            <div className="card">
              <h3 className="text-sm font-bold text-primary-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <Clock className="w-4 h-4 text-accent-500" /> 行程执行 · <span className={`tag-pill ml-1 ${tripStatusColor[trip.status as keyof typeof tripStatusColor]}`}>{tripStatusLabel[trip.status as keyof typeof tripStatusLabel]}</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><div className="text-xs text-slate-500 mb-1">实际出发</div><div className="font-semibold text-primary-800">{formatDateTime(trip.actualDeparture as string)}</div></div>
                <div><div className="text-xs text-slate-500 mb-1">实际到达</div><div className="font-semibold text-primary-800">{formatDateTime(trip.actualArrival as string)}</div></div>
                <div><div className="text-xs text-slate-500 mb-1">实际里程</div><div className="font-semibold text-primary-800 font-mono">{trip.actualMileage as number} km</div></div>
                <div><div className="text-xs text-slate-500 mb-1">行驶时长</div><div className="font-semibold text-primary-800">{formatDuration(trip.actualDurationMin as number)}</div></div>
              </div>
              {(trip.mileageAnomaly as number) > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-warning-500/10 border border-warning-500/20 text-xs text-warning-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>本次行程里程存在异常标记，已自动通知调度员复核。</span>
                </div>
              )}
            </div>
          )}

          {rating && (
            <div className="card bg-gradient-to-br from-warning-500/5 to-accent-50/30 border border-warning-200/50">
              <h3 className="text-sm font-bold text-primary-800 flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-warning-500 fill-warning-400" /> 我的服务评价
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                {[['准时率', rating.punctuality], ['安全性', rating.safety], ['服务态度', rating.service], ['车辆状况', rating.vehicleCondition]].map(([k, v]) => (
                  <div key={k as string} className="p-3 rounded-xl bg-white">
                    <div className="text-slate-500">{k as string}</div>
                    <div className="text-lg font-bold text-warning-500 mt-1 flex items-center gap-1">
                      {v as number} <span className="text-xs text-warning-400">分</span>
                    </div>
                    <div className="text-warning-400">{ratingStars(v as number)}</div>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-white text-sm text-slate-600">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-warning-500 text-2xl">{ratingStars(rating.overallScore)} <span className="font-bold ml-1">{rating.overallScore.toFixed(2)}</span></span>
                </div>
                {rating.comment && <p className="text-slate-600 mt-2 pt-2 border-t border-slate-100">{rating.comment}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="card bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 text-white">
            <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4" /> 费用概览
            </h3>
            <div className="text-4xl font-black mb-1 tracking-tight">
              {formatMoney((trip?.actualCost as number) || (dispatch?.estimatedCost as number) || 0)}
            </div>
            <div className="text-xs text-white/60">
              {app.status === 'completed' ? '实际费用（已结算）' : '预估费用（参考）'}
            </div>
            <div className="divider border-white/10" />
            {bill ? (
              <>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-white/60">基础费用</span><span className="font-mono">{formatMoney(bill.baseCost as number)}</span></div>
                  <div className="flex justify-between"><span className="text-white/60">里程费用</span><span className="font-mono">{formatMoney(bill.mileageCost as number)}</span></div>
                  <div className="flex justify-between"><span className="text-white/60">超时费用</span><span className="font-mono">{formatMoney(bill.overtimeCost as number)}</span></div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-white/70">账单状态</span>
                  <span className={`tag-pill text-xs ${billAuditStatusColor[bill.auditStatus as keyof typeof billAuditStatusColor].replace('500/15', '500/20').replace('700', '700')}`} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                    {billAuditStatusLabel[bill.auditStatus as keyof typeof billAuditStatusLabel]}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xs text-white/60">费用明细将在行程完成后自动生成</div>
            )}
          </div>

          {showRatingBtn && tripId && (
            <button onClick={() => navigate(`/employee/rating/${tripId}`)} className="w-full card bg-gradient-to-br from-warning-400 to-warning-600 text-white hover:shadow-lg transition-all p-5 flex items-center gap-3 justify-center group">
              <Star className="w-6 h-6 group-hover:rotate-12 transition-transform fill-white/30" />
              <div className="text-left">
                <div className="font-bold text-base">评价本次服务</div>
                <div className="text-xs text-white/80">您的反馈帮助我们提升服务质量</div>
              </div>
            </button>
          )}

          <div className="card">
            <h3 className="text-sm font-bold text-primary-800 mb-3">操作时间线</h3>
            <div className="space-y-3 text-sm">
              {[
                ['提交申请', app.createdAt as string, true],
                ['主管审批', approval?.decidedAt as string || approval?.createdAt as string, !!approval, approval?.decision === 'rejected'],
                ['派车完成', dispatch?.createdAt as string, !!dispatch],
                ['行程开始', trip?.actualDeparture as string, !!trip?.actualDeparture],
                ['行程结束', trip?.actualArrival as string, !!trip?.actualArrival],
                ['账单审核', bill?.auditedAt as string, bill?.auditStatus === 'approved' || bill?.auditStatus === 'rejected'],
              ].map(([label, time, ok, warn], i) => (
                ok && (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full mt-1.5 ${warn ? 'bg-danger-500' : ok ? 'bg-success-500' : 'bg-slate-200'}`} />
                      {i < 5 && <div className="w-px flex-1 bg-slate-100 my-0.5" />}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="text-sm font-medium text-primary-800">{label as string}</div>
                      <div className="text-xs text-slate-400">{formatDateTime(time as string)}</div>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
