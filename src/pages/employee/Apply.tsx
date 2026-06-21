import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { CarType } from '../../../shared/types.js';
import { MapPin, Calendar, Users, FileText, Car, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { carTypeLabel, carTypeColor, formatMoney } from '../../lib/format.js';

const carTypes: { id: CarType; name: string; seats: string; price: string }[] = [
  { id: 'sedan', name: '普通轿车', seats: '5座', price: '¥3.5/km' },
  { id: 'suv', name: 'SUV越野车', seats: '7座', price: '¥4.5/km' },
  { id: 'van', name: '商务面包车', seats: '7座', price: '¥5.5/km' },
  { id: 'business', name: '豪华商务车', seats: '7座', price: '¥7.0/km' },
];

export default function ApplyPage() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();

  const [form, setForm] = useState({
    origin: '', destination: '',
    startTime: (() => { const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return d.toISOString().slice(0, 16); })(),
    endTime: (() => { const d = new Date(); d.setHours(d.getHours() + 3, 0, 0, 0); return d.toISOString().slice(0, 16); })(),
    passengers: 1,
    carTypePreference: '' as CarType | '',
    reason: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [budgetCheck, setBudgetCheck] = useState<{ within: boolean; usedPercent: number; threshold: number; remaining: number } | null>(null);
  const [estCost, setEstCost] = useState<number | null>(null);

  const update = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleCheckBudget = async () => {
    if (!user?.departmentId) return;
    const est = calcEst();
    setEstCost(est);
    try {
      const r = await api.budgets.get(user.departmentId);
      if (r) {
        const usedPercent = +(((r.usedBudget + est) / r.monthlyBudget) * 100).toFixed(2);
        setBudgetCheck({ within: est <= (r.remainingBudget || 0), usedPercent, threshold: r.alertThreshold, remaining: r.remainingBudget || 0 });
      }
    } catch {}
  };

  const calcEst = () => {
    const dist = 30;
    const dur = 60;
    const ct = form.carTypePreference || 'sedan';
    const pricing = { sedan: { b: 30, km: 3.5, m: 0.5 }, suv: { b: 50, km: 4.5, m: 0.6 }, van: { b: 80, km: 5.5, m: 0.8 }, business: { b: 120, km: 7, m: 1 } }[ct];
    return +(pricing.b + pricing.km * dist + pricing.m * dur).toFixed(2);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.origin.trim()) errs.origin = '请输入起始地';
    if (!form.destination.trim()) errs.destination = '请输入目的地';
    if (!form.startTime) errs.startTime = '请选择开始时间';
    if (!form.endTime) errs.endTime = '请选择结束时间';
    if (new Date(form.endTime).getTime() <= new Date(form.startTime).getTime()) errs.endTime = '结束时间必须晚于开始时间';
    if (form.passengers < 1) errs.passengers = '乘车人数至少1人';
    if (!form.reason.trim()) errs.reason = '请填写用车事由';
    if (Object.keys(errs).length) { setErrors(errs); toast.warning('请检查表单填写'); return; }
    try {
      setLoading(true);
      const res = await api.applications.create({
        ...form, estimatedDistanceKm: 30,
        carTypePreference: form.carTypePreference || null,
      });
      toast.success(`申请提交成功！${res.needApproval ? '等待主管审批' : '系统正在派车'}`);
      setTimeout(() => navigate(`/employee/application/${res.id}`), 800);
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      toast.error(err.message || '提交失败');
      if (err.code === 'TIME_CONFLICT') setErrors({ startTime: err.message || '时间冲突' });
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card">
        <h2 className="text-lg font-bold text-primary-800 mb-1 flex items-center gap-2">
          <Car className="w-6 h-6 text-primary-600" /> 发起用车申请
        </h2>
        <p className="text-sm text-slate-500">系统将根据车辆状态和司机排班自动匹配最优方案</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="card space-y-5">
          <h3 className="text-sm font-bold text-primary-700 flex items-center gap-2 pb-2 border-b border-slate-100">
            <MapPin className="w-4 h-4 text-accent-500" /> 行程信息
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="form-group">
              <label className="label">起始地点 *</label>
              <input className={`input ${errors.origin ? 'input-error' : ''}`} placeholder="例如：公司总部大楼" value={form.origin} onChange={(e) => update('origin', e.target.value)} />
              {errors.origin && <p className="text-xs text-danger-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.origin}</p>}
            </div>
            <div className="form-group">
              <label className="label">目的地点 *</label>
              <input className={`input ${errors.destination ? 'input-error' : ''}`} placeholder="例如：国贸CBD客户现场" value={form.destination} onChange={(e) => update('destination', e.target.value)} />
              {errors.destination && <p className="text-xs text-danger-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.destination}</p>}
            </div>
            <div className="form-group">
              <label className="label flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> 用车开始 *</label>
              <input type="datetime-local" className={`input ${errors.startTime ? 'input-error' : ''}`} value={form.startTime} onChange={(e) => update('startTime', e.target.value)} />
              {errors.startTime && <p className="text-xs text-danger-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.startTime}</p>}
            </div>
            <div className="form-group">
              <label className="label flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> 预计返回 *</label>
              <input type="datetime-local" className={`input ${errors.endTime ? 'input-error' : ''}`} value={form.endTime} onChange={(e) => update('endTime', e.target.value)} />
              {errors.endTime && <p className="text-xs text-danger-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.endTime}</p>}
            </div>
            <div className="form-group">
              <label className="label flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" /> 乘车人数 *</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button key={n} type="button" onClick={() => update('passengers', n)} className={`w-10 h-10 rounded-lg font-semibold text-sm transition-all ${form.passengers === n ? 'bg-primary-600 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-600 hover:bg-primary-100 hover:text-primary-700'}`}>{n}</button>
                ))}
              </div>
              {errors.passengers && <p className="text-xs text-danger-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.passengers}</p>}
            </div>
          </div>
        </div>

        <div className="card space-y-5">
          <h3 className="text-sm font-bold text-primary-700 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Car className="w-4 h-4 text-primary-600" /> 车型偏好 <span className="text-xs font-normal text-slate-400">（可选）</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button type="button" onClick={() => update('carTypePreference', '')} className={`p-4 rounded-xl border-2 transition-all ${!form.carTypePreference ? 'border-primary-500 bg-primary-50 shadow-md' : 'border-slate-100 hover:border-primary-200'}`}>
              <div className="text-2xl mb-2">🚗</div>
              <div className="text-sm font-semibold text-primary-800">不限</div>
              <div className="text-[10px] text-slate-400 mt-1">系统推荐最优</div>
            </button>
            {carTypes.map((c) => (
              <button key={c.id} type="button" onClick={() => update('carTypePreference', c.id)} className={`p-4 rounded-xl border-2 text-left transition-all ${form.carTypePreference === c.id ? 'border-primary-500 bg-primary-50 shadow-md' : 'border-slate-100 hover:border-primary-200'}`}>
                <div className={`tag-pill mb-2 ${carTypeColor[c.id]}`}>{carTypeLabel[c.id]}</div>
                <div className="text-xs text-slate-500">{c.name} · {c.seats}</div>
                <div className="text-[11px] font-bold text-primary-700 mt-1">{c.price}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="card space-y-5">
          <h3 className="text-sm font-bold text-primary-700 flex items-center gap-2 pb-2 border-b border-slate-100">
            <FileText className="w-4 h-4 text-warning-500" /> 用车事由 *
          </h3>
          <textarea rows={3} className={`input resize-none ${errors.reason ? 'input-error' : ''}`} placeholder="请详细描述用车事由，便于审批（如：客户拜访、机场接送、市场活动等）" value={form.reason} onChange={(e) => update('reason', e.target.value)} />
          {errors.reason && <p className="text-xs text-danger-500 -mt-3 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.reason}</p>}
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-primary-700 flex items-center gap-2">预算预览</h3>
            <button type="button" onClick={handleCheckBudget} className="btn-ghost text-xs">
              检查部门预算
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-primary-50/60">
              <div className="text-[11px] text-slate-500">预估费用</div>
              <div className="text-xl font-black text-primary-800 mt-1">{formatMoney(estCost || calcEst())}</div>
            </div>
            {budgetCheck ? (
              <>
                <div className="p-3 rounded-xl bg-warning-500/10">
                  <div className="text-[11px] text-slate-500">预算使用率</div>
                  <div className={`text-xl font-black mt-1 ${budgetCheck.usedPercent >= budgetCheck.threshold ? 'text-warning-600' : 'text-slate-700'}`}>{budgetCheck.usedPercent.toFixed(1)}%</div>
                </div>
                <div className="p-3 rounded-xl bg-accent-500/10">
                  <div className="text-[11px] text-slate-500">剩余预算</div>
                  <div className="text-xl font-black text-accent-700 mt-1">{formatMoney(budgetCheck.remaining)}</div>
                </div>
                <div className={`p-3 rounded-xl ${budgetCheck.within ? 'bg-success-500/10' : 'bg-danger-500/10'}`}>
                  <div className="text-[11px] text-slate-500">预算检查</div>
                  <div className={`text-lg font-bold mt-1 flex items-center gap-1 ${budgetCheck.within ? 'text-success-600' : 'text-danger-600'}`}>
                    {budgetCheck.within ? <><CheckCircle2 className="w-4 h-4" /> 预算内</> : <><AlertCircle className="w-4 h-4" /> 超预算</>}
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-3 p-3 rounded-xl bg-slate-50 text-sm text-slate-400 flex items-center justify-center">点击上方「检查部门预算」查看预算情况</div>
            )}
          </div>
          {budgetCheck && !budgetCheck.within && (
            <div className="p-3 rounded-lg bg-warning-500/10 border border-warning-500/20 text-xs text-warning-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>本次申请将超出部门剩余预算，系统将自动推送主管审批，审批通过后方可派车。</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 sticky bottom-4 z-10">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">取消</button>
          <button type="submit" className="btn-primary min-w-[160px]">
            <Send className="w-4 h-4" /> 提交申请
          </button>
        </div>
      </form>
    </div>
  );
}
