import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatMoney } from '../../lib/format.js';
import { Wallet, AlertTriangle, Save, DollarSign, TrendingDown, CheckCircle2, Clock } from 'lucide-react';

export default function BudgetPage() {
  const user = useAppStore((s) => s.user);
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [budget, setBudget] = useState<Record<string, unknown> | null>(null);
  const [budgetAnalysis, setBudgetAnalysis] = useState<Record<string, unknown> | null>(null);
  const [edit, setEdit] = useState<{ monthlyBudget: number; alertThreshold: number } | null>(null);

  const load = async () => {
    if (!user?.departmentId) return;
    try {
      setLoading(true);
      const r = await api.budgets.get(user.departmentId);
      setBudget(r as unknown as Record<string, unknown>);
      try {
        const ba = await api.finance.budgetAnalysis() as unknown as { list: Array<Record<string, unknown>>; kpi: Record<string, unknown> };
        if (ba.list && ba.list.length > 0) setBudgetAnalysis(ba.list[0]);
      } catch {}
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
  const ba = budgetAnalysis;
  const baUsage = ba ? (ba.usagePercent as number) : 0;
  const riskLevel = ba ? (ba.riskLevel as string) : usage >= threshold ? 'warning' : 'normal';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6" /> {budget.departmentName as string} · 预算管理</h3>
            <p className="text-white/60 text-sm mt-1">当前周期：{budget.currentMonth as string} · 数据与财务审核同步</p>
          </div>
          <div className="flex items-center gap-2">
            {ba && (
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                riskLevel === 'overrun' ? 'bg-danger-500/25 text-danger-200' :
                riskLevel === 'warning' ? 'bg-warning-500/25 text-warning-200' :
                'bg-success-500/25 text-success-200'
              }`}>
                {riskLevel === 'overrun' ? '已超支' : riskLevel === 'warning' ? '风险预警' : '预算正常'}
              </span>
            )}
            <button onClick={openEdit} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium backdrop-blur flex items-center gap-2 transition-all">
              <Save className="w-4 h-4" /> 修改配置
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
            <div className="text-xs text-white/60">月度预算</div>
            <div className="text-2xl font-black mt-1 font-mono">{formatMoney(budget.monthlyBudget as number)}</div>
          </div>
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
            <div className="text-xs text-white/60 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-success-400" /> 已审核费用</div>
            <div className="text-2xl font-black mt-1 text-success-300 font-mono">{ba ? formatMoney(ba.approvedCost as number) : '-'}</div>
            {ba && <div className="text-[10px] text-white/50 mt-0.5">{ba.approvedCount as number} 笔已通过</div>}
          </div>
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
            <div className="text-xs text-white/60 flex items-center gap-1"><Clock className="w-3 h-3 text-warning-400" /> 待审核风险</div>
            <div className="text-2xl font-black mt-1 text-warning-300 font-mono">{ba ? formatMoney(ba.pendingCost as number) : '-'}</div>
            {ba && <div className="text-[10px] text-white/50 mt-0.5">{ba.pendingCount as number} 笔待审核</div>}
          </div>
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
            <div className="text-xs text-white/60">{ba && (ba.remainingBudget as number) > 0 ? '剩余预算' : ba ? '预计超支' : '使用率'}</div>
            <div className={`text-2xl font-black mt-1 font-mono ${
              ba ? ((ba.remainingBudget as number) > 0 ? 'text-success-300' : 'text-danger-300') :
              usage >= threshold ? 'text-danger-300' : 'text-white'
            }`}>
              {ba
                ? formatMoney(Math.max(0, ba.remainingBudget as number) || (ba.estimatedOverrun as number))
                : `${usage.toFixed(1)}%`
              }
            </div>
            {ba && <div className="text-[10px] text-white/50 mt-0.5">使用率 {baUsage.toFixed(1)}%</div>}
          </div>
        </div>
      </div>

      {ba && (
        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-accent-500" /> 预算执行分析
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-success-50 text-center">
                <div className="text-xs text-success-600">已审核费用</div>
                <div className="text-lg font-black text-success-700 mt-1 font-mono">{formatMoney(ba.approvedCost as number)}</div>
                <div className="text-[10px] text-success-500 mt-0.5">{(ba.approvedPercent as number).toFixed(1)}%</div>
              </div>
              <div className="p-3 rounded-xl bg-warning-50 text-center">
                <div className="text-xs text-warning-600">待审核风险</div>
                <div className="text-lg font-black text-warning-700 mt-1 font-mono">{formatMoney(ba.pendingCost as number)}</div>
                <div className="text-[10px] text-warning-500 mt-0.5">{(ba.pendingPercent as number).toFixed(1)}%</div>
              </div>
              <div className={`p-3 rounded-xl text-center ${(ba.remainingBudget as number) > 0 ? 'bg-primary-50' : 'bg-danger-50'}`}>
                <div className={`text-xs ${(ba.remainingBudget as number) > 0 ? 'text-primary-600' : 'text-danger-600'}`}>
                  {(ba.remainingBudget as number) > 0 ? '剩余预算' : '预计超支'}
                </div>
                <div className={`text-lg font-black mt-1 font-mono ${(ba.remainingBudget as number) > 0 ? 'text-primary-700' : 'text-danger-700'}`}>
                  {formatMoney(Math.max(0, ba.remainingBudget as number) || (ba.estimatedOverrun as number))}
                </div>
                <div className={`text-[10px] mt-0.5 ${(ba.remainingBudget as number) > 0 ? 'text-primary-500' : 'text-danger-500'}`}>
                  {baUsage.toFixed(1)}% 使用率
                </div>
              </div>
            </div>
            <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-success-500 to-success-400 transition-all"
                style={{ width: `${ba.approvedPercent as number}%` }}
              />
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-warning-400 to-warning-500 transition-all"
                style={{ left: `${ba.approvedPercent as number}%`, width: `${ba.pendingPercent as number}%` }}
              />
              <div className="absolute top-0 h-full w-0.5 bg-danger-500/70" style={{ left: '80%' }} />
              <div className="absolute top-0 h-full w-0.5 bg-danger-600" style={{ left: '100%' }} />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>0%</span>
              <span className="text-warning-600 font-medium">预警线 80%</span>
              <span>100%</span>
            </div>
            {riskLevel !== 'normal' && (
              <div className={`p-3 rounded-lg border text-sm flex items-start gap-2 ${
                riskLevel === 'overrun' ? 'bg-danger-50 border-danger-200 text-danger-700' : 'bg-warning-50 border-warning-200 text-warning-700'
              }`}>
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">{riskLevel === 'overrun' ? '预算超支预警' : '预算使用预警'}</div>
                  <div className="text-xs mt-1">
                    {riskLevel === 'overrun'
                      ? `当前已超支 ${formatMoney(ba.estimatedOverrun as number)}，待审核账单通过后将进一步扩大缺口，建议严格管控费用支出或申请追加预算。`
                      : `预算使用率已达 ${baUsage.toFixed(1)}%，接近预警线，建议合理安排后续用车，避免超支。`
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
