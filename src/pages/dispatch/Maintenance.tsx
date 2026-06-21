import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatMoney, carTypeLabel, maintenanceAlertLevelColor } from '../../lib/format.js';
import type { MaintenanceAlert, MaintenanceRecord, Vehicle } from '../../../shared/types.js';
import { Wrench, AlertTriangle, AlertOctagon, CheckCircle2, Plus, Car, X, Gauge, Calendar } from 'lucide-react';

export default function MaintenancePage() {
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [a, r, v] = await Promise.all([
        api.maintenance.alerts(),
        api.maintenance.records(),
        api.vehicles.list(),
      ]);
      setAlerts(a as unknown as MaintenanceAlert[]);
      setRecords(r as unknown as MaintenanceRecord[]);
      setVehicles(v as unknown as Vehicle[]);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const dangerAlerts = alerts.filter((a) => a.alertLevel === 'danger');
  const warningAlerts = alerts.filter((a) => a.alertLevel === 'warning');
  const normalVehicles = vehicles.filter((v) => {
    const distToMaint = v.distanceToMaintenance ?? (v.lastMaintenanceMileage + v.maintenanceInterval - v.currentMileage);
    return distToMaint > 1000;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="kpi-card">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-danger-400 to-danger-600 text-white flex items-center justify-center shadow-md mb-3"><AlertOctagon className="w-6 h-6" /></div>
          <div className="text-3xl font-black text-danger-600">{dangerAlerts.length}</div>
          <div className="text-xs text-slate-500 mt-1">需立即保养</div>
        </div>
        <div className="kpi-card">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-warning-400 to-warning-600 text-white flex items-center justify-center shadow-md mb-3"><AlertTriangle className="w-6 h-6" /></div>
          <div className="text-3xl font-black text-warning-600">{warningAlerts.length}</div>
          <div className="text-xs text-slate-500 mt-1">即将到期</div>
        </div>
        <div className="kpi-card">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-400 to-success-600 text-white flex items-center justify-center shadow-md mb-3"><CheckCircle2 className="w-6 h-6" /></div>
          <div className="text-3xl font-black text-success-600">{normalVehicles.length}</div>
          <div className="text-xs text-slate-500 mt-1">状态良好</div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-warning-500" /> 保养预警车辆
          </h3>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-xs">
            <Plus className="w-4 h-4" /> 登记保养
          </button>
        </div>

        {alerts.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-success-300 mb-3" />
            <p className="text-sm text-slate-400">所有车辆保养状态良好</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>车牌号</th>
                  <th>品牌车型</th>
                  <th>当前里程</th>
                  <th>下次保养里程</th>
                  <th>距离保养</th>
                  <th>预警级别</th>
                  <th>上次保养日期</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a, i) => (
                  <tr key={i}>
                    <td className="font-bold text-primary-900 font-mono">{a.vehicle.plateNumber}</td>
                    <td>{a.vehicle.brand} {a.vehicle.model}</td>
                    <td className="font-mono">{a.currentMileage.toLocaleString()} km</td>
                    <td className="font-mono">{a.nextMaintenanceMileage.toLocaleString()} km</td>
                    <td className="font-mono font-bold">
                      <span className={`tag-pill ${maintenanceAlertLevelColor(a.alertLevel)}`}>
                        {a.distanceToMaintenance.toLocaleString()} km
                      </span>
                    </td>
                    <td><span className={`tag-pill ${maintenanceAlertLevelColor(a.alertLevel)}`}>
                      {a.alertLevel === 'danger' ? '需立即保养' : a.alertLevel === 'warning' ? '即将到期' : '正常'}
                    </span></td>
                    <td className="text-slate-500 text-xs">{a.lastMaintenanceDate || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2">
          <Car className="w-5 h-5 text-primary-600" /> 全部车辆里程概览
        </h3>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>车牌号</th>
                <th>品牌车型</th>
                <th>类型</th>
                <th>当前里程</th>
                <th>上次保养里程</th>
                <th>保养间隔</th>
                <th>距下次保养</th>
                <th>预警级别</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => {
                const distToMaint = v.distanceToMaintenance ?? (v.lastMaintenanceMileage + v.maintenanceInterval - v.currentMileage);
                const alertLevel = v.maintenanceAlertLevel ?? (distToMaint <= 0 ? 'danger' : distToMaint <= 1000 ? 'warning' : 'normal');
                return (
                  <tr key={v.id}>
                    <td className="font-bold text-primary-900 font-mono">{v.plateNumber}</td>
                    <td>{v.brand} {v.model}</td>
                    <td><span className="tag-pill bg-slate-100 text-slate-700">{carTypeLabel[v.carType] || v.carType}</span></td>
                    <td className="font-mono">{v.currentMileage.toLocaleString()} km</td>
                    <td className="font-mono text-slate-500">{v.lastMaintenanceMileage.toLocaleString()} km</td>
                    <td className="font-mono text-slate-500">{v.maintenanceInterval.toLocaleString()} km</td>
                    <td className="font-mono font-bold">
                      <span className={`tag-pill ${maintenanceAlertLevelColor(alertLevel)}`}>
                        {distToMaint.toLocaleString()} km
                      </span>
                    </td>
                    <td><span className={`tag-pill ${maintenanceAlertLevelColor(alertLevel)}`}>
                      {alertLevel === 'danger' ? '需立即保养' : alertLevel === 'warning' ? '即将到期' : '正常'}
                    </span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {records.length > 0 && (
        <div className="card">
          <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-accent-500" /> 保养记录</h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>车牌号</th><th>保养类型</th><th>保养时里程</th><th>费用</th><th>描述</th><th>保养日期</th></tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono font-bold text-primary-900">{r.plateNumber || r.vehicle?.plateNumber || '-'}</td>
                    <td>{r.type}</td>
                    <td className="font-mono">{r.mileageAtService.toLocaleString()} km</td>
                    <td className="font-mono">{formatMoney(r.cost)}</td>
                    <td className="text-xs text-slate-500 max-w-xs truncate">{r.description}</td>
                    <td className="text-slate-500 text-xs">{r.maintenanceDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-primary-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeInUp">
          <div className="bg-white rounded-card shadow-cardHover w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-primary-900 flex items-center gap-2"><Wrench className="w-5 h-5 text-warning-500" /> 登记保养</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-danger-500"><X className="w-5 h-5" /></button>
            </div>
            <AddMaintenanceForm vehicles={vehicles} onClose={() => { setShowAdd(false); load(); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddMaintenanceForm({ vehicles, onClose }: { vehicles: Vehicle[]; onClose: () => void }) {
  const toast = useToast();
  const setLoading = useAppStore((s) => s.setLoading);
  const [form, setForm] = useState({ vehicleId: 0, type: 'routine', cost: 0, description: '', mileageAtService: 0, maintenanceDate: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleId || !form.description || !form.mileageAtService || !form.maintenanceDate) { toast.warning('请填写完整保养信息'); return; }
    try {
      setLoading(true);
      await api.maintenance.createRecord(form);
      toast.success('保养登记成功');
      onClose();
    } catch (e) { toast.error((e as { message?: string }).message || '登记失败'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="p-5 space-y-4">
      <div><label className="label">车辆 *</label><select className="input" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: +e.target.value })}>
        <option value={0}>请选择车辆</option>
        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber} - {v.brand} {v.model}</option>)}
      </select></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">保养类型</label><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="routine">常规保养</option><option value="repair">维修</option><option value="inspection">年检</option><option value="other">其他</option>
        </select></div>
        <div><label className="label">保养费用(元)</label><input type="number" className="input" value={form.cost} onChange={(e) => setForm({ ...form, cost: +e.target.value })} min={0} /></div>
        <div><label className="label">保养时里程(km) *</label><input type="number" className="input" value={form.mileageAtService} onChange={(e) => setForm({ ...form, mileageAtService: +e.target.value })} min={0} /></div>
        <div><label className="label">保养日期 *</label><input type="date" className="input" value={form.maintenanceDate} onChange={(e) => setForm({ ...form, maintenanceDate: e.target.value })} /></div>
      </div>
      <div><label className="label">保养描述 *</label><textarea rows={3} className="input resize-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="请描述保养项目内容" /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">取消</button>
        <button type="submit" className="btn-primary"><Wrench className="w-4 h-4" /> 登记</button>
      </div>
    </form>
  );
}
