import {useEffect,useState} from 'react'
import {HashRouter,NavLink,Navigate,Route,Routes} from 'react-router-dom'
import type {Session} from '@supabase/supabase-js'
import {supabase} from './lib/supabase'
import {Activite,Apporteurs,Ctx,Dashboard,Documents,Equipe,Factures,Interventions,PVs,Stock,type Prof} from './pages'

function Login(){
  const[e,setE]=useState(''),[p,setP]=useState(''),[err,setErr]=useState('')
  const go=async()=>{setErr('');const{error}=await supabase.auth.signInWithPassword({email:e,password:p});if(error)setErr(error.message)}
  return <div className="login"><div className="card"><h1>Administration</h1>
    <label>E-mail<input type="email" value={e} onChange={x=>setE(x.target.value)} autoComplete="email"/></label>
    <label>Mot de passe<input type="password" value={p} onChange={x=>setP(x.target.value)} autoComplete="current-password" onKeyDown={x=>x.key==='Enter'&&go()}/></label>
    {err&&<p className="err">{err}</p>}<button onClick={go}>Se connecter</button></div></div>
}
const NAV:[string,string][]=[['/','Tableau de bord'],['/interventions','Interventions'],['/pv','PV'],['/activite','Activité'],['/stock','Stock'],['/documents','Documents'],['/factures','Factures'],['/apporteurs','Apporteurs'],['/equipe','Équipe']]

export default function App(){
  const[s,setS]=useState<Session|null|undefined>(undefined),[profiles,setP]=useState<Prof[]>([]),[loaded,setLoaded]=useState(false),[loadErr,setLoadErr]=useState('')
  useEffect(()=>{supabase.auth.getSession().then(r=>setS(r.data.session));const{data}=supabase.auth.onAuthStateChange((_,x)=>setS(x));return()=>data.subscription.unsubscribe()},[])
  const load=()=>{supabase.from('profiles').select('id,full_name,role,referral_code').order('full_name').then(r=>{setLoadErr(r.error?.message??'');setP((r.data??[]) as Prof[]);setLoaded(true)})}
  useEffect(()=>{if(s)load();else setLoaded(false)},[s?.user.id])
  if(s===undefined)return null
  if(!s)return <Login/>
  const me=profiles.find(p=>p.id===s.user.id)
  if(!loaded)return <p className="mute" style={{padding:24}}>Chargement…</p>
  if(me?.role!=='admin')return <div className="login"><div className="card"><h1>Droits insuffisants</h1><p className="mute">Connecté en tant que <b>{s.user.email}</b></p>{loadErr?<p className="err">Erreur de lecture du profil : {loadErr}</p>:<p className="mute">{me?`Rôle de ce compte : ${me.role}. Il faut le rôle admin.`:'Aucun profil trouvé pour ce compte.'}</p>}<button onClick={()=>supabase.auth.signOut()}>Se déconnecter</button></div></div>
  return <HashRouter><Ctx.Provider value={{profiles,me,reload:load}}><div className="shell"><aside><div className="brand">Terrain<span>Administration</span></div>
    <nav>{NAV.map(([to,l])=><NavLink key={to} to={to} end={to==='/'}>{l}</NavLink>)}</nav>
    <div className="who">{me.full_name}<button className="ghost" onClick={()=>supabase.auth.signOut()}>Se déconnecter</button></div></aside>
    <main><Routes><Route path="/" element={<Dashboard/>}/><Route path="/interventions" element={<Interventions/>}/><Route path="/pv" element={<PVs/>}/><Route path="/activite" element={<Activite/>}/>
      <Route path="/stock" element={<Stock/>}/><Route path="/documents" element={<Documents/>}/><Route path="/factures" element={<Factures/>}/><Route path="/apporteurs" element={<Apporteurs/>}/><Route path="/equipe" element={<Equipe/>}/><Route path="*" element={<Navigate to="/"/>}/></Routes></main></div></Ctx.Provider></HashRouter>
}
