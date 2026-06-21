import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatDateTime, formatMoney, formatDuration, billAuditStatusLabel, billAuditStatusColor } from '../../lib/format.js';
import type { Bill } from '../../../shared/types.js';
import { Receipt, Search, Filter, CheckCircle2, XCircle, Clock, Eye, X, ChevronDown } from 'lucide-react';

export default function BillsPage() {
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [list, setList] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [auditBill, setAuditBill] = useState<Bill | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const r = await api.finance.bills({ page, size: 10, status: status === 'all' ? undefined : status });
      const d = r as unknown as { list: Bill[]; total: number };
      setList(d.list || []);
      setTotal(d.total || 0);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, status]);

  const audit = async (approved: boolean) => {
    if (!auditBill) return;
    try {
      setSubmitting(true);
      await api.finance.audit(auditBill.id, { approved, comment });
      toast.success(approved ? '账单已审核通过' : '账单已驳回');
      setAuditBill(null); setComment('');
      load();
    } catch (e) { toast.error((e as { message?: string }).message || '审核失败'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-accent-500" /> 账单管理
            <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 text-xs font-semibold">共 {total} 条</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {['all', 'pending', 'approved', 'rejected'].map((s) => (
              <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${status === s ? 'bg-accent-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-accent-50'}`}>
                {s === 'all' ? '全部' : s === 'pending' ? '待审核' : s === 'approved' ? '已通过' : '已驳回'}
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="py-16 text-center"><Receipt className="w-16 h-16 mx-auto text-slate-200 mb-3" /><p className="text-sm text-slate-400">暂无账单</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>账单号</th>
                  <th>申请人</th>
                  <th>部门</th>
                  <th>里程/时长</th>
                  <th>基础费</th>
                  <th>里程费</th>
                  <th>超时费</th>
                  <th>总费用</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id}>
                    <td className="font-mono text-xs text-slate-500">{b.billNo}</td>
                    <td className="font-bold text-primary-900">{b.applicantName || '-'}</td>
                    <td className="text-slate-500">{b.departmentName || '-'}</td>
                    <td className="font-mono text-xs">{b.actualMileage ?? b.trip?.actualMileage ?? '-'}km / {formatDuration(b.actualDurationMin ?? b.trip?.actualDurationMin ?? 0)}</td>
                    <td className="font-mono">{formatMoney(b.baseCost)}</td>
                    <td className="font-mono">{formatMoney(b.mileageCost)}</td>
                    <td className="font-mono">{formatMoney(b.overtimeCost)}</td>
                    <td className="font-mono font-bold text-primary-900 text-lg">{formatMoney(b.totalCost)}</td>
                    <td><span className={`tag-pill ${billAuditStatusColor[b.auditStatus]}`}>{billAuditStatusLabel[b.auditStatus]}</span></td>
                    <td>
                      {b.auditStatus === 'pending' ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setAuditBill(b); setComment(''); }} className="btn-primary text-xs !py-1 !px-2"><Eye className="w-3 h-3" /> 审核</button>
                        </div>
                      ) : (
                        <button onClick={() => setAuditBill(b)} className="btn-ghost text-xs !py-1 !px-2"><Eye className="w-3 h-3" /> 详情</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 10 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">第 {page} 页，共 {Math.ceil(total / 10)} 页</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost text-xs !py-1">上一页</button>
              <button disabled={page >= Math.ceil(total / 10)} onClick={() => setPage(page + 1)} className="btn-ghost text-xs !py-1">下一页</button>
            </div>
          </div>
        )}
      </div>

      {auditBill && (
        <div className="fixed inset-0 z-50 bg-primary-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeInUp">
          <div className="bg-white rounded-card shadow-cardHover w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-primary-900">账单详情</h3>
              <button onClick={() => setAuditBill(null)} className="text-slate-400 hover:text-danger-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">账单号：</span><span className="font-mono">{auditBill.billNo}</span></div>
                <div><span className="text-slate-500">申请人：</span><span className="font-bold">{auditBill.applicantName}</span></div>
                <div><span className="text-slate-500">部门：</span>{auditBill.departmentName}</div>
                <div><span className="text-slate-500">车牌：</span>{(auditBill as unknown as Record<string, unknown>).plateNumber || '-'}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 space-y-2">
                <div className="flex justify-between text-sm"><span>基础费用</span><span className="font-mono">{formatMoney(auditBill.baseCost)}</span></div>
                <div className="flex justify-between text-sm"><span>里程费用</span><span className="font-mono">{formatMoney(auditBill.mileageCost)}</span></div>
                <div className="flex justify-between text-sm"><span>超时费用</span><span className="font-mono">{formatMoney(auditBill.overtimeCost)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-2"><span>合计</span><span className="font-mono text-accent-600">{formatMoney(auditBill.totalCost)}</span></div>
              </div>
              <div><span className={`tag-pill ${billAuditStatusColor[auditBill.auditStatus]}`}>{billAuditStatusLabel[auditBill.auditStatus]}</span></div>

              {auditBill.auditStatus === 'pending' && (
                <div>
                  <label className="label">审核备注</label>
                  <textarea rows={2} className="input resize-none" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="选填审核意见" disabled={submitting} />
                </div>
              )}
            </div>
            {auditBill.auditStatus === 'pending' && (
              <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                <button onClick={() => audit(false)} disabled={submitting} className="btn-danger"><XCircle className="w-4 h-4" /> 驳回</button>
                <button onClick={() => audit(true)} disabled={submitting} className="btn-success"><CheckCircle2 className="w-4 h-4" /> 通过</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
