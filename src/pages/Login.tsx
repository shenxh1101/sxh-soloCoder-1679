import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Lock, UserPlus, ShieldCheck, CarFront, ClipboardList, Landmark, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAppStore, useToast } from '../store/appStore.js';
import { defaultHomeRoute, roleColor, roleLabel } from '../lib/format.js';
import type { UserRole } from '../../shared/types.js';

const roles: { id: UserRole; label: string; desc: string; icon: JSX.Element }[] = [
  { id: 'employee', label: '员工', desc: '申请用车·查看行程·服务评分', icon: <UserPlus className="w-5 h-5" /> },
  { id: 'supervisor', label: '主管', desc: '审批申请·数据统计·预算管理', icon: <ShieldCheck className="w-5 h-5" /> },
  { id: 'driver', label: '司机', desc: '任务查看·扫码执行·排班管理', icon: <CarFront className="w-5 h-5" /> },
  { id: 'dispatcher', label: '调度员', desc: '车辆管理·智能派车·保养提醒', icon: <ClipboardList className="w-5 h-5" /> },
  { id: 'finance', label: '财务', desc: '账单审核·费用统计·报表导出', icon: <Landmark className="w-5 h-5" /> },
];

const demoAccounts: Record<UserRole, string> = {
  employee: 'zhang_emp', supervisor: 'liu_sup', driver: 'driver_wang',
  dispatcher: 'dispatcher_zheng', finance: 'finance_sun',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAppStore((s) => s.login);
  const user = useAppStore((s) => s.user);
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();

  const [role, setRole] = useState<UserRole>('employee');
  const [username, setUsername] = useState('zhang_emp');
  const [password, setPassword] = useState('123456');
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) navigate(defaultHomeRoute(user.role), { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    setUsername(demoAccounts[role]);
    setPassword('123456');
    setErrors({});
  }, [role]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = '请输入账号';
    if (!password) errs.password = '请输入密码';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    try {
      setLoading(true);
      const res = await api.auth.login({ username: username.trim(), password, role });
      login(res.user, res.token);
      const from = (location.state as { from?: string } | undefined)?.from || defaultHomeRoute(res.user.role);
      toast.success(`欢迎回来，${res.user.name}！`);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      toast.error(e.message || '登录失败');
      setErrors({ submit: e.message || '登录失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700">
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-accent-500 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-primary-500 blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-2xl">
              <CarFront className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">公务车辆调度平台</h1>
              <p className="text-primary-200/80 mt-1 text-sm">Enterprise Vehicle Dispatch System</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 max-w-md space-y-6 animate-stagger">
          <h2 className="text-5xl font-black text-white leading-tight">
            让每一次公务出行<br />
            <span className="bg-gradient-to-r from-accent-300 to-accent-500 bg-clip-text text-transparent">高效 · 透明 · 可控</span>
          </h2>
          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              { n: '5+', t: '角色协同' },
              { n: '60%', t: '派车效率↑' },
              { n: '80%', t: '超支率↓' },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 p-4">
                <div className="text-3xl font-black text-accent-300">{s.n}</div>
                <div className="text-xs text-primary-200 mt-1">{s.t}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-primary-300/60 text-xs">
          © 2026 公务车辆调度平台 · 企业内部系统 v1.0.0
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-[28px] shadow-[0_30px_80px_rgba(15,30,50,0.35)] p-8 animate-fadeInUp">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
                <CarFront className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-black text-primary-800">公务调度平台</h1>
            </div>

            <h2 className="text-2xl font-bold text-primary-900 mb-1">欢迎登录</h2>
            <p className="text-sm text-slate-500 mb-6">请选择角色并输入账号信息</p>

            <div className="mb-6">
              <div className="text-xs font-semibold text-primary-700 mb-2 uppercase tracking-wider">登录角色</div>
              <div className="grid grid-cols-5 gap-2">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`group relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 ${
                      role === r.id
                        ? 'border-primary-500 bg-primary-50 shadow-md'
                        : 'border-slate-100 hover:border-primary-200 hover:bg-primary-50/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${role === r.id ? roleColor[r.id] : 'bg-slate-100 text-slate-500 group-hover:bg-primary-100 group-hover:text-primary-600'}`}>
                      {r.icon}
                    </div>
                    <span className={`text-[11px] font-semibold ${role === r.id ? 'text-primary-700' : 'text-slate-500'}`}>{r.label}</span>
                  </button>
                ))}
              </div>
              <div className={`mt-2 p-2.5 rounded-lg text-xs ${roleColor[role]} bg-opacity-20`}>
                <span className="font-semibold">{roleLabel[role]}：</span>
                {roles.find((r) => r.id === role)?.desc}
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">账号</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入账号"
                    className={`input pl-10 ${errors.username ? 'input-error' : ''}`}
                  />
                </div>
                {errors.username && <p className="mt-1 text-xs text-danger-500">{errors.username}</p>}
              </div>

              <div>
                <label className="label">密码</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className={`input pl-10 pr-10 ${errors.password ? 'input-error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-600"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-danger-500">{errors.password}</p>}
              </div>

              {errors.submit && (
                <div className="p-3 rounded-lg bg-danger-50 border border-danger-200 text-sm text-danger-600">
                  {errors.submit}
                </div>
              )}

              <button type="submit" className="btn-primary w-full h-11 text-base font-semibold">
                立即登录
              </button>

              <div className="pt-3 p-3 rounded-xl bg-primary-50/60 border border-primary-100">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-white text-primary-700 font-semibold">演示账号</span>
                  <span className="text-primary-700">已自动填充 · 密码均为 <code className="bg-white px-1.5 py-0.5 rounded font-mono text-[11px]">123456</code></span>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
