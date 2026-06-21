import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { Star, Send, ThumbsUp, ShieldCheck, MapPin, Car } from 'lucide-react';

const categories = [
  { key: 'punctuality', label: '准时率', desc: '司机是否按时到达' },
  { key: 'safety', label: '安全性', desc: '驾驶平稳、遵守交规' },
  { key: 'service', label: '服务态度', desc: '言行礼貌、主动服务' },
  { key: 'vehicleCondition', label: '车辆状况', desc: '车内整洁、车况良好' },
];

export default function RatingPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [form, setForm] = useState<Record<string, number>>({ punctuality: 5, safety: 5, service: 5, vehicleCondition: 5 });
  const [comment, setComment] = useState('');

  const overall = +(categories.reduce((s, c) => s + form[c.key], 0) / categories.length).toFixed(2);

  const handleStar = (key: string, v: number) => setForm((f) => ({ ...f, [key]: v }));

  const submit = async () => {
    if (!tripId) return;
    try {
      setLoading(true);
      await api.ratings.create({ tripId: +tripId, ...form, comment });
      toast.success('评价提交成功，感谢您的反馈！');
      setTimeout(() => navigate(-1), 800);
    } catch (e) { toast.error((e as { message?: string }).message || '提交失败'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="text-xs text-accent-600 hover:underline">← 返回</button>
      <div className="card">
        <div className="text-center py-6 border-b border-slate-100 mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-warning-400 to-warning-600 flex items-center justify-center shadow-lg shadow-warning-500/30">
            <ThumbsUp className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black text-primary-900 mb-1">服务评价</h2>
          <p className="text-sm text-slate-500">您的反馈是我们提升服务的动力</p>
          <div className="mt-6 flex items-center justify-center gap-1 text-warning-500 text-3xl font-bold">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`w-10 h-10 transition-all ${i < Math.round(overall) ? 'fill-warning-400 drop-shadow-md' : 'text-slate-200'}`} />
            ))}
            <span className="ml-3">{overall.toFixed(2)} 分</span>
          </div>
        </div>

        <div className="space-y-5">
          {categories.map((c, idx) => (
            <div key={c.key} className="animate-fadeInUp" style={{ animationDelay: `${idx * 60}ms` }}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <div className="text-sm font-semibold text-primary-800">{c.label}</div>
                  <div className="text-xs text-slate-500">{c.desc}</div>
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} onClick={() => handleStar(c.key, v)} className="p-1 transition-transform hover:scale-110">
                      <Star className={`w-6 h-6 transition-all ${v <= form[c.key] ? 'fill-warning-400 text-warning-500' : 'text-slate-200 hover:text-warning-300'}`} />
                    </button>
                  ))}
                  <span className="ml-2 w-8 text-right text-sm font-bold text-warning-600">{form[c.key]}.0</span>
                </div>
              </div>
              <div className="progress-bar"><div className="progress-fill bg-warning-400" style={{ width: `${(form[c.key] / 5) * 100}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <label className="label flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-slate-400" /> 文字评价 <span className="text-xs text-slate-400 font-normal">（选填）</span></label>
          <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="请分享您的乘车体验，或告诉我们可以改进的地方..." className="input resize-none" />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 pt-6 border-t border-slate-100">
          <div className="p-3 rounded-xl bg-primary-50/60 flex items-center gap-3">
            <Car className="w-5 h-5 text-primary-500" />
            <div>
              <div className="text-[10px] text-slate-500">行程编号</div>
              <div className="text-sm font-bold text-primary-800 font-mono">#{tripId}</div>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-accent-500/10 flex items-center gap-3">
            <MapPin className="w-5 h-5 text-accent-500" />
            <div>
              <div className="text-[10px] text-slate-500">综合评分</div>
              <div className="text-sm font-bold text-accent-700">{overall.toFixed(2)} / 5.00</div>
            </div>
          </div>
        </div>

        <button onClick={submit} className="btn-primary w-full mt-8 h-12 text-base font-semibold">
          <Send className="w-5 h-5" /> 提交评价
        </button>
      </div>
    </div>
  );
}
