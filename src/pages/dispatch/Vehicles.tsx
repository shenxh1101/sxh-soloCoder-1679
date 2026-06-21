import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatMoney, vehicleStatusLabel, vehicleStatusColor, carTypeLabel, maintenanceAlertLevelColor } from '../../lib/format.js';
import type { Vehicle } from '../../../shared/types.js';
import { Car, Plus, Search, Filter, Wrench, Gauge, AlertTriangle, ChevronDown, Edit2, Trash2, X } from 'lucide-react';

export default function VehiclesPage() {
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [list, setList] = useState<Vehicle[]>([]);
  const [status, setStatus] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const r = await api.vehicles.list({ status: status === 'all' ? undefined : status });
      setList(r as unknown as Vehicle[]);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [status]);

  const filtered = list.filter((v) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return v.plateNumber.toLowerCase().includes(kw) || v.brand.toLowerCase().includes(kw) || v.model.toLowerCase().includes(kw);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
            <Car className="w-5 h-5 text-primary-600" /> 车辆管理
            <span className="ml-2 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">共 {filtered.length} 辆</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索车牌/品牌" className="input !pl-9 !w-44" />
            </div>
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-28">
              <option value="all">全部状态</option>
              <option value="idle">空闲</option>
              <option value="in_use">出车中</option>
              <option value="maintenance">保养中</option>
              <option value="repair">维修中</option>
            </select>
            <button onClick={() => setShowAdd(true)} className="btn-primary text-xs">
              <Plus className="w-4 h-4" /> 添加车辆
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center"><Car className="w-16 h-16 mx-auto text-slate-200 mb-3" /><p className="text-sm text-slate-400">暂无车辆</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>车牌号</th>
                  <th>品牌车型</th>
                  <th>类型</th>
                  <th>座位</th>
                  <th>当前里程</th>
                  <th>距下次保养</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const distToMaint = v.distanceToMaintenance ?? (v.lastMaintenanceMileage + v.maintenanceInterval - v.currentMileage);
                  const alertLevel = v.maintenanceAlertLevel ?? (distToMaint <= 0 ? 'danger' : distToMaint <= 1000 ? 'warning' : 'normal');
                  return (
                    <tr key={v.id}>
                      <td className="font-bold text-primary-900 font-mono">{v.plateNumber}</td>
                      <td>{v.brand} {v.model}</td>
                      <td><span className="tag-pill bg-slate-100 text-slate-700">{carTypeLabel[v.carType] || v.carType}</span></td>
                      <td>{v.seatingCapacity}座</td>
                      <td className="font-mono">{v.currentMileage.toLocaleString()} km</td>
                      <td>
                        <span className={`tag-pill ${maintenanceAlertLevelColor(alertLevel)}`}>
                          {alertLevel === 'danger' ? <AlertTriangle className="w-3 h-3 inline mr-1" /> : null}
                          {distToMaint.toLocaleString()} km
                        </span>
                      </td>
                      <td><span className={`tag-pill ${vehicleStatusColor[v.status]}`}>{vehicleStatusLabel[v.status]}</span></td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="btn-ghost text-xs !px-2 !py-1"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button className="btn-ghost text-xs !px-2 !py-1 text-danger-500 hover:bg-danger-50"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-primary-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeInUp">
          <div className="bg-white rounded-card shadow-cardHover w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-primary-900 flex items-center gap-2"><Car className="w-5 h-5 text-primary-600" /> 添加车辆</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-danger-500"><X className="w-5 h-5" /></button>
            </div>
            <AddVehicleForm onClose={() => { setShowAdd(false); load(); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddVehicleForm({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const setLoading = useAppStore((s) => s.setLoading);
  const [form, setForm] = useState({ plateNumber: '', brand: '', model: '', carType: 'sedan', seatingCapacity: 5, currentMileage: 0, maintenanceInterval: 5000 });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.plateNumber || !form.brand || !form.model) { toast.warning('请填写完整车辆信息'); return; }
    try {
      setLoading(true);
      await api.vehicles.create({ ...form, lastMaintenanceMileage: form.currentMileage, status: 'idle' });
      toast.success('车辆添加成功');
      onClose();
    } catch (e) { toast.error((e as { message?: string }).message || '添加失败'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">车牌号 *</label><input className="input" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} placeholder="京A·12345" /></div>
        <div><label className="label">品牌 *</label><input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="丰田" /></div>
        <div><label className="label">车型 *</label><input className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="凯美瑞" /></div>
        <div><label className="label">车辆类型</label><select className="input" value={form.carType} onChange={(e) => setForm({ ...form, carType: e.target.value })}>
          <option value="sedan">普通轿车</option><option value="suv">SUV越野车</option><option value="van">商务面包车</option><option value="business">豪华商务车</option>
        </select></div>
        <div><label className="label">座位数</label><input type="number" className="input" value={form.seatingCapacity} onChange={(e) => setForm({ ...form, seatingCapacity: +e.target.value })} min={2} max={50} /></div>
        <div><label className="label">当前里程(km)</label><input type="number" className="input" value={form.currentMileage} onChange={(e) => setForm({ ...form, currentMileage: +e.target.value })} min={0} /></div>
        <div><label className="label">保养间隔(km)</label><input type="number" className="input" value={form.maintenanceInterval} onChange={(e) => setForm({ ...form, maintenanceInterval: +e.target.value })} min={1000} step={1000} /></div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">取消</button>
        <button type="submit" className="btn-primary"><Plus className="w-4 h-4" /> 添加</button>
      </div>
    </form>
  );
}
