import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatMoney } from '../../lib/format.js';
import { Wallet, AlertTriangle, Save, DollarSign, TrendingDown } from 'lucide-react';

export default function BudgetPage() {
  const user = useAppStore((s) => s.user);
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [budget, setBudget] = useState<Record<string, unknown> | null>(null);
  const [edit, setEdit] = useState<{ monthlyBudget: number; alertThreshold: number } | null>(null);

  const load = async () => {
    if (!user?.departmentId) return;
    try {
      setLoading(true);
      const r = await api.budgets.get(user.departmentId);
      setBudget(r as unknown as Record<string, unknown>);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user]);

  const openEdit = () => {
    if (!budget) return;
    setEdit({ monthlyBudget: budget.monthlyBudget as number, alertThreshold: budget.alertThreshold as number });
  };

  const save = async () => {
    if (!edit || !user?.departmentId) return;
    try {
      setLoading(true);
      await api.budgets.update(user.departmentId, edit);
      toast.success('预算配置已保存');
      setEdit(null);
      load();
    } catch (e) { toast.error((e as { message?: string }).message || '保存失败'); }
    finally { setLoading(false); }
  };

  if (!budget) return <div className="text-center py-12 text-slate-400">加载中...</div>;

  const usage = budget.usagePercent as number;
  const threshold = budget.alertThreshold as number;
  const nearAlert = usage >= threshold * 0.8;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6" /> {budget.departmentName as string} · 预算管理</h3>
            <p className="text-white/60 text-sm mt-1">当前周期：{budget.currentMonth as string}</p>
          </div>
          <button onClick={openEdit} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium backdrop-blur flex items-center gap-2 transition-all">
            <Save className="w-4 h-4" /> 修改配置
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
            <div className="text-xs text-white/60">月度预算</div>
            <div className="text-2xl font-black mt-1 font-mono">{formatMoney(budget.monthlyBudget as number)}</div>
          </div>
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
            <div className="text-xs text-white/60">已使用</div>
            <div className="text-2xl font-black mt-1 text-accent-300 font-mono">{formatMoney(budget.usedBudget as number)}</div>
          </div>
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
            <div className="text-xs text-white/60">剩余预算</div>
            <div className={`text-2xl font-black mt-1 font-mono ${usage >= threshold ? 'text-danger-300' : 'text-success-300'}`}>
              {formatMoney((budget.remainingBudget as number) ?? 0)}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
            <div className="text-xs text-white/60">使用率</div>
            <div className={`text-2xl font-black mt-1 ${usage >= threshold ? 'text-danger-300' : usage >= threshold * 0.8 ? 'text-warning-300' : 'text-white'}`}>
              {usage.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-accent-500" /> 预算使用率
        </h3>
        <div className="progress-bar h-6 rounded-full bg-slate-100 overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${usage >= threshold ? 'bg-gradient-to-r from-warning-500 to-danger-500' : nearAlert ? 'bg-gradient-to-r from-warning-400 to-warning-500' : 'bg-gradient-to-r from-primary-400 to-accent-500'}`}
            style={{ width: `${Math.min(100, usage)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-bold">
            <span className={usage > 20 ? 'drop-shadow' : 'text-primary-700'}>{usage.toFixed(1)}%</span>
            <div className="w-px h-4 bg-white/50" style={{ marginLeft: `${threshold}%` }} />
          </div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>0%</span>
          <span className="text-warning-600 font-semibold">预警阈值 {threshold}%</span>
          <span>100%</span>
        </div>
        {usage >= threshold && (
          <div className="mt-4 p-3 rounded-lg bg-danger-50 border border-danger-200 text-sm text-danger-700 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">预算超支预警</div>
              <div className="text-xs mt-1">本月使用率已超过预警阈值，建议控制费用支出或申请追加预算。</div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-success-500" /> 预算配置说明</h3>
        <ul className="space-y-3 text-sm text-slate-600 list-disc list-inside">
          <li><span className="font-semibold text-primary-700">月度预算</span>：每月部门可使用的公务用车总费用额度</li>
          <li><span className="font-semibold text-primary-700">预警阈值</span>：使用率达到该百分比时，新申请将自动触发主管审批</li>
          <li><span className="font-semibold text-primary-700">审批策略</span>：
            <ul className="mt-2 ml-4 space-y-1 list-disc">
              <li>预算范围内（使用率＜预警阈值）：系统自动派车，无需审批</li>
              <li>预算范围内（使用率≥预警阈值）：仍可派车，但需主管审批</li>
              <li>超出剩余预算：必须经主管审批通过后方可派车</li>
            </ul>
          </li>
          <li><span className="font-semibold text-primary-700">费用计算</span>：按车型基础费 + 里程费 + 超时费 自动计算</li>
        </ul>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 bg-primary-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeInUp">
          <div className="bg-white rounded-card shadow-cardHover w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-primary-900 flex items-center gap-2"><Wallet className="w-5 h-5 text-primary-600" /> 修改预算配置</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">月度预算（元）</label>
                <input type="number" className="input" value={edit.monthlyBudget} onChange={(e) => setEdit({ ...edit, monthlyBudget: +e.target.value })} min={0} step={1000} />
              </div>
              <div>
                <label className="label">预警阈值（%）<span className="text-xs text-slate-400 ml-2">使用率达到该值触发审批</span></label>
                <input type="range" min={50} max={100} step={5} value={edit.alertThreshold} onChange={(e) => setEdit({ ...edit, alertThreshold: +e.target.value })} className="w-full mt-2" />
                <div className="text-center text-sm font-bold text-primary-700 mt-1">{edit.alertThreshold}%</div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button onClick={() => setEdit(null)} className="btn-secondary">取消</button>
              <button onClick={save} className="btn-primary"><Save className="w-4 h-4" /> 保存配置</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
