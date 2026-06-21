import { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatDateTime, formatMoney, formatDuration, billAuditStatusLabel, billAuditStatusColor, carTypeLabel } from '../../lib/format.js';
import type { Bill, Department } from '../../../shared/types';
import { Receipt, Search, Filter, CheckCircle2, XCircle, Clock, Eye, X, ChevronDown, TrendingUp, Users, Calendar, Car, Building2, ChevronRight, PieChart, LayoutGrid, Table2, ArrowRightLeft } from 'lucide-react';

type SummaryRow = { label: string; departmentId?: number | null; count: number; totalCost: number; avgCost: number; baseCost: number; mileageCost: number; overtimeCost: number; pendingCost: number; approvedCost: number };

export default function BillsPage() {
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const user = useAppStore((s) => s.user);
  const isFinance = user?.role === 'finance' || user?.role === 'admin';

  const [list, setList] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [month, setMonth] = useState('');
  const [carType, setCarType] = useState('all');
  const [view, setView] = useState<'table' | 'summary'>('table');
  const [groupBy, setGroupBy] = useState<'department' | 'month' | 'carType'>('department');
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [kpi, setKpi] = useState<Record<string, number>>({});
  const [summaryKpi, setSummaryKpi] = useState<Record<string, number>>({});
  const [departments, setDepartments] = useState<Department[]>([]);

  const [auditBill, setAuditBill] = useState<Bill | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const months = useMemo(() => {
    const arr: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return arr;
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const depts = await api.departments.list();
        setDepartments(depts as Department[]);
      } catch { /* ignore */ }
    };
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = { page, size: 10 };
      if (status !== 'all') params.status = status;
      if (departmentId) params.departmentId = +departmentId;
      if (month) params.month = month;
      if (carType !== 'all') params.carType = carType;
      const r = await api.finance.bills(params);
      const d = r as unknown as { list: Bill[]; total: number; kpi?: Record<string, number> };
      setList(d.list || []);
      setTotal(d.total || 0);
      if (d.kpi) setKpi(d.kpi);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  const loadSummary = async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = { groupBy };
      if (status !== 'all') params.status = status;
      if (departmentId) params.departmentId = +departmentId;
      if (month) params.month = month;
      if (carType !== 'all') params.carType = carType;
      const r = await api.finance.billsSummary(params);
      setSummary((r.list as SummaryRow[]) || []);
      if (r.kpi) setSummaryKpi(r.kpi);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, status, departmentId, month, carType]);
  useEffect(() => { if (view === 'summary') loadSummary(); }, [view, groupBy, status, departmentId, month, carType]);

  const resetFilters = () => {
    setStatus('all'); setDepartmentId(''); setMonth(''); setCarType('all'); setPage(1);
  };

  const applySummaryDrill = (row: SummaryRow) => {
    if (groupBy === 'department' && row.departmentId) {
      setDepartmentId(String(row.departmentId));
    } else if (groupBy === 'month') {
      setMonth(row.label);
    } else if (groupBy === 'carType') {
      const map: Record<string, string> = { '普通轿车': 'sedan', 'SUV': 'suv', '商务面包': 'van', '豪华商务': 'business' };
      if (map[row.label]) setCarType(map[row.label]);
    }
    setView('table');
    setPage(1);
  };

  const audit = async (approved: boolean) => {
    if (!auditBill) return;
    try {
      setSubmitting(true);
      await api.finance.audit(auditBill.id, { approved, comment });
      toast.success(approved ? '账单已审核通过，部门预算已同步更新' : '账单已驳回，已扣减对应预算');
      setAuditBill(null); setComment('');
      load();
      if (view === 'summary') loadSummary();
    } catch (e) { toast.error((e as { message?: string }).message || '审核失败'); }
    finally { setSubmitting(false); }
  };

  const activeFilters = [
    { k: '状态', v: status === 'all' ? null : (['pending', 'approved', 'rejected'].indexOf(status) >= 0 ? ['待审核', '已通过', '已驳回'][['pending', 'approved', 'rejected'].indexOf(status)] : status) },
    { k: '部门', v: departmentId ? (departments.find((d) => d.id === +departmentId)?.name || '-') : null },
    { k: '月份', v: month || null },
    { k: '车型', v: carType === 'all' ? null : (carTypeLabel[carType as keyof typeof carTypeLabel] || carType) },
  ].filter((f) => f.v);

  const fIcon = (g: string) => g === 'department' ? <Building2 className="w-4 h-4" /> : g === 'month' ? <Calendar className="w-4 h-4" /> : <Car className="w-4 h-4" />;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { t: '账单总数', n: kpi.totalBills ?? 0, c: 'from-primary-500 to-primary-700', i: <Receipt className="w-5 h-5" /> },
          { t: '待审核', n: kpi.pendingCount ?? 0, s: '¥' + formatMoney(kpi.pendingCost ?? 0).replace('¥', ''), c: 'from-warning-500 to-warning-600', i: <Clock className="w-5 h-5" /> },
          { t: '已通过', n: kpi.approvedCount ?? 0, s: '¥' + formatMoney(kpi.approvedCost ?? 0).replace('¥', ''), c: 'from-success-500 to-success-600', i: <CheckCircle2 className="w-5 h-5" /> },
          { t: '总金额', n: formatMoney(kpi.totalCost ?? 0), c: 'from-accent-500 to-accent-700', i: <TrendingUp className="w-5 h-5" />, big: true },
        ].map((k, i) => (
          <div key={i} className={`card overflow-hidden relative ${i === 3 ? '' : ''}`}>
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${k.c} opacity-20 blur-xl`} />
            <div className="flex items-start justify-between relative">
              <div>
                <div className="text-xs text-slate-500">{k.t}</div>
                <div className={`mt-1 ${k.big ? 'text-2xl' : 'text-3xl'} font-black text-primary-900 font-mono tracking-tight`}>{k.n as string | number}</div>
                {k.s && <div className="text-xs text-slate-400 mt-0.5">{k.s}</div>}
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.c} text-white flex items-center justify-center shadow-md`}>{k.i}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { t: '基础费用', n: formatMoney(kpi.baseCost ?? 0), c: 'bg-primary-50 border-primary-100 text-primary-700', p: 30 },
          { t: '里程费用', n: formatMoney(kpi.mileageCost ?? 0), c: 'bg-accent-50 border-accent-100 text-accent-700', p: 50 },
          { t: '超时费用', n: formatMoney(kpi.overtimeCost ?? 0), c: 'bg-warning-50 border-warning-100 text-warning-700', p: 20 },
        ].map((x, i) => (
          <div key={i} className={`card ${x.c} border`}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold opacity-80">{x.t}</div>
              <div className="text-[10px] opacity-60">占比 {x.p}%</div>
            </div>
            <div className="mt-2 text-2xl font-black font-mono">{x.n}</div>
            <div className="mt-3 h-1.5 rounded-full bg-black/5 overflow-hidden">
              <div className={`h-full ${x.c.includes('primary') ? 'bg-primary-500' : x.c.includes('accent') ? 'bg-accent-500' : 'bg-warning-500'}`} style={{ width: `${x.p}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { setView('table'); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${view === 'table' ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-primary-50'}`}>
              <Table2 className="w-3.5 h-3.5" /> 明细视图
            </button>
            <button onClick={() => { setView('summary'); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${view === 'summary' ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-primary-50'}`}>
              <LayoutGrid className="w-3.5 h-3.5" /> 汇总视图
            </button>
            {view === 'summary' && (
              <div className="flex items-center gap-1 ml-2 rounded-lg bg-slate-100 p-1">
                {(['department', 'month', 'carType'] as const).map((g) => (
                  <button key={g} onClick={() => setGroupBy(g)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${groupBy === g ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-primary-600'}`}>
                    {fIcon(g)} {g === 'department' ? '按部门' : g === 'month' ? '按月份' : '按车型'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {activeFilters.length > 0 && (
            <button onClick={resetFilters} className="text-xs text-slate-500 hover:text-danger-600 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> 清除筛选 ({activeFilters.length})
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><Filter className="w-3.5 h-3.5" /> 筛选：</div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input !py-1.5 !text-xs !h-auto min-w-[120px]">
            <option value="all">全部状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
          </select>
          <select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }} className="input !py-1.5 !text-xs !h-auto min-w-[140px]">
            <option value="">全部部门</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} className="input !py-1.5 !text-xs !h-auto min-w-[140px]">
            <option value="">全部月份</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={carType} onChange={(e) => { setCarType(e.target.value); setPage(1); }} className="input !py-1.5 !text-xs !h-auto min-w-[130px]">
            <option value="all">全部车型</option>
            <option value="sedan">普通轿车</option>
            <option value="suv">SUV</option>
            <option value="van">商务面包</option>
            <option value="business">豪华商务</option>
          </select>
        </div>

        {activeFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeFilters.map((f, i) => (
              <span key={i} className="tag-pill bg-primary-100 text-primary-700 flex items-center gap-1 text-xs">
                {f.k}：<b>{f.v as string}</b>
                <button
                  onClick={() => {
                    if (f.k === '状态') setStatus('all');
                    else if (f.k === '部门') setDepartmentId('');
                    else if (f.k === '月份') setMonth('');
                    else if (f.k === '车型') setCarType('all');
                    setPage(1);
                  }}
                  className="ml-0.5 hover:text-danger-600"
                ><XCircle className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {view === 'table' ? (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-accent-500" /> 账单明细
              <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 text-xs font-semibold">共 {total} 条</span>
            </h3>
          </div>

          {list.length === 0 ? (
            <div className="py-16 text-center"><Receipt className="w-16 h-16 mx-auto text-slate-200 mb-3" /><p className="text-sm text-slate-400">暂无符合条件的账单</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>账单号</th>
                    <th>申请人</th>
                    <th>部门</th>
                    <th>车型/车牌</th>
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
                  {list.map((b) => {
                    const row = b as unknown as Record<string, unknown>;
                    return (
                      <tr key={b.id}>
                        <td className="font-mono text-xs text-slate-500">{b.billNo}</td>
                        <td className="font-bold text-primary-900">{b.applicantName || '-'}</td>
                        <td className="text-slate-500 text-xs">{b.departmentName || '-'}</td>
                        <td className="text-xs">
                          <div className="font-semibold text-primary-800">{(row.plateNumber ?? '-') as React.ReactNode}</div>
                          <div className="text-slate-400">{row.carType ? carTypeLabel[row.carType as keyof typeof carTypeLabel] : '-'}</div>
                        </td>
                        <td className="font-mono text-xs">{b.actualMileage ?? '-'}km / {formatDuration(b.actualDurationMin ?? 0)}</td>
                        <td className="font-mono text-xs">{formatMoney(b.baseCost)}</td>
                        <td className="font-mono text-xs">{formatMoney(b.mileageCost)}</td>
                        <td className="font-mono text-xs">{formatMoney(b.overtimeCost)}</td>
                        <td className="font-mono font-bold text-primary-900 text-base">{formatMoney(b.totalCost)}</td>
                        <td><span className={`tag-pill ${billAuditStatusColor[b.auditStatus]}`}>{billAuditStatusLabel[b.auditStatus]}</span></td>
                        <td>
                          {b.auditStatus === 'pending' && isFinance ? (
                            <button onClick={() => { setAuditBill(b); setComment(''); }} className="btn-primary text-xs !py-1 !px-2.5"><Eye className="w-3 h-3" /> 审核</button>
                          ) : (
                            <button onClick={() => setAuditBill(b)} className="btn-ghost text-xs !py-1 !px-2.5"><Eye className="w-3 h-3" /> 详情</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { t: '分组维度', v: groupBy === 'department' ? '部门' : groupBy === 'month' ? '月份' : '车型', c: 'primary' },
              { t: '分组数', n: summary.length, c: 'accent' },
              { t: '总笔数', n: summaryKpi.totalBills ?? 0, c: 'success' },
              { t: '总金额', n: formatMoney(summaryKpi.totalCost ?? 0), c: 'warning' },
            ].map((x, i) => (
              <div key={i} className={`card border border-${x.c}-100`}>
                <div className="text-xs text-slate-500">{x.t}</div>
                <div className={`mt-1 text-2xl font-black font-mono text-${x.c}-700`}>
                  {(x.v as string) ?? x.n as number}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            {summary.length === 0 ? (
              <div className="py-16 text-center"><PieChart className="w-16 h-16 mx-auto text-slate-200 mb-3" /><p className="text-sm text-slate-400">暂无汇总数据</p></div>
            ) : (
              <div className="space-y-3">
                {summary.map((row, i) => {
                  const maxCost = Math.max(...summary.map((s) => s.totalCost), 1);
                  const pct = Math.max(3, Math.round((row.totalCost / maxCost) * 100));
                  return (
                    <button
                      key={i}
                      onClick={() => applySummaryDrill(row)}
                      className="w-full text-left p-4 rounded-xl border-2 border-slate-100 hover:border-primary-200 hover:shadow-sm transition-all group bg-gradient-to-r from-white to-slate-50/50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 text-white flex items-center justify-center shadow-md">
                            {fIcon(groupBy)}
                          </div>
                          <div>
                            <div className="font-bold text-primary-900 flex items-center gap-2 text-base">
                              {row.label}
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {row.count} 笔账单 · 平均 {formatMoney(row.avgCost)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-slate-500">总金额</div>
                          <div className="text-2xl font-black font-mono text-accent-600">{formatMoney(row.totalCost)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-primary-50 border border-primary-100">
                          <div className="text-[10px] text-slate-500">基础费</div>
                          <div className="font-bold font-mono text-primary-700">{formatMoney(row.baseCost)}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-accent-50 border border-accent-100">
                          <div className="text-[10px] text-slate-500">里程费</div>
                          <div className="font-bold font-mono text-accent-700">{formatMoney(row.mileageCost)}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-warning-50 border border-warning-100">
                          <div className="text-[10px] text-slate-500">超时费</div>
                          <div className="font-bold font-mono text-warning-700">{formatMoney(row.overtimeCost)}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-success-50 border border-success-100">
                          <div className="text-[10px] text-slate-500">已通过 / 待审核</div>
                          <div className="font-bold font-mono text-success-700">{formatMoney(row.approvedCost)} <span className="text-slate-400 mx-1">/</span> <span className="text-warning-600">{formatMoney(row.pendingCost)}</span></div>
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary-500 via-accent-500 to-warning-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>占最高分组 {pct}%</span>
                        <span className="text-primary-600 flex items-center gap-0.5 group-hover:text-accent-600">
                          点击查看对应明细 <ArrowRightLeft className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {auditBill && (
        <div className="fixed inset-0 z-50 bg-primary-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeInUp">
          <div className="bg-white rounded-card shadow-cardHover w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-primary-900 flex items-center gap-2"><Receipt className="w-4 h-4 text-accent-600" /> 账单详情</h3>
              <button onClick={() => setAuditBill(null)} className="text-slate-400 hover:text-danger-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">账单号：</span><span className="font-mono">{auditBill.billNo}</span></div>
                <div><span className="text-slate-500">申请时间：</span><span>{formatDateTime(auditBill.createdAt).slice(0, 16)}</span></div>
                <div><span className="text-slate-500">申请人：</span><span className="font-bold">{auditBill.applicantName}</span></div>
                <div><span className="text-slate-500">部门：</span>{auditBill.departmentName}</div>
                <div><span className="text-slate-500">车牌：</span>{((auditBill as unknown as Record<string, unknown>).plateNumber ?? '-') as React.ReactNode}</div>
                <div><span className="text-slate-500">行程：</span>{auditBill.actualMileage ?? 0}km / {formatDuration(auditBill.actualDurationMin ?? 0)}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-600">基础费用</span><span className="font-mono">{formatMoney(auditBill.baseCost)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-600">里程费用</span><span className="font-mono">{formatMoney(auditBill.mileageCost)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-600">超时费用</span><span className="font-mono">{formatMoney(auditBill.overtimeCost)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-2"><span className="text-primary-900">合计</span><span className="font-mono text-accent-600">{formatMoney(auditBill.totalCost)}</span></div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`tag-pill ${billAuditStatusColor[auditBill.auditStatus]}`}>{billAuditStatusLabel[auditBill.auditStatus]}</span>
                {auditBill.auditComment && <span className="text-xs text-slate-500">备注：{auditBill.auditComment}</span>}
              </div>

              {auditBill.auditStatus === 'pending' && isFinance && (
                <div>
                  <label className="label">审核备注 <span className="text-slate-400 font-normal">（驳回时建议填写）</span></label>
                  <textarea rows={2} className="input resize-none" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="选填审核意见" disabled={submitting} />
                  <div className="mt-2 p-2 rounded-lg bg-primary-50/60 border border-primary-100 text-[11px] text-primary-700 flex items-start gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>审核通过后将确认预算扣减；如驳回将自动冲回已占用预算，并同步更新部门预算占用及主管统计视图。</span>
                  </div>
                </div>
              )}
            </div>
            {auditBill.auditStatus === 'pending' && isFinance && (
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
