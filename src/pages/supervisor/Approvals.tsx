import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatDateTime, formatMoney, applicationStatusLabel, applicationStatusColor } from '../../lib/format.js';
import type { Approval, ApplicationStatus } from '../../../shared/types';
import { ShieldCheck, CheckCircle2, XCircle, Filter, Clock, AlertTriangle, FileText, Send, X } from 'lucide-react';

export default function ApprovalsPage() {
  const [params, setParams] = useSearchParams();
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [list, setList] = useState<Approval[]>([]);
  const [status, setStatus] = useState<string>(params.get('status') || 'pending');
  const [modalApp, setModalApp] = useState<Approval | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setParams({ status }, { replace: true });
      const r = await api.approvals.list({ status });
      setList(r as unknown as Approval[]);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [status, setLoading]);

  const decide = async (approved: boolean) => {
    if (!modalApp) return;
    try {
      setSubmitting(true);
      await api.approvals.decide(modalApp.id, { approved, comment });
      toast.success(approved ? '审批通过！' : '已拒绝申请');
      setModalApp(null); setComment('');
      load();
    } catch (e) { toast.error((e as { message?: string }).message || '操作失败'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-600" /> 审批中心
            <span className="ml-2 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">共 {list.length} 条</span>
          </h3>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {['pending', 'approved', 'rejected'].map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${status === s ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-primary-50 hover:text-primary-700'}`}>
                {s === 'pending' ? '待审批' : s === 'approved' ? '已通过' : '已拒绝'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {list.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-success-400 mb-3 opacity-50" />
              <p className="text-sm text-slate-400">暂无审批事项</p>
            </div>
          ) : (list as unknown as Array<Record<string, unknown>>).map((a) => {
            const usagePct = a.remainingBudget ? Math.round(((a.estimatedCost as number) / ((a.remainingBudget as number) + (a.estimatedCost as number))) * 100) : 0;
            return (
              <div key={a.id as number} className={`p-5 rounded-2xl border-2 transition-all ${a.decision === 'approved' ? 'border-success-200 bg-success-50/30' : a.decision === 'rejected' ? 'border-danger-200 bg-danger-50/30' : 'border-warning-200 bg-gradient-to-r from-warning-50/40 to-transparent hover:shadow-md'}`}>
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${a.decision === 'approved' ? 'bg-success-500 text-white' : a.decision === 'rejected' ? 'bg-danger-500 text-white' : 'bg-warning-500 text-white animate-pulseRing'}`}>
                      {a.decision === 'approved' ? <CheckCircle2 className="w-6 h-6" /> : a.decision === 'rejected' ? <XCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-primary-900 truncate">{a.origin as string} → {a.destination as string}</h4>
                        <span className={`tag-pill ${applicationStatusColor[a.applicationStatus as ApplicationStatus] || 'bg-slate-100'}`}>
                          {applicationStatusLabel[a.applicationStatus as ApplicationStatus] || (a.applicationStatus as React.ReactNode)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                        <span>👤 {a.applicantName as string}</span>
                        <span>📅 {formatDateTime(a.startTime as string)}</span>
                        <span>👥 {a.passengers as number}人</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-primary-800 font-mono">{formatMoney(a.estimatedCost as number)}</div>
                    <div className="text-[11px] text-slate-400 mt-1">预估费用</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-white border border-slate-100">
                    <div className="text-[11px] text-slate-500 mb-1">剩余预算</div>
                    <div className="text-lg font-bold text-primary-700 font-mono">{formatMoney(a.remainingBudget as number)}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${a.overAmount ? 'bg-danger-50 border-danger-200' : 'bg-success-50 border-success-200'}`}>
                    <div className="text-[11px] text-slate-500 mb-1">预算差额</div>
                    <div className={`text-lg font-bold font-mono flex items-center gap-1 ${a.overAmount ? 'text-danger-600' : 'text-success-600'}`}>
                      {a.overAmount ? <><AlertTriangle className="w-4 h-4" /> 超支{formatMoney(a.overAmount as number)}</> : <>在预算内</>}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-100">
                    <div className="text-[11px] text-slate-500 mb-2">本次后使用率</div>
                    <div className="progress-bar"><div className={`progress-fill ${usagePct >= 90 ? 'bg-danger-500' : usagePct >= 80 ? 'bg-warning-500' : 'bg-success-500'}`} style={{ width: `${Math.min(100, usagePct)}%` }} /></div>
                    <div className="text-xs text-slate-500 mt-1 text-right">{usagePct}%</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 mb-4">
                  <div className="text-[11px] text-slate-500 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> 用车事由</div>
                  <div className="text-sm text-primary-800">{a.reason as string}</div>
                </div>

                {a.decision && (a.comment || a.decision) && (
                  <div className={`p-3 rounded-xl border mb-4 ${a.decision === 'approved' ? 'bg-success-50 border-success-200' : 'bg-danger-50 border-danger-200'}`}>
                    <div className={`text-xs font-semibold mb-1 ${a.decision === 'approved' ? 'text-success-700' : 'text-danger-700'}`}>
                      {a.decision === 'approved' ? '✓ 审批通过' : '✗ 审批未通过'} · 审批于 {formatDateTime(a.decidedAt as string)}
                    </div>
                    {(a.comment as string) && <div className="text-sm text-slate-700">备注：{a.comment as string}</div>}
                  </div>
                )}

                {(a.decision === 'pending' || a.decision === null) && (
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setModalApp(a as unknown as Approval); setComment(''); }} className="btn-danger">
                      <XCircle className="w-4 h-4" /> 拒绝
                    </button>
                    <button onClick={() => { setModalApp(a as unknown as Approval); setComment(''); setTimeout(() => decide(true), 0); }} className="btn-success" disabled={submitting}>
                      <CheckCircle2 className="w-4 h-4" /> 通过申请
                    </button>
                    <button onClick={() => setModalApp(a as unknown as Approval)} className="btn-primary">
                      <Send className="w-4 h-4" /> 填写意见并审批
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {modalApp && (
        <div className="fixed inset-0 z-50 bg-primary-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeInUp">
          <div className="bg-white rounded-card shadow-cardHover w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-primary-900">审批意见</h3>
              <button onClick={() => setModalApp(null)} className="text-slate-400 hover:text-danger-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-primary-50/50 text-sm">
                <span className="font-semibold">{(modalApp as unknown as Record<string, unknown>).applicantName as string}</span>
                <span className="text-slate-500 mx-2">申请</span>
                <span className="font-mono font-bold text-primary-800">{formatMoney((modalApp as unknown as Record<string, unknown>).estimatedCost as number)}</span>
              </div>
              <div>
                <label className="label">审批备注 {submitting ? '（处理中...）' : ''}</label>
                <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} className="input resize-none" placeholder="请输入审批意见（选填）" disabled={submitting} />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button onClick={() => decide(false)} disabled={submitting} className="btn-danger"><XCircle className="w-4 h-4" /> 拒绝</button>
              <button onClick={() => decide(true)} disabled={submitting} className="btn-success"><CheckCircle2 className="w-4 h-4" /> 通过</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
