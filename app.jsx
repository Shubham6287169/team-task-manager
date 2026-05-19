const { useState, useEffect, useCallback, useRef, createContext, useContext } = React;

const API = '';
const AuthCtx = createContext(null);

// ── API helpers ──────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('tt_token');
  const res = await fetch(API + '/api' + path, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...opts.headers },
    ...opts,
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.detail || data.error || data.errors?.[0]?.msg || 'Request failed';
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

// ── Tiny UI components ───────────────────────────────────────────
const Spinner = ({ size=16 }) => (
  <span style={{ display:'inline-block', width:size, height:size, border:`2px solid var(--border)`, borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
);

const Badge = ({ label, color='default' }) => {
  const colors = {
    default: { bg:'var(--surface3)', col:'var(--text-2)' },
    accent: { bg:'var(--accent-dim)', col:'var(--accent)' },
    blue: { bg:'var(--accent2-dim)', col:'var(--accent2)' },
    red: { bg:'var(--danger-dim)', col:'var(--danger)' },
    green: { bg:'var(--success-dim)', col:'var(--success)' },
    purple: { bg:'var(--purple-dim)', col:'var(--purple)' },
  };
  const c = colors[color] || colors.default;
  return <span style={{ background:c.bg, color:c.col, borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700, letterSpacing:'.04em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{label}</span>;
};

function statusBadge(s) {
  const map = { todo:['Todo','default'], in_progress:['In Progress','blue'], review:['Review','purple'], done:['Done','green'] };
  const [label, color] = map[s] || [s, 'default'];
  return <Badge label={label} color={color} />;
}
function priorityBadge(p) {
  const map = { low:['Low','default'], medium:['Medium','accent'], high:['High','red'], critical:['Critical','red'] };
  const [label, color] = map[p] || [p, 'default'];
  return <Badge label={label} color={color} />;
}

const Avatar = ({ name='?', size=32 }) => {
  const colors = ['#f59e0b','#38bdf8','#a78bfa','#22c55e','#ef4444','#f97316'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  const initials = (name || '').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  return <span style={{ width:size, height:size, borderRadius:'50%', background:color, color:'#000', fontWeight:700, fontSize:size*.38, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:'Space Mono' }}>{initials}</span>;
};

const Btn = ({ children, onClick, variant='primary', size='md', disabled, loading, style={} }) => {
  const base = { display:'inline-flex', alignItems:'center', gap:6, borderRadius:8, border:'none', fontWeight:600, cursor:disabled||loading?'not-allowed':'pointer', transition:'all .15s', fontFamily:'inherit', ...style };
  const sizes = { sm:{ padding:'5px 12px', fontSize:12 }, md:{ padding:'8px 18px', fontSize:14 }, lg:{ padding:'12px 24px', fontSize:15 } };
  const variants = {
    primary: { background:'var(--accent)', color:'#000' },
    secondary: { background:'var(--surface3)', color:'var(--text)', border:'1px solid var(--border)' },
    danger: { background:'var(--danger-dim)', color:'var(--danger)', border:'1px solid var(--danger)' },
    ghost: { background:'transparent', color:'var(--text-2)', border:'1px solid var(--border)' },
  };
  return (
    <button onClick={onClick} disabled={disabled||loading} style={{ ...base, ...sizes[size], ...variants[variant], borderRadius:8, opacity:disabled?0.5:1 }}>
      {loading ? <Spinner size={14} /> : children}
    </button>
  );
};

const Card = ({ children, style={} }) => (
  <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:20, ...style }}>
    {children}
  </div>
);

const Modal = ({ open, onClose, title, children, width=520 }) => {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20, backdropFilter:'blur(4px)' }}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:width, maxHeight:'90vh', overflow:'auto', animation:'fadeIn .2s ease' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
          <span style={{ fontWeight:700, fontSize:16 }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-2)', fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  );
};

const Field = ({ label, children, error }) => (
  <div style={{ marginBottom:16 }}>
    {label && <label>{label}</label>}
    {children}
    {error && <div style={{ color:'var(--danger)', fontSize:12, marginTop:4 }}>{error}</div>}
  </div>
);

const Toast = ({ msg, type='info', onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return ()=>clearTimeout(t); }, []);
  const colors = { info:'var(--accent2)', success:'var(--success)', error:'var(--danger)' };
  return (
    <div style={{ position:'fixed', bottom:24, right:24, background:'var(--surface2)', border:`1px solid ${colors[type]}`, borderRadius:10, padding:'12px 20px', display:'flex', alignItems:'center', gap:10, zIndex:9999, animation:'fadeIn .2s ease', minWidth:240, boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
      <span style={{ color:colors[type], fontSize:18 }}>{type==='error'?'✕':type==='success'?'✓':'ℹ'}</span>
      <span style={{ flex:1, fontSize:14 }}>{msg}</span>
      <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer' }}>×</button>
    </div>
  );
};

// ── Auth Provider ─────────────────────────────────────────────────
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type='info') => setToast({ msg, type, id: Date.now() });

  useEffect(() => {
    const token = localStorage.getItem('tt_token');
    if (token) {
      apiFetch('/auth/me').then(u => { setUser(u); setLoading(false); }).catch(() => { localStorage.removeItem('tt_token'); setLoading(false); });
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { token, user } = await apiFetch('/auth/login', { method:'POST', body:{ email, password } });
    localStorage.setItem('tt_token', token);
    setUser(user);
    showToast(`Welcome back, ${user.name}!`, 'success');
  };

  const signup = async (name, email, password, role) => {
    const { token, user } = await apiFetch('/auth/signup', { method:'POST', body:{ name, email, password, role } });
    localStorage.setItem('tt_token', token);
    setUser(user);
    showToast(`Welcome, ${user.name}!`, 'success');
  };

  const logout = () => {
    localStorage.removeItem('tt_token');
    setUser(null);
    showToast('Logged out successfully.');
  };

  return (
    <AuthCtx.Provider value={{ user, login, signup, logout, showToast }}>
      {loading ? <LoadingScreen /> : children}
      {toast && <Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
    </AuthCtx.Provider>
  );
}

const useAuth = () => useContext(AuthCtx);

const LoadingScreen = () => (
  <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
    <div style={{ fontFamily:'Space Mono', fontSize:22, color:'var(--accent)', letterSpacing:2 }}>TEAM TASK</div>
    <Spinner size={24} />
  </div>
);

// ── Auth Pages ────────────────────────────────────────────────────
function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'member' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, signup } = useAuth();

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (mode==='login') await login(form.email, form.password);
      else await signup(form.name, form.email, form.password, form.role);
    } catch(err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:20 }}>
      <div style={{ position:'fixed', inset:0, backgroundImage:'radial-gradient(ellipse at 20% 50%, rgba(245,158,11,0.05) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(56,189,248,0.05) 0%, transparent 60%)', pointerEvents:'none' }} />
      <div style={{ width:'100%', maxWidth:420, animation:'fadeIn .3s ease' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontFamily:'Space Mono', fontSize:28, fontWeight:700, color:'var(--accent)', letterSpacing:3 }}>TEAM TASK</div>
          <div style={{ color:'var(--text-2)', marginTop:6, fontSize:13 }}>Project & Task Management Platform</div>
        </div>
        <Card style={{ padding:28 }}>
          <div style={{ display:'flex', background:'var(--surface2)', borderRadius:8, padding:3, marginBottom:24, gap:3 }}>
            {['login','signup'].map(m => (
              <button key={m} onClick={()=>setMode(m)} style={{ flex:1, padding:'8px 0', borderRadius:6, border:'none', background:mode===m?'var(--surface3)':'transparent', color:mode===m?'var(--text)':'var(--text-2)', fontWeight:600, fontSize:14, cursor:'pointer', transition:'all .15s', textTransform:'capitalize' }}>{m==='login'?'Sign In':'Sign Up'}</button>
            ))}
          </div>
          {error && <div style={{ background:'var(--danger-dim)', border:'1px solid var(--danger)', color:'var(--danger)', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13 }}>{error}</div>}
          <form onSubmit={submit}>
            {mode==='signup' && (
              <Field label="Full Name">
                <input value={form.name} onChange={set('name')} placeholder="John Doe" required />
              </Field>
            )}
            <Field label="Email Address">
              <input type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" required />
            </Field>
            <Field label="Password">
              <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required minLength={6} />
            </Field>
            {mode==='signup' && (
              <Field label="Account Role">
                <select value={form.role} onChange={set('role')}>
                  <option value="member">Member — Join and contribute to projects</option>
                  <option value="admin">Admin — Full access to all projects</option>
                </select>
              </Field>
            )}
            <Btn loading={loading} style={{ width:'100%', justifyContent:'center', marginTop:8 }}>
              {mode==='login' ? 'Sign In' : 'Create Account'}
            </Btn>
          </form>
          <div style={{ textAlign:'center', marginTop:18, color:'var(--text-2)', fontSize:13 }}>
            {mode==='login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');}} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontWeight:600 }}>
              {mode==='login' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Sidebar / Shell ───────────────────────────────────────────────
const NAV = [
  { id:'dashboard', label:'Dashboard', icon:'◈' },
  { id:'projects', label:'Projects', icon:'⬡' },
  { id:'tasks', label:'My Tasks', icon:'◎' },
  { id:'settings', label:'Settings', icon:'⚙' },
];

function Shell({ children, page, setPage }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const W = collapsed ? 64 : 220;

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      {/* Sidebar */}
      <aside style={{ width:W, flexShrink:0, background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', transition:'width .2s', overflow:'hidden' }}>
        <div style={{ padding:'16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, minHeight:60 }}>
          <span style={{ fontFamily:'Space Mono', fontSize:16, fontWeight:700, color:'var(--accent)', flexShrink:0 }}>TT</span>
          {!collapsed && <span style={{ fontFamily:'Space Mono', fontSize:13, color:'var(--text)', whiteSpace:'nowrap', fontWeight:700, letterSpacing:1 }}>TEAM TASK</span>}
          <button onClick={()=>setCollapsed(c=>!c)} style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:16, flexShrink:0 }}>
            {collapsed ? '▶' : '◀'}
          </button>
        </div>
        <nav style={{ flex:1, padding:'12px 8px', display:'flex', flexDirection:'column', gap:2 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={()=>setPage(n.id)} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, border:'none', background:page===n.id?'var(--accent-dim)':'transparent', color:page===n.id?'var(--accent)':'var(--text-2)', cursor:'pointer', textAlign:'left', width:'100%', transition:'all .1s', fontWeight:page===n.id?600:400 }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{n.icon}</span>
              {!collapsed && <span style={{ whiteSpace:'nowrap', fontSize:14 }}>{n.label}</span>}
            </button>
          ))}
        </nav>
        <div style={{ padding:'12px 8px', borderTop:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px' }}>
            <Avatar name={user.name} size={28} />
            {!collapsed && (
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user.name}</div>
                <div style={{ fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em' }}>{user.role}</div>
              </div>
            )}
          </div>
          <button onClick={logout} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, border:'none', background:'transparent', color:'var(--text-3)', cursor:'pointer', width:'100%', marginTop:4 }}>
            <span style={{ fontSize:16, flexShrink:0 }}>⏏</span>
            {!collapsed && <span style={{ fontSize:13 }}>Sign Out</span>}
          </button>
        </div>
      </aside>
      {/* Main */}
      <main style={{ flex:1, overflow:'auto', background:'var(--bg)' }}>{children}</main>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────
function Dashboard({ setPage, setProjectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    apiFetch('/tasks/dashboard').then(setData).catch(console.error).finally(()=>setLoading(false));
  }, []);

  if (loading) return <div style={{ padding:40, display:'flex', justifyContent:'center' }}><Spinner size={32} /></div>;
  if (!data) return null;

  const byStatus = Object.fromEntries((data.by_status||[]).map(b=>[b.status,b.count]));
  const statusGroups = [
    { label:'To Do', key:'todo', color:'var(--text-2)', icon:'○' },
    { label:'In Progress', key:'in_progress', color:'var(--accent2)', icon:'◑' },
    { label:'Review', key:'review', color:'var(--purple)', icon:'◎' },
    { label:'Done', key:'done', color:'var(--success)', icon:'●' },
  ];

  return (
    <div style={{ padding:28, maxWidth:1200, margin:'0 auto' }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700 }}>Good {new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening'}, {user.name.split(' ')[0]} 👋</h1>
        <p style={{ color:'var(--text-2)', marginTop:4, fontSize:14 }}>Here's what's happening across your projects.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Tasks', value:data.total_tasks, icon:'◉', color:'var(--accent2)' },
          { label:'Overdue', value:data.overdue_tasks, icon:'⚠', color:'var(--danger)' },
          { label:'Active Projects', value:data.project_count, icon:'⬡', color:'var(--accent)' },
          { label:'Completed', value:byStatus.done||0, icon:'✓', color:'var(--success)' },
        ].map(s => (
          <Card key={s.label} style={{ padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ color:'var(--text-2)', fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em' }}>{s.label}</span>
              <span style={{ color:s.color, fontSize:18 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize:32, fontWeight:700, fontFamily:'Space Mono', color:s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Status breakdown */}
        <Card>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'.06em' }}>Status Breakdown</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {statusGroups.map(g => {
              const count = byStatus[g.key] || 0;
              const pct = data.total_tasks ? Math.round(count/data.total_tasks*100) : 0;
              return (
                <div key={g.key}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:13 }}>{g.label}</span>
                    <span style={{ fontFamily:'Space Mono', fontSize:12, color:'var(--text-2)' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height:6, background:'var(--surface3)', borderRadius:3 }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:g.color, borderRadius:3, transition:'width .5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent activity */}
        <Card>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'.06em' }}>Recent Activity</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10, maxHeight:200, overflow:'auto' }}>
            {(data.recent_activity||[]).slice(0,8).map(a => (
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Avatar name={a.user_name||'?'} size={24} />
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ fontSize:12, color:'var(--text-2)' }}>
                    <strong style={{ color:'var(--text)' }}>{a.user_name||'System'}</strong> {a.action.replace(/_/g,' ')}
                  </span>
                </div>
                <span style={{ fontSize:11, color:'var(--text-3)', flexShrink:0 }}>{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
            ))}
            {!(data.recent_activity||[]).length && <span style={{ color:'var(--text-3)', fontSize:13 }}>No activity yet.</span>}
          </div>
        </Card>
      </div>

      {/* My Tasks */}
      <Card>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'.06em' }}>My Open Tasks</h3>
          <Btn size="sm" variant="ghost" onClick={()=>setPage('tasks')}>View All</Btn>
        </div>
        {(data.my_tasks||[]).length === 0 ? (
          <div style={{ color:'var(--text-3)', fontSize:14, textAlign:'center', padding:'20px 0' }}>🎉 No open tasks assigned to you.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {data.my_tasks.map(t => (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.title}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)' }}>{t.project_name}</div>
                </div>
                {priorityBadge(t.priority)}
                {statusBadge(t.status)}
                {t.due_date && <span style={{ fontSize:12, color: new Date(t.due_date)<new Date()?'var(--danger)':'var(--text-2)', fontFamily:'Space Mono', flexShrink:0 }}>{t.due_date}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Projects Page ─────────────────────────────────────────────────
function ProjectsPage({ onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name:'', description:'', deadline:'' });
  const [saving, setSaving] = useState(false);
  const [quickAddMemberProject, setQuickAddMemberProject] = useState(null);
  const [memberForm, setMemberForm] = useState({ user_id:'', role:'member' });
  const { user, showToast } = useAuth();
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const load = () => {
    Promise.all([
      apiFetch('/projects'),
      user.role === 'admin' ? apiFetch('/auth/users').catch(()=>[]) : Promise.resolve([])
    ]).then(([p, u]) => { setProjects(p); setAllUsers(u); }).finally(()=>setLoading(false));
  };
  useEffect(()=>{ load(); }, []);

  const createProject = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch('/projects', { method:'POST', body:form });
      showToast('Project created!', 'success');
      setShowCreate(false); setForm({ name:'', description:'', deadline:'' }); load();
    } catch(err) { showToast(err.message, 'error'); } finally { setSaving(false); }
  };

  const deleteProject = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    try { await apiFetch(`/projects/${id}`, { method:'DELETE' }); load(); showToast('Project deleted.'); }
    catch(err) { showToast(err.message, 'error'); }
  };

  const assignProjectOwner = async (e, projectId, ownerId) => {
    e.stopPropagation();
    try { await apiFetch(`/projects/${projectId}`, { method:'PUT', body:{ owner_id: Number(ownerId) } }); load(); showToast('Project owner assigned.'); }
    catch(err) { showToast(err.message, 'error'); }
  };

  const submitQuickAddMember = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch(`/projects/${quickAddMemberProject}/members`, { method:'POST', body:memberForm });
      showToast('Member added!', 'success'); setQuickAddMemberProject(null); load();
    } catch(err) { showToast(err.message, 'error'); } finally { setSaving(false); }
  };

  const statusColor = s => ({ active:'var(--success)', archived:'var(--text-3)', completed:'var(--accent2)' }[s] || 'var(--text-2)');

  if (loading) return <div style={{ padding:40, display:'flex', justifyContent:'center' }}><Spinner size={32} /></div>;

  return (
    <div style={{ padding:28, maxWidth:1100 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700 }}>Projects</h1>
          <p style={{ color:'var(--text-2)', marginTop:4, fontSize:14 }}>{projects.length} project{projects.length!==1?'s':''}</p>
        </div>
        <Btn onClick={()=>setShowCreate(true)}>＋ New Project</Btn>
      </div>

      {projects.length===0 ? (
        <Card style={{ textAlign:'center', padding:60 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>⬡</div>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>No projects yet</div>
          <div style={{ color:'var(--text-2)', marginBottom:20 }}>Create your first project to get started.</div>
          <Btn onClick={()=>setShowCreate(true)}>＋ Create Project</Btn>
        </Card>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:16 }}>
          {projects.map(p => {
            const pct = p.total_tasks ? Math.round(p.done_tasks/p.total_tasks*100) : 0;
            const isOverdue = p.deadline && new Date(p.deadline) < new Date(new Date().setHours(0,0,0,0)) && p.status !== 'completed';
            return (
              <Card key={p.id} style={{ cursor:'pointer', transition:'border-color .15s, transform .15s', ':hover':{ borderColor:'var(--accent)' } }} onClick={()=>onOpenProject(p.id)}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                      <div style={{ fontSize:16, fontWeight:700 }}>{p.name}</div>
                      {isOverdue && <Badge label="Overdue" color="red" />}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-3)', display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:statusColor(p.status), display:'inline-block' }} />
                      <span style={{ textTransform:'capitalize' }}>{p.status}</span>
                    </div>
                  </div>
                  <Badge label={p.my_role||'admin'} color={p.my_role==='admin'?'accent':'default'} />
                </div>
                {p.description && <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:14, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.description}</p>}
                
                {user.role === 'admin' && (
                  <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }} onClick={e=>e.stopPropagation()}>
                    <select value={p.owner_id} onChange={e=>assignProjectOwner(e, p.id, e.target.value)} style={{ padding:'2px 4px', fontSize:11, borderRadius:4, border:'1px solid var(--border)', background:'var(--surface3)' }}>
                      <option disabled>Assign Project to:</option>
                      {allUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <button onClick={e=>{e.stopPropagation(); setQuickAddMemberProject(p.id); setMemberForm({ user_id:'', role:'member' });}} style={{ padding:'2px 8px', fontSize:11, borderRadius:4, border:'1px solid var(--border)', background:'var(--surface3)', cursor:'pointer' }}>＋ Manage Members</button>
                    <button onClick={e=>deleteProject(e, p.id)} style={{ padding:'2px 8px', fontSize:11, borderRadius:4, border:'1px solid var(--danger)', background:'transparent', color:'var(--danger)', cursor:'pointer', marginLeft:'auto' }}>✕ Delete</button>
                  </div>
                )}

                <div style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12, color:'var(--text-2)' }}>
                    <span>Progress</span>
                    <span style={{ fontFamily:'Space Mono' }}>{p.done_tasks}/{p.total_tasks} tasks</span>
                  </div>
                  <div style={{ height:4, background:'var(--surface3)', borderRadius:2 }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:pct===100?'var(--success)':'var(--accent)', borderRadius:2, transition:'width .5s' }} />
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12, color:'var(--text-3)' }}>
                  <span>👥 {p.member_count} member{p.member_count!==1?'s':''}</span>
                  {p.overdue_tasks>0 && <span style={{ color:'var(--danger)' }}>⚠ {p.overdue_tasks} overdue</span>}
                  {p.deadline && <span>📅 {p.deadline}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showCreate} onClose={()=>setShowCreate(false)} title="Create New Project">
        <form onSubmit={createProject}>
          <Field label="Project Name *"><input value={form.name} onChange={set('name')} placeholder="e.g. Website Redesign" required /></Field>
          <Field label="Description"><textarea value={form.description} onChange={set('description')} placeholder="What is this project about?" rows={3} style={{ resize:'vertical' }} /></Field>
          <Field label="Deadline"><input type="date" value={form.deadline} onChange={set('deadline')} /></Field>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
            <Btn variant="ghost" onClick={()=>setShowCreate(false)}>Cancel</Btn>
            <Btn loading={saving}>Create Project</Btn>
          </div>
        </form>
      </Modal>

      {/* Quick Add Member Modal */}
      <Modal open={!!quickAddMemberProject} onClose={()=>setQuickAddMemberProject(null)} title="Manage Project Member">
        <form onSubmit={submitQuickAddMember}>
          <Field label="Select User">
            <select value={memberForm.user_id} onChange={e=>setMemberForm(f=>({...f,user_id:e.target.value}))} required>
              <option value="">-- Choose User --</option>
              {allUsers.map(u=><option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </Field>
          <Field label="Role">
            <select value={memberForm.role} onChange={e=>setMemberForm(f=>({...f,role:e.target.value}))}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <Btn variant="ghost" type="button" onClick={()=>setQuickAddMemberProject(null)}>Cancel</Btn>
            <Btn loading={saving}>Add Member</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── Project Detail ────────────────────────────────────────────────
function ProjectDetail({ projectId, onBack }) {
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tasks');
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState({ name:'', description:'', status:'', deadline:'' });
  const [taskForm, setTaskForm] = useState({ title:'', description:'', assignee_id:'', priority:'medium', status:'todo', due_date:'' });
  const [memberForm, setMemberForm] = useState({ user_id:'', role:'member' });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const { user, showToast } = useAuth();

  const load = async () => {
    try {
      const [proj, taskList, users] = await Promise.all([
        apiFetch(`/projects/${projectId}`),
        apiFetch(`/tasks?project_id=${projectId}`),
        apiFetch('/auth/users'),
      ]);
      setProject(proj); setTasks(taskList); setAllUsers(users);
      setEditProjectForm({ name:proj.name, description:proj.description||'', status:proj.status, deadline:proj.deadline||'' });
    } catch(e) { showToast(e.message, 'error'); } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, [projectId]);

  const canManage = project && (user.role==='admin' || project.my_role==='admin');

  const createTask = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch('/tasks', { method:'POST', body:{ ...taskForm, project_id:projectId, assignee_id:taskForm.assignee_id||undefined } });
      showToast('Task created!', 'success'); setShowAddTask(false);
      setTaskForm({ title:'', description:'', assignee_id:'', priority:'medium', status:'todo', due_date:'' }); load();
    } catch(e) { showToast(e.message, 'error'); } finally { setSaving(false); }
  };

  const addMember = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch(`/projects/${projectId}/members`, { method:'POST', body:memberForm });
      showToast('Member added!', 'success'); setShowAddMember(false); load();
    } catch(e) { showToast(e.message, 'error'); } finally { setSaving(false); }
  };

  const removeMember = async uid => {
    if (!confirm('Remove this member?')) return;
    try { await apiFetch(`/projects/${projectId}/members/${uid}`, { method:'DELETE' }); load(); showToast('Member removed.'); }
    catch(e) { showToast(e.message, 'error'); }
  };

  const updateTaskStatus = async (taskId, status) => {
    try { await apiFetch(`/tasks/${taskId}`, { method:'PUT', body:{ status } }); load(); }
    catch(e) { showToast(e.message, 'error'); }
  };

  const updateTaskAssignee = async (taskId, assignee_id) => {
    try { await apiFetch(`/tasks/${taskId}`, { method:'PUT', body:{ assignee_id: assignee_id ? Number(assignee_id) : null } }); load(); }
    catch(e) { showToast(e.message, 'error'); }
  };

  const deleteTask = async id => {
    if (!confirm('Delete this task?')) return;
    try { await apiFetch(`/tasks/${id}`, { method:'DELETE' }); load(); showToast('Task deleted.'); }
    catch(e) { showToast(e.message, 'error'); }
  };

  const updateProject = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch(`/projects/${projectId}`, { method:'PUT', body:editProjectForm });
      showToast('Project updated!', 'success'); setShowEditProject(false); load();
    } catch(e) { showToast(e.message, 'error'); } finally { setSaving(false); }
  };

  const deleteProject = async () => {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) return;
    try { await apiFetch(`/projects/${projectId}`, { method:'DELETE' }); onBack(); showToast('Project deleted.'); }
    catch(e) { showToast(e.message, 'error'); }
  };

  const setTf = k => e => setTaskForm(f=>({...f,[k]:e.target.value}));
  const setMf = k => e => setMemberForm(f=>({...f,[k]:e.target.value}));
  const setEpf = k => e => setEditProjectForm(f=>({...f,[k]:e.target.value}));

  const filteredTasks = tasks.filter(t =>
    (!filterStatus || t.status===filterStatus) &&
    (!filterPriority || t.priority===filterPriority)
  );

  const nonMembers = allUsers.filter(u => !project?.members?.find(m=>m.id===u.id));

  if (loading) return <div style={{ padding:40, display:'flex', justifyContent:'center' }}><Spinner size={32} /></div>;
  if (!project) return null;

  const pct = project.total_tasks ? Math.round(project.done_tasks/project.total_tasks*100) : 0;
  const COLUMNS = ['todo','in_progress','review','done'];
  const isOverdue = project.deadline && new Date(project.deadline) < new Date(new Date().setHours(0,0,0,0)) && project.status !== 'completed';

  return (
    <div style={{ padding:28, maxWidth:1200 }}>
      <div style={{ marginBottom:20 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'var(--text-2)', cursor:'pointer', fontSize:13, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>← Back to Projects</button>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
              <h1 style={{ fontSize:24, fontWeight:700 }}>{project.name}</h1>
              {isOverdue && <Badge label="Overdue" color="red" />}
            </div>
            {project.description && <p style={{ color:'var(--text-2)', fontSize:14 }}>{project.description}</p>}
          </div>
          <div style={{ display:'flex', gap:10, flexShrink:0 }}>
            {canManage && <Btn size="sm" variant="danger" onClick={deleteProject}>Delete Project</Btn>}
            {canManage && <Btn size="sm" variant="secondary" onClick={()=>setShowAddMember(true)}>＋ Assign Member</Btn>}
            {canManage && <Btn size="sm" variant="ghost" onClick={()=>setShowEditProject(true)}>✎ Edit</Btn>}
            <Btn size="sm" onClick={()=>setShowAddTask(true)}>＋ Task</Btn>
          </div>
        </div>

        <div style={{ display:'flex', gap:20, marginTop:14, flexWrap:'wrap' }}>
          {[
            { label:'Total', value:project.total_tasks, color:'var(--text-2)' },
            { label:'Done', value:project.done_tasks, color:'var(--success)' },
            { label:'Overdue', value:project.overdue_tasks, color:'var(--danger)' },
            { label:'Members', value:project.member_count, color:'var(--accent2)' },
          ].map(s=>(
            <div key={s.label} style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'Space Mono', fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em' }}>{s.label}</div>
            </div>
          ))}
          <div style={{ flex:1, minWidth:200, display:'flex', flexDirection:'column', justifyContent:'center' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5, color:'var(--text-2)' }}>
              <span>Progress</span><span style={{ fontFamily:'Space Mono' }}>{pct}%</span>
            </div>
            <div style={{ height:6, background:'var(--surface3)', borderRadius:3 }}>
              <div style={{ width:`${pct}%`, height:'100%', background:pct===100?'var(--success)':'var(--accent)', borderRadius:3, transition:'width .5s' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, borderBottom:'1px solid var(--border)', marginBottom:20 }}>
        {['tasks','board','members'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:'8px 18px', border:'none', background:'none', color:tab===t?'var(--accent)':'var(--text-2)', borderBottom:`2px solid ${tab===t?'var(--accent)':'transparent'}`, cursor:'pointer', fontWeight:600, fontSize:14, textTransform:'capitalize', marginBottom:-1 }}>{t}</button>
        ))}
      </div>

      {/* Filters */}
      {(tab==='tasks'||tab==='board') && (
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ width:'auto' }}>
            <option value="">All Status</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
          <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={{ width:'auto' }}>
            <option value="">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      )}

      {/* Tasks list */}
      {tab==='tasks' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filteredTasks.length===0 && <div style={{ textAlign:'center', color:'var(--text-3)', padding:40 }}>No tasks found. Create one!</div>}
          {filteredTasks.map(t => (
            <Card key={t.id} style={{ padding:'12px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <select value={t.status} onChange={e=>updateTaskStatus(t.id, e.target.value)} style={{ width:'auto', background:'var(--surface3)', border:'1px solid var(--border)', borderRadius:6, padding:'4px 8px', fontSize:12, cursor:'pointer' }}>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:14, opacity:t.status==='done'?0.5:1, textDecoration:t.status==='done'?'line-through':'none' }}>{t.title}</div>
                  {t.description && <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.description}</div>}
                </div>
                {priorityBadge(t.priority)}
                {canManage ? (
                  <select value={t.assignee_id || ''} onChange={e=>updateTaskAssignee(t.id, e.target.value)} style={{ width:'auto', background:'var(--surface3)', border:'1px solid var(--border)', borderRadius:6, padding:'4px 8px', fontSize:12, cursor:'pointer' }}>
                    <option value="">Unassigned</option>
                    {(project.members||[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                ) : (
                  t.assignee_name ? (
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                      <Avatar name={t.assignee_name} size={22} />
                      <span style={{ fontSize:12, color:'var(--text-2)' }}>{t.assignee_name}</span>
                    </div>
                  ) : <span style={{ fontSize:12, color:'var(--text-3)', flexShrink:0 }}>Unassigned</span>
                )}
                {t.due_date && <span style={{ fontSize:12, fontFamily:'Space Mono', color:new Date(t.due_date)<new Date()&&t.status!=='done'?'var(--danger)':'var(--text-2)', flexShrink:0 }}>{t.due_date}</span>}
                {(canManage || t.creator_id===user.id) && (
                  <button onClick={()=>deleteTask(t.id)} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:16, flexShrink:0, ':hover':{ color:'var(--danger)' } }}>✕</button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Kanban board */}
      {tab==='board' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, overflowX:'auto' }}>
          {COLUMNS.map(col => {
            const colTasks = filteredTasks.filter(t=>t.status===col);
            const colLabels = { todo:'To Do', in_progress:'In Progress', review:'Review', done:'Done' };
            const colColors = { todo:'var(--text-3)', in_progress:'var(--accent2)', review:'var(--purple)', done:'var(--success)' };
            return (
              <div key={col}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, padding:'0 4px' }}>
                  <span style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:colColors[col] }}>{colLabels[col]}</span>
                  <span style={{ fontFamily:'Space Mono', fontSize:12, color:'var(--text-3)', background:'var(--surface3)', borderRadius:10, padding:'1px 8px' }}>{colTasks.length}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, minHeight:100 }}>
                  {colTasks.map(t=>(
                    <div key={t.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', cursor:'default' }}>
                      <div style={{ fontWeight:600, fontSize:13, marginBottom:6, lineHeight:1.4 }}>{t.title}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        {priorityBadge(t.priority)}
                        {canManage ? (
                          <select value={t.assignee_id || ''} onChange={e=>updateTaskAssignee(t.id, e.target.value)} style={{ width:'auto', background:'var(--surface3)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 4px', fontSize:11, cursor:'pointer' }}>
                            <option value="">Unassigned</option>
                            {(project.members||[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        ) : (
                          t.assignee_name && <div style={{ display:'flex', alignItems:'center', gap:4 }}><Avatar name={t.assignee_name} size={18}/><span style={{ fontSize:11, color:'var(--text-2)' }}>{t.assignee_name}</span></div>
                        )}
                      </div>
                      {t.due_date && <div style={{ fontSize:11, marginTop:8, color:new Date(t.due_date)<new Date()&&col!=='done'?'var(--danger)':'var(--text-3)', fontFamily:'Space Mono' }}>📅 {t.due_date}</div>}
                    </div>
                  ))}
                  {colTasks.length===0 && <div style={{ border:'1px dashed var(--border)', borderRadius:10, padding:20, textAlign:'center', color:'var(--text-3)', fontSize:12 }}>Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Members tab */}
      {tab==='members' && (
        <div>
          {canManage && (
            <div style={{ marginBottom:16 }}>
              <Btn size="sm" onClick={()=>setShowAddMember(true)}>＋ Add Member</Btn>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(project.members||[]).map(m=>(
              <Card key={m.id} style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                <Avatar name={m.name} size={36} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600 }}>{m.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)' }}>{m.email}</div>
                </div>
                <Badge label={m.project_role} color={m.project_role==='admin'?'accent':'default'} />
                {m.global_role==='admin' && <Badge label="Global Admin" color="blue" />}
                {canManage && m.id!==project.owner_id && m.id!==user.id && (
                  <button onClick={()=>removeMember(m.id)} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:14 }}>✕</button>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <Modal open={showAddTask} onClose={()=>setShowAddTask(false)} title="Create Task" width={560}>
        <form onSubmit={createTask}>
          <Field label="Title *"><input value={taskForm.title} onChange={setTf('title')} placeholder="Task title..." required /></Field>
          <Field label="Description"><textarea value={taskForm.description} onChange={setTf('description')} placeholder="Details..." rows={3} style={{ resize:'vertical' }} /></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Field label="Priority">
              <select value={taskForm.priority} onChange={setTf('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={taskForm.status} onChange={setTf('status')}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </Field>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Field label="Assign To">
              <select value={taskForm.assignee_id} onChange={setTf('assignee_id')}>
                <option value="">Unassigned</option>
                {(project.members||[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label="Due Date"><input type="date" value={taskForm.due_date} onChange={setTf('due_date')} /></Field>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <Btn variant="ghost" onClick={()=>setShowAddTask(false)}>Cancel</Btn>
            <Btn loading={saving}>Create Task</Btn>
          </div>
        </form>
      </Modal>

      {/* Add Member Modal */}
      <Modal open={showAddMember} onClose={()=>setShowAddMember(false)} title="Add Member">
        <form onSubmit={addMember}>
          <Field label="Select User">
            <select value={memberForm.user_id} onChange={setMf('user_id')} required>
              <option value="">Choose a user...</option>
              {nonMembers.map(u=><option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </Field>
          <Field label="Project Role">
            <select value={memberForm.role} onChange={setMf('role')}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <Btn variant="ghost" type="button" onClick={()=>setShowAddMember(false)}>Cancel</Btn>
            <Btn loading={saving}>Add Member</Btn>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal open={showEditProject} onClose={()=>setShowEditProject(false)} title="Edit Project">
        <form onSubmit={updateProject}>
          <Field label="Project Name *"><input value={editProjectForm.name} onChange={setEpf('name')} placeholder="Project name..." required /></Field>
          <Field label="Description"><textarea value={editProjectForm.description} onChange={setEpf('description')} placeholder="Details..." rows={3} style={{ resize:'vertical' }} /></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Field label="Status">
              <select value={editProjectForm.status} onChange={setEpf('status')}>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Deadline"><input type="date" value={editProjectForm.deadline} onChange={setEpf('deadline')} /></Field>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'space-between', marginTop:8 }}>
            <Btn variant="danger" type="button" onClick={deleteProject}>Delete Project</Btn>
            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" type="button" onClick={()=>setShowEditProject(false)}>Cancel</Btn>
              <Btn loading={saving}>Save Changes</Btn>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── My Tasks Page ─────────────────────────────────────────────────
function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showOverdue, setShowOverdue] = useState(false);
  const [search, setSearch] = useState('');
  const { user, showToast } = useAuth();

  const load = () => {
    const params = new URLSearchParams();
    params.set('assignee_id', user.id);
    if (filterStatus) params.set('status', filterStatus);
    if (filterPriority) params.set('priority', filterPriority);
    if (showOverdue) params.set('overdue', 'true');
    if (search) params.set('search', search);
    apiFetch('/tasks?' + params.toString()).then(setTasks).finally(()=>setLoading(false));
  };

  useEffect(()=>{ load(); }, [filterStatus, filterPriority, showOverdue, search]);

  const updateStatus = async (id, status) => {
    try { await apiFetch(`/tasks/${id}`, { method:'PUT', body:{ status } }); load(); }
    catch(e) { showToast(e.message, 'error'); }
  };

  return (
    <div style={{ padding:28, maxWidth:1000 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700 }}>My Tasks</h1>
        <p style={{ color:'var(--text-2)', marginTop:4, fontSize:14 }}>Tasks assigned to you across all projects.</p>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tasks..." style={{ flex:'1 1 200px' }} />
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ width:'auto' }}>
          <option value="">All Status</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
        <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={{ width:'auto' }}>
          <option value="">All Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button onClick={()=>setShowOverdue(o=>!o)} style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${showOverdue?'var(--danger)':'var(--border)'}`, background:showOverdue?'var(--danger-dim)':'var(--surface2)', color:showOverdue?'var(--danger)':'var(--text-2)', cursor:'pointer', fontWeight:600, fontSize:13, whiteSpace:'nowrap' }}>
          ⚠ Overdue only
        </button>
      </div>

      {loading ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner size={28} /></div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {tasks.length===0 && <div style={{ textAlign:'center', color:'var(--text-3)', padding:60 }}>No tasks found matching your filters.</div>}
          {tasks.map(t=>(
            <Card key={t.id} style={{ padding:'12px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <select value={t.status} onChange={e=>updateStatus(t.id, e.target.value)} style={{ width:'auto', background:'var(--surface3)', borderRadius:6, padding:'4px 8px', fontSize:12 }}>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:14, opacity:t.status==='done'?0.5:1, textDecoration:t.status==='done'?'line-through':'none' }}>{t.title}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{t.project_name}</div>
                </div>
                {priorityBadge(t.priority)}
                {t.due_date && <span style={{ fontSize:12, fontFamily:'Space Mono', color:new Date(t.due_date)<new Date()&&t.status!=='done'?'var(--danger)':'var(--text-2)', flexShrink:0 }}>📅 {t.due_date}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admin Components ───────────────────────────────────────────────

function AdminUserManagement({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser, showToast } = useAuth();

  const loadUsers = () => {
    apiFetch('/auth/users')
      .then(setUsers)
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const updateRole = async (userId, role) => {
    try {
      await apiFetch(`/auth/users/${userId}/role`, { method: 'PUT', body: { role } });
      showToast('User role updated.', 'success');
      loadUsers();
    } catch(e) { showToast(e.message, 'error'); }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user globally? This cannot be undone.')) return;
    try {
      await apiFetch(`/auth/users/${userId}`, { method: 'DELETE' });
      showToast('User deleted.', 'success');
      loadUsers();
    } catch(e) { showToast(e.message, 'error'); }
  };

  if (loading) return <div style={{ padding:40, textAlign:'center' }}><Spinner size={32} /></div>;

  return (
    <Card>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'var(--text-2)', cursor:'pointer', fontSize:14 }}>← Back</button>
        <h2 style={{ fontSize:18, margin:0 }}>User Management</h2>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {users.map(u => (
          <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:14, background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)' }}>
            <Avatar name={u.name} size={40} />
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600 }}>{u.name} {u.id === currentUser.id && '(You)'}</div>
              <div style={{ fontSize:12, color:'var(--text-3)' }}>{u.email}</div>
            </div>
            <select 
              value={u.role} 
              onChange={e => updateRole(u.id, e.target.value)}
              disabled={u.id === currentUser.id}
              style={{ padding:'4px 8px', borderRadius:6, background:'var(--surface3)', border:'1px solid var(--border)' }}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Btn size="sm" variant="danger" disabled={u.id === currentUser.id} onClick={() => deleteUser(u.id)}>Delete</Btn>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AdminAuditLogs({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useAuth();

  useEffect(() => {
    apiFetch('/auth/activity_logs')
      .then(setLogs)
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding:40, textAlign:'center' }}><Spinner size={32} /></div>;

  return (
    <Card>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'var(--text-2)', cursor:'pointer', fontSize:14 }}>← Back</button>
        <h2 style={{ fontSize:18, margin:0 }}>Activity & Audit Logs</h2>
      </div>
      <div style={{ maxHeight: 600, overflowY: 'auto', display:'flex', flexDirection:'column', gap:8 }}>
        {logs.length === 0 && <div style={{ padding:20, textAlign:'center', color:'var(--text-3)' }}>No logs found.</div>}
        {logs.map(log => (
          <div key={log.id} style={{ padding:12, background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)', fontSize:13 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontWeight:600, color:'var(--text)' }}>{log.user_name || 'System'} <span style={{ color:'var(--text-3)', fontWeight:400 }}>({log.user_email || 'N/A'})</span></span>
              <span style={{ fontFamily:'Space Mono', color:'var(--text-3)', fontSize:11 }}>{new Date(log.created_at).toLocaleString()}</span>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <Badge label={log.action} color={log.action.includes('delete')?'red':log.action.includes('create')?'green':'blue'} />
              <span style={{ color:'var(--text-2)' }}>
                {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Settings Page ──────────────────────────────────────────────────
function SettingsPage() {
  const { user, showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [adminView, setAdminView] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('light-mode') === false);
  }, []);

  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.add('light-mode');
      setDarkMode(false);
    } else {
      document.documentElement.classList.remove('light-mode');
      setDarkMode(true);
    }
  };

  const handleMockSave = (e) => {
    e.preventDefault();
    showToast('Settings saved successfully.', 'success');
  };

  return (
    <div style={{ padding:28, maxWidth:1000 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700 }}>Settings & Features</h1>
        <p style={{ color:'var(--text-2)', marginTop:4, fontSize:14 }}>Manage your account, preferences, and advanced features.</p>
      </div>

      <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
        {/* Sidebar */}
        <div style={{ width: 220, display:'flex', flexDirection:'column', gap:4 }}>
          {['profile', 'preferences', 'advanced', 'admin'].map(t => {
            if (t === 'admin' && user.role !== 'admin') return null;
            const labels = { profile:'Profile & Account', preferences:'Preferences', advanced:'Advanced Features', admin:'Admin Controls' };
            return (
              <button key={t} onClick={() => { setActiveTab(t); setAdminView(null); }} style={{ padding:'10px 14px', borderRadius:8, border:'none', background:activeTab===t?'var(--surface2)':'transparent', color:activeTab===t?'var(--text)':'var(--text-2)', textAlign:'left', fontWeight:activeTab===t?600:400, cursor:'pointer', transition:'all .15s' }}>
                {labels[t]}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex:1, minWidth:300 }}>
          {activeTab === 'profile' && (
            <Card>
              <h2 style={{ fontSize:16, marginBottom:16 }}>Profile Information</h2>
              <form onSubmit={handleMockSave}>
                <Field label="Full Name"><input defaultValue={user.name} /></Field>
                <Field label="Email Address"><input type="email" defaultValue={user.email} disabled style={{ opacity:0.6 }} /></Field>
                <Field label="New Password"><input type="password" placeholder="Leave blank to keep current" /></Field>
                <Btn>Update Profile</Btn>
              </form>
            </Card>
          )}

          {activeTab === 'preferences' && (
            <Card>
              <h2 style={{ fontSize:16, marginBottom:16 }}>App Preferences</h2>
              
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight:600 }}>Dark Mode</div>
                  <div style={{ fontSize:12, color:'var(--text-2)' }}>Toggle between light and dark themes.</div>
                </div>
                <Btn variant={darkMode ? "primary" : "secondary"} onClick={toggleDarkMode}>{darkMode ? 'Enabled' : 'Disabled'}</Btn>
              </div>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight:600 }}>Email Alerts</div>
                  <div style={{ fontSize:12, color:'var(--text-2)' }}>Receive notifications for task updates and deadlines.</div>
                </div>
                <Btn variant="secondary" type="button" onClick={() => showToast('Feature coming soon!')}>Configure</Btn>
              </div>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0' }}>
                <div>
                  <div style={{ fontWeight:600 }}>Mobile Responsiveness</div>
                  <div style={{ fontSize:12, color:'var(--text-2)' }}>Optimize layout for smaller screens. (Always enabled)</div>
                </div>
                <Btn variant="primary" disabled>Enabled</Btn>
              </div>
            </Card>
          )}

          {activeTab === 'advanced' && (
            <Card>
              <h2 style={{ fontSize:16, marginBottom:16 }}>Optional Advanced Member Features</h2>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16 }}>
                {[
                  { title:'Time Tracking', desc:'Log hours spent on specific tasks.' },
                  { title:'Calendar View', desc:'Visualize due dates in a monthly grid.' },
                  { title:'Real-time Updates', desc:'Live sync via WebSockets.' },
                  { title:'Upload Attachments', desc:'Add files and images to tasks.' },
                  { title:'Task Tags/Categories', desc:'Organize tasks with custom labels.' },
                ].map(f => (
                  <div key={f.title} style={{ padding:14, background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{f.title}</div>
                    <div style={{ fontSize:12, color:'var(--text-2)', marginTop:4, marginBottom:10 }}>{f.desc}</div>
                    <Btn size="sm" variant="ghost" type="button" onClick={() => showToast('Advanced feature requires upgrade.')}>Enable</Btn>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'admin' && user.role === 'admin' && (
            <>
              {!adminView && (
                <Card>
                  <h2 style={{ fontSize:16, marginBottom:16 }}>Advanced Admin Features</h2>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16 }}>
                    {[
                      { id:'users', title:'User Management', desc:'Add, edit, delete, and block users globally.' },
                      { id:'logs', title:'Activity & Audit Logs', desc:'Track all system actions.' },
                      { id:'ai', title:'AI Analytics', desc:'Generate insights on team performance.' },
                      { id:'export', title:'Export Reports', desc:'Download PDF/Excel progress reports.' },
                      { id:'backup', title:'Backup & Restore', desc:'Manage database backups.' },
                      { id:'api', title:'API Settings', desc:'Manage API keys and webhooks.' },
                    ].map(f => (
                      <div key={f.title} style={{ padding:14, background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)' }}>
                        <div style={{ fontWeight:600, fontSize:14 }}>{f.title}</div>
                        <div style={{ fontSize:12, color:'var(--text-2)', marginTop:4, marginBottom:10 }}>{f.desc}</div>
                        <Btn size="sm" variant="secondary" type="button" onClick={() => {
                          if (f.id === 'users' || f.id === 'logs') {
                            setAdminView(f.id);
                          } else {
                            showToast('Admin feature not fully implemented.');
                          }
                        }}>Manage</Btn>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              {adminView === 'users' && <AdminUserManagement onBack={() => setAdminView(null)} />}
              {adminView === 'logs' && <AdminAuditLogs onBack={() => setAdminView(null)} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────
function App() {
  const { user } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [projectId, setProjectId] = useState(null);

  if (!user) return <AuthPage />;

  const openProject = id => { setProjectId(id); setPage('project'); };
  const closeProject = () => { setProjectId(null); setPage('projects'); };

  const pageContent = () => {
    if (page==='dashboard') return <Dashboard setPage={setPage} setProjectId={openProject} />;
    if (page==='projects') return <ProjectsPage onOpenProject={openProject} />;
    if (page==='project' && projectId) return <ProjectDetail projectId={projectId} onBack={closeProject} />;
    if (page==='tasks') return <TasksPage />;
    if (page==='settings') return <SettingsPage />;
    return null;
  };

  return (
    <Shell page={page==='project'?'projects':page} setPage={p=>{ setPage(p); setProjectId(null); }}>
      {pageContent()}
    </Shell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider><App /></AuthProvider>
);