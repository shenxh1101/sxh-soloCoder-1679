import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { driverStatusLabel, driverStatusColor } from '../../lib/format.js';
import type { Driver } from '../../../shared/types.js';
import { Users, Search, Phone, Star, Gauge, Plus, X } from 'lucide-react';

export default function DriversPage() {
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [list, setList] = useState<Driver[]>([]);
  const [status, setStatus] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const r = await api.drivers.list({ status: status === 'all' ? undefined : status });
      setList(r as unknown as Driver[]);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [status]);

  const filtered = list.filter((d) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return d.name.toLowerCase().includes(kw) || d.phone.includes(kw) || d.licenseNumber.toLowerCase().includes(kw);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-500" /> 司机管理
            <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 text-xs font-semibold">共 {filtered.length} 人</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索姓名/手机" className="input !pl-9 !w-44" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-28">
              <option value="all">全部状态</option>
              <option value="on_duty">在岗</option>
              <option value="off_duty">休息</option>
              <option value="leave">请假</option>
            </select>
            <button onClick={() => setShowAdd(true)} className="btn-accent text-xs">
              <Plus className="w-4 h-4" /> 添加司机
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center"><Users className="w-16 h-16 mx-auto text-slate-200 mb-3" /><p className="text-sm text-slate-400">暂无司机</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((d) => (
              <div key={d.id} className="p-5 rounded-xl border border-slate-100 hover:shadow-md hover:border-primary-200 transition-all">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white font-bold flex items-center justify-center text-xl shrink-0">
                    {d.name.slice(-1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-primary-900">{d.name}</h4>
                      <span className={`tag-pill ${driverStatusColor[d.status]}`}>{driverStatusLabel[d.status]}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <Phone className="w-3 h-3" /> {d.phone}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                    <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1"><Star className="w-3 h-3 text-warning-500" /> 评分</div>
                    <div className="text-sm font-bold text-primary-800 mt-0.5">{d.avgRating.toFixed(1)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                    <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1"><Gauge className="w-3 h-3" /> 出车</div>
                    <div className="text-sm font-bold text-primary-800 mt-0.5">{d.totalTrips}次</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                    <div className="text-[11px] text-slate-500">驾照</div>
                    <div className="text-sm font-bold text-primary-800 mt-0.5">{d.licenseType}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                  <div>驾照号：{d.licenseNumber}</div>
                  <div>有效期至：{d.licenseExpiry}</div>
                  <div>入职日期：{d.hireDate}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-primary-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeInUp">
          <div className="bg-white rounded-card shadow-cardHover w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-primary-900 flex items-center gap-2"><Users className="w-5 h-5 text-accent-500" /> 添加司机</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-danger-500"><X className="w-5 h-5" /></button>
            </div>
            <AddDriverForm onClose={() => { setShowAdd(false); load(); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddDriverForm({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const setLoading = useAppStore((s) => s.setLoading);
  const [form, setForm] = useState({ name: '', phone: '', licenseNumber: '', licenseType: 'C1', licenseExpiry: '', hireDate: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.licenseNumber || !form.licenseExpiry || !form.hireDate) { toast.warning('请填写完整信息'); return; }
    try {
      setLoading(true);
      await api.drivers.create({ ...form, status: 'on_duty' });
      toast.success('司机添加成功');
      onClose();
    } catch (e) { toast.error((e as { message?: string }).message || '添加失败'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">姓名 *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label">手机号 *</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label className="label">驾照号 *</label><input className="input" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} /></div>
        <div><label className="label">驾照类型</label><select className="input" value={form.licenseType} onChange={(e) => setForm({ ...form, licenseType: e.target.value })}>
          <option value="C1">C1</option><option value="C2">C2</option><option value="B1">B1</option><option value="B2">B2</option><option value="A1">A1</option><option value="A2">A2</option>
        </select></div>
        <div><label className="label">有效期至 *</label><input type="date" className="input" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} /></div>
        <div><label className="label">入职日期 *</label><input type="date" className="input" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} /></div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">取消</button>
        <button type="submit" className="btn-accent"><Plus className="w-4 h-4" /> 添加</button>
      </div>
    </form>
  );
}
