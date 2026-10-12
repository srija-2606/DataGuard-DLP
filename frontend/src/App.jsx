import { useEffect, useState } from 'react'
import {
  ShieldCheck, ShieldAlert, LayoutDashboard, ScanSearch, History, LogOut,
  Upload, FileText, Activity, LockKeyhole, ArrowUpRight, CheckCircle2,
  AlertTriangle, XCircle, Eye, EyeOff, LoaderCircle, Menu, X
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import api from './api'

const cx = (...parts) => parts.filter(Boolean).join(' ')
const prettyDate = (s) => s ? new Date(s).toLocaleString() : '—'

function App() {
  const [token, setToken] = useState(localStorage.getItem('dataguard_token'))
  const [email, setEmail] = useState(localStorage.getItem('dataguard_email') || '')
  const [page, setPage] = useState('Dashboard')
  const [mobileNav, setMobileNav] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [audit, setAudit] = useState([])
  const [text, setText] = useState('')
  const [filename, setFilename] = useState('Pasted text')
  const [result, setResult] = useState(null)
  const [scanError, setScanError] = useState('')
  const [file, setFile] = useState(null)
  const [toast, setToast] = useState('')

  async function refreshData() {
    try {
      const [d, a] = await Promise.all([api.get('/dashboard'), api.get('/audit')])
      setDashboard(d.data); setAudit(a.data)
    } catch (e) {
      if (e.response?.status === 401) logout()
    }
  }
  useEffect(() => { if (token) refreshData() }, [token])
  function logout() {
    localStorage.removeItem('dataguard_token'); localStorage.removeItem('dataguard_email')
    setToken(null); setEmail(''); setDashboard(null); setAudit([]); setResult(null)
  }
  async function submitAuth(e) {
    e.preventDefault(); setBusy(true); setAuthError('')
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register'
      const { data } = await api.post(endpoint, { email: authEmail, password: authPassword })
      localStorage.setItem('dataguard_token', data.access_token)
      localStorage.setItem('dataguard_email', data.email)
      setToken(data.access_token); setEmail(data.email); setAuthPassword('')
    } catch (err) {
      setAuthError(err.response?.data?.detail || 'Could not connect. Check that the FastAPI server is running.')
    } finally { setBusy(false) }
  }
  async function runTextScan(e) {
    e?.preventDefault(); if (!text.trim()) { setScanError('Enter some text to scan first.'); return }
    setBusy(true); setScanError(''); setResult(null)
    try {
      const { data } = await api.post('/scan/text', { text, filename })
      setResult(data); await refreshData(); setPage('Scanner')
    } catch (err) { setScanError(err.response?.data?.detail || 'Scan failed. Please try again.') }
    finally { setBusy(false) }
  }
  async function runFileScan(e) {
    e.preventDefault(); if (!file) { setScanError('Choose a supported file first.'); return }
    setBusy(true); setScanError(''); setResult(null)
    const form = new FormData(); form.append('file', file)
    try {
      const { data } = await api.post('/scan/file', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(data); setFilename(file.name); await refreshData(); setPage('Scanner')
    } catch (err) { setScanError(err.response?.data?.detail || 'File scan failed.') }
    finally { setBusy(false) }
  }

  if (!token) return <AuthScreen {...{authMode,setAuthMode,authEmail,setAuthEmail,authPassword,setAuthPassword,showPassword,setShowPassword,authError,busy,submitAuth}} />

  const nav = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Scanner', icon: ScanSearch },
    { name: 'Audit Log', icon: History },
  ]
  const total = dashboard?.total_scans || 0
  const events = dashboard?.recent_events || []
  const chartData = [
    { name: 'Allowed', count: audit.filter(x => x.action === 'ALLOW').length },
    { name: 'Warnings', count: audit.filter(x => x.action === 'WARN').length },
    { name: 'Blocked', count: audit.filter(x => x.action === 'BLOCK').length },
  ]

  return <div className="app-shell">
    <aside className={cx('sidebar', mobileNav && 'sidebar-open')}>
      <div className="brand"><div className="brand-mark"><ShieldCheck size={22}/></div><div><strong>DataGuard</strong><span>DATA SECURITY PLATFORM</span></div><button className="icon-button mobile-close" onClick={() => setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{nav.map(item => <button key={item.name} className={cx('nav-item', page === item.name && 'active')} onClick={() => {setPage(item.name);setMobileNav(false)}}><item.icon size={18}/><span>{item.name}</span>{item.name === 'Audit Log' && <span className="nav-count">{audit.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="secure-status"><span className="status-dot"/><div><strong>Protection active</strong><small>Local demo environment</small></div></div>
        <div className="user-card"><div className="avatar">{(email[0] || 'U').toUpperCase()}</div><div className="user-info"><strong>{email}</strong><small>Workspace member</small></div><button title="Sign out" className="icon-button" onClick={logout}><LogOut size={17}/></button></div>
      </div>
    </aside>
    {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)}><Menu size={20}/></button><span className="breadcrumb">Workspace <span>/</span> {page}</span></div><div className="topbar-right"><span className="environment"><span className="status-dot"/> DEMO ENVIRONMENT</span><div className="top-avatar">{(email[0] || 'U').toUpperCase()}</div></div></header>
      <div className="page-content">
        {page === 'Dashboard' && <DashboardPage {...{email,total,dashboard,events,chartData,setPage,refreshData}} />}
        {page === 'Scanner' && <ScannerPage {...{text,setText,filename,setFilename,result,scanError,busy,file,setFile,runTextScan,runFileScan,setResult}} />}
        {page === 'Audit Log' && <AuditPage audit={audit} />}
        <footer className="footer"><span>DataGuard © 2026</span><span><LockKeyhole size={13}/> Sensitive content is not saved in audit logs</span></footer>
      </div>
    </main>
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function AuthScreen(p) {
  return <div className="auth-page"><div className="auth-glow glow-one"/><div className="auth-glow glow-two"/>
    <div className="auth-brand"><div className="brand-mark"><ShieldCheck size={24}/></div><div><strong>DataGuard</strong><span>DATA LEAKAGE PREVENTION</span></div></div>
    <div className="auth-card"><div className="auth-icon"><ShieldCheck size={26}/></div><div className="eyebrow">SECURE WORKSPACE</div><h1>{p.authMode === 'login' ? 'Welcome back' : 'Create your account'}</h1><p className="muted">{p.authMode === 'login' ? 'Sign in to monitor and protect sensitive data.' : 'Set up your secure demo workspace in seconds.'}</p>
      <form onSubmit={p.submitAuth} className="auth-form"><label>Email address</label><input type="email" placeholder="you@example.com" value={p.authEmail} onChange={e => p.setAuthEmail(e.target.value)} required autoComplete="email"/><label>Password</label><div className="password-wrap"><input type={p.showPassword ? 'text' : 'password'} placeholder="At least 8 characters" value={p.authPassword} onChange={e => p.setAuthPassword(e.target.value)} minLength={p.authMode === 'register' ? 8 : 1} required autoComplete={p.authMode === 'login' ? 'current-password' : 'new-password'}/><button type="button" className="password-toggle" onClick={() => p.setShowPassword(!p.showPassword)}>{p.showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
      {p.authError && <div className="error-box"><AlertTriangle size={16}/>{p.authError}</div>}<button className="primary-button full-button" disabled={p.busy}>{p.busy ? <LoaderCircle className="spin" size={18}/> : null}{p.authMode === 'login' ? 'Sign in' : 'Create account'} <ArrowUpRight size={17}/></button></form>
      <div className="auth-switch">{p.authMode === 'login' ? "Don't have an account?" : 'Already have an account?'} <button onClick={() => {p.setAuthMode(p.authMode === 'login' ? 'register' : 'login')}}>{p.authMode === 'login' ? 'Create account' : 'Sign in'}</button></div>
    </div><div className="auth-note"><LockKeyhole size={14}/> Built for secure scanning demos · Use synthetic test data only</div>
  </div>
}

function DashboardPage({email,total,dashboard,events,chartData,setPage}) {
  return <div className="fade-in">
    <div className="page-heading"><div><div className="eyebrow">SECURITY OVERVIEW</div><h1>Good to see you<span className="mint">.</span></h1><p className="muted">Here's what's happening in your data protection workspace.</p></div><button className="primary-button" onClick={() => setPage('Scanner')}><ScanSearch size={17}/> New scan</button></div>
    <div className="welcome-strip"><div className="welcome-icon"><ShieldCheck size={23}/></div><div><strong>Your data protection workspace is ready</strong><p>Scan content before sharing and review policy decisions in one place.</p></div><span className="strip-pill"><span className="status-dot"/> SYSTEM READY</span></div>
    <div className="stats-grid">
      <StatCard icon={ScanSearch} label="Total scans" value={total} note="All recorded scans" tone="blue"/>
      <StatCard icon={ShieldAlert} label="Blocked submissions" value={dashboard?.blocked || 0} note="High-risk demo policy" tone="red"/>
      <StatCard icon={AlertTriangle} label="Warnings" value={dashboard?.warnings || 0} note="Needs review" tone="amber"/>
      <StatCard icon={Activity} label="High-risk detections" value={dashboard?.high_risk || 0} note="Risk score ≥ 50" tone="purple"/>
    </div>
    <div className="content-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Policy decisions</h2><p className="muted">Breakdown of your latest 100 audit events</p></div><span className="mini-tag">AUDIT ANALYTICS</span></div>
        <div className="chart-wrap">{total ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:8,right:8,left:-18,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#26334b" vertical={false}/><XAxis dataKey="name" stroke="#8190a8" tickLine={false} axisLine={false}/><YAxis stroke="#8190a8" tickLine={false} axisLine={false} allowDecimals={false}/><Tooltip contentStyle={{background:'#111b2e',border:'1px solid #26334b',borderRadius:12,color:'#e8eef8'}} cursor={{fill:'#ffffff08'}}/><Bar dataKey="count" fill="#5eead4" radius={[5,5,0,0]} maxBarSize={54}/></BarChart></ResponsiveContainer> : <EmptyState icon={Activity} title="No scan activity yet" text="Run your first scan to see policy analytics here."/>}</div>
      </section>
      <section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p className="muted">Protect information in a few steps</p></div></div>
        <button className="quick-action" onClick={() => setPage('Scanner')}><div className="quick-icon mint-bg"><ScanSearch size={19}/></div><div><strong>Scan text or file</strong><small>Detect sensitive information</small></div><ArrowUpRight size={17}/></button>
        <button className="quick-action" onClick={() => setPage('Audit Log')}><div className="quick-icon blue-bg"><History size={19}/></div><div><strong>Review audit log</strong><small>Inspect recent security events</small></div><ArrowUpRight size={17}/></button>
        <div className="policy-note"><LockKeyhole size={17}/><div><strong>Policy engine enabled</strong><p>High risk blocks · Medium risk warns · Low risk allows</p></div></div>
      </section>
    </div>
    <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent security events</h2><p className="muted">Latest activity from your workspace</p></div><button className="text-button" onClick={() => setPage('Audit Log')}>View all <ArrowUpRight size={15}/></button></div>
      {events.length ? <div className="table-scroll"><table><thead><tr><th>RESOURCE</th><th>RISK</th><th>FINDINGS</th><th>POLICY ACTION</th><th>TIME</th></tr></thead><tbody>{events.map(e => <tr key={e.id}><td><div className="resource-cell"><div className="file-icon"><FileText size={16}/></div><span>{e.filename}</span></div></td><td><RiskBadge level={e.risk_level}/></td><td>{e.finding_count}</td><td><ActionBadge action={e.action}/></td><td className="date-cell">{prettyDate(e.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState icon={History} title="Nothing to report yet" text="Your scans and their policy decisions will appear here."/>}
    </section>
  </div>
}
function StatCard({icon:Icon,label,value,note,tone}) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}><Icon size={18}/></div></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div> }

function ScannerPage(p) {
  return <div className="fade-in"><div className="page-heading"><div><div className="eyebrow">CONTENT INSPECTION</div><h1>Security scanner<span className="mint">.</span></h1><p className="muted">Inspect text or supported files before sharing them.</p></div><div className="scanner-status"><span className="status-dot"/> DLP ENGINE ONLINE</div></div>
    <div className="scanner-grid"><section className="panel scanner-panel"><div className="panel-heading"><div><h2><ScanSearch size={19}/> Scan content</h2><p className="muted">Your content is analyzed in memory and not saved in the audit log.</p></div></div>
      <form onSubmit={p.runTextScan}><label className="field-label">Resource name <span>OPTIONAL</span></label><input className="text-input" value={p.filename} onChange={e => p.setFilename(e.target.value)} maxLength={255} placeholder="e.g. customer-notes.txt"/>
        <label className="field-label">Text to inspect</label><textarea className="scan-textarea" value={p.text} onChange={e => p.setText(e.target.value)} placeholder={'Paste sample content here…\n\nExample: Contact demo.user@example.com or phone 9876543210'} rows={9} maxLength={500000}/>
        <div className="input-meta"><span>{p.text.length.toLocaleString()} / 500,000 characters</span><button type="button" className="text-button" onClick={() => {p.setText('Contact: demo.user@example.com\\nPhone: 9876543210\\nPassword: DemoPass123!');p.setFilename('sample-sensitive-data.txt');p.setResult(null)}}>Load demo sample</button></div>
        <div className="scan-actions"><button className="primary-button" disabled={p.busy}>{p.busy ? <LoaderCircle className="spin" size={17}/> : <ScanSearch size={17}/>} Scan text</button><button type="button" className="secondary-button" onClick={() => {p.setText('');p.setResult(null)}}>Clear</button></div>
      </form>
      <div className="upload-divider"><span/> OR SCAN A FILE <span/></div>
      <form onSubmit={p.runFileScan} className="upload-form"><label className="upload-zone"><input type="file" accept=".txt,.csv,.json,.md,text/plain,text/csv,application/json,text/markdown" onChange={e => p.setFile(e.target.files?.[0] || null)}/><div className="upload-icon"><Upload size={21}/></div><strong>{p.file ? p.file.name : 'Choose a file to scan'}</strong><span>{p.file ? `${(p.file.size/1024).toFixed(1)} KB · selected` : 'TXT, CSV, JSON, MD · maximum 2 MB'}</span></label><button className="secondary-button upload-button" disabled={p.busy || !p.file}>{p.busy ? 'Scanning…' : 'Scan selected file'}</button></form>
      {p.scanError && <div className="error-box scan-error"><AlertTriangle size={16}/>{p.scanError}</div>}
    </section>
    <section className="panel results-panel"><div className="panel-heading"><div><h2><ShieldCheck size={19}/> Scan results</h2><p className="muted">Findings and recommended policy action</p></div><span className="mini-tag">LIVE RESULTS</span></div>
      {!p.result ? <div className="results-empty"><div className="results-empty-icon"><ScanSearch size={28}/></div><strong>Ready to inspect</strong><p>Run a scan to see detected categories, risk score, and masked output.</p><div className="empty-feature"><CheckCircle2 size={15}/> Sensitive values are masked in findings</div><div className="empty-feature"><CheckCircle2 size={15}/> Only event metadata is retained</div></div> : <ResultView result={p.result}/>}
    </section></div>
    <div className="notice-bar"><AlertTriangle size={16}/><span><strong>Prototype limitation:</strong> Detection is rule-based and may miss or misclassify sensitive data. Use synthetic examples only.</span></div>
  </div>
}

function ResultView({result:r}) {
  const [showMasked,setShowMasked] = useState(true)
  return <div className="result-view fade-in"><div className={`risk-banner ${r.risk_level.toLowerCase()}`}><div className="risk-symbol">{r.policy_action === 'BLOCK' ? <XCircle size={23}/> : r.policy_action === 'WARN' ? <AlertTriangle size={23}/> : <CheckCircle2 size={23}/>}</div><div className="risk-copy"><span>{r.policy_action} POLICY DECISION</span><strong>{r.message}</strong></div><div className="score-ring"><strong>{r.risk_score}</strong><small>/100</small></div></div>
    <div className="result-metrics"><div><span>RISK LEVEL</span><RiskBadge level={r.risk_level}/></div><div><span>FINDINGS</span><strong>{r.finding_count}</strong></div><div><span>POLICY ACTION</span><ActionBadge action={r.policy_action}/></div></div>
    <div className="findings-head"><h3>Detected sensitive patterns</h3><span>{r.finding_count} found</span></div>
    {r.findings.length ? <div className="findings-list">{r.findings.map((f,i)=><div className="finding-row" key={`${f.category}-${i}`}><div className="finding-dot"/><div className="finding-main"><strong>{f.category}</strong><code>{f.masked_value}</code></div><span className="detected-label">DETECTED</span></div>)}</div> : <div className="no-findings"><CheckCircle2 size={18}/> No configured sensitive patterns detected.</div>}
    <div className="masked-head"><div><h3>Masked content</h3><p>Review a redacted version of the submitted content.</p></div><button className="text-button" onClick={()=>setShowMasked(!showMasked)}>{showMasked ? <EyeOff size={15}/> : <Eye size={15}/>} {showMasked ? 'Hide' : 'Show'}</button></div>
    {showMasked && <pre className="masked-content">{r.masked_text}</pre>}
  </div>
}

function AuditPage({audit}) {
  const [filter,setFilter] = useState('ALL')
  const filtered = filter === 'ALL' ? audit : audit.filter(e => e.action === filter)
  return <div className="fade-in"><div className="page-heading"><div><div className="eyebrow">TRACEABILITY & COMPLIANCE</div><h1>Audit log<span className="mint">.</span></h1><p className="muted">A metadata-only record of your recent DLP scans.</p></div><div className="audit-total"><History size={17}/>{audit.length} events</div></div>
    <section className="panel audit-panel"><div className="panel-heading"><div><h2>Security events</h2><p className="muted">Up to 100 latest events for your account</p></div><select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">All actions</option><option value="ALLOW">Allowed</option><option value="WARN">Warnings</option><option value="BLOCK">Blocked</option></select></div>
    {filtered.length ? <div className="table-scroll"><table><thead><tr><th>RESOURCE</th><th>RISK LEVEL</th><th>SCORE</th><th>FINDINGS</th><th>CATEGORIES</th><th>ACTION</th><th>TIMESTAMP</th></tr></thead><tbody>{filtered.map(e=><tr key={e.id}><td><div className="resource-cell"><div className="file-icon"><FileText size={16}/></div><span>{e.filename}</span></div></td><td><RiskBadge level={e.risk_level}/></td><td><strong>{e.risk_score}</strong><span className="muted"> / 100</span></td><td>{e.finding_count}</td><td className="categories-cell">{e.categories || 'None'}</td><td><ActionBadge action={e.action}/></td><td className="date-cell">{prettyDate(e.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState icon={History} title="No matching events" text="Try another filter or run a scan to create an event."/>}
    <div className="audit-footnote"><LockKeyhole size={15}/> Original text and unmasked secret values are not stored in these records.</div></section>
  </div>
}
function RiskBadge({level}) { return <span className={`badge risk-${(level||'low').toLowerCase()}`}><span/>{level}</span> }
function ActionBadge({action}) { const Icon = action === 'BLOCK' ? XCircle : action === 'WARN' ? AlertTriangle : CheckCircle2; return <span className={`action-badge action-${action.toLowerCase()}`}><Icon size={13}/>{action}</span> }
function EmptyState({icon:Icon,title,text}) { return <div className="empty-state"><div><Icon size={22}/></div><strong>{title}</strong><p>{text}</p></div> }

export default App
