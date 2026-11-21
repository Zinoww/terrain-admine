import {useEffect,useState,createContext,useContext,type ReactNode} from 'react'
import readXlsxFile from 'read-excel-file'
import {supabase} from './lib/supabase'
import {openStored} from './lib/storage'
import {download,parseCsv,parseDate,toCsv,toRecords} from './lib/csv'

export type Prof={id:string;full_name:string|null;role:string;referral_code:string|null}
export const Ctx=createContext<{profiles:Prof[];me:Prof;reload:()=>void}>(null as never)
const useCtx=()=>useContext(Ctx)
const nm=(ps:Prof[],id:string|null)=>ps.find(p=>p.id===id)?.full_name??(id?id.slice(0,6):'—')
const today=()=>new Date().toLocaleDateString('sv')
const plus=(n:number)=>new Date(Date.now()+n*864e5).toLocaleDateString('sv')
const dayOf=(s:string)=>new Date(s).toLocaleDateString('sv')
const hhmm=(s:string)=>new Date(s).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})
const eur=(n:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n)
const num=(n:number)=>n.toLocaleString('fr-FR')
const ST:[string,string][]=[['planifiee','Planifiée'],['en_cours','En cours'],['terminee','Terminée'],['a_replanifier','À replanifier']]
const lab=(s:string)=>ST.find(x=>x[0]===s)?.[1]??s
const REWARD=100

function useQ<T>(fn:()=>PromiseLike<{data:unknown[]|null;error:{message:string}|null}>,deps:unknown[]=[]){
  const[r,setR]=useState<T[]|null>(null),[err,setErr]=useState('')
  const load=()=>{fn().then(x=>{if(x.error)setErr(x.error.message);else{setErr('');setR((x.data??[]) as T[])}})}
  useEffect(load,deps)
  return{r,err,load}
}
const Modal=({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode})=>
  <div className="modal" role="dialog" aria-label={title} onClick={onClose}><div className="mbox" onClick={e=>e.stopPropagation()}><div className="row"><h2>{title}</h2><button className="ghost" onClick={onClose} aria-label="Fermer">✕</button></div>{children}</div></div>
const TechSel=({v,set,blank}:{v:string|null;set:(x:string|null)=>void;blank:string})=>{const{profiles}=useCtx()
  return <select value={v??''} onChange={e=>set(e.target.value||null)}><option value="">{blank}</option>{profiles.map(p=>({id:p.id,n:p.full_name??p.id.slice(0,6)})).map(p=><option key={p.id} value={p.id}>{p.n}</option>)}</select>}
const Err=({e}:{e:string})=>e?<p className="err">{e}</p>:null
const Chip=({s}:{s:string})=><span className={`chip ${s}`}>{lab(s)}</span>

/* ---------- Tableau de bord ---------- */
type Int={id:string;ref:string|null;client:string;address:string|null;city:string|null;scheduled_at:string;status:string;assigned_to:string|null;notes:string|null;details?:Record<string,string>|null}
type Doc={id:string;tech_id:string;type:string;title:string;issued_on:string|null;expires_on:string|null;file_path:string}
type Stk={id:string;name:string;barcode:string;qty:number;assigned_to:string|null}
export function Dashboard(){
  const{profiles}=useCtx(),t=today()
  const iv=useQ<Int>(()=>supabase.from('interventions').select('id,client,scheduled_at,status,assigned_to').limit(2000))
  const docs=useQ<Doc>(()=>supabase.from('documents').select('id,tech_id,type,title,expires_on').not('expires_on','is',null).lte('expires_on',plus(30)).order('expires_on'))
  const stock=useQ<Stk>(()=>supabase.from('stock_items').select('id,name,qty,assigned_to').lte('qty',2))
  const all=iv.r??[],td=all.filter(i=>dayOf(i.scheduled_at)===t),late=all.filter(i=>dayOf(i.scheduled_at)<t&&i.status!=='terminee'&&i.status!=='a_replanifier')
  const stat=(l:string,n:number,s:string)=><div className="card"><div className="mute">{l}</div><div className="big">{n}</div><div className="mute">{s}</div></div>
  return <><h1>Tableau de bord</h1><Err e={iv.err||docs.err||stock.err}/>
    <div className="grid4">{stat("Aujourd'hui",td.length,`${td.filter(i=>i.status==='terminee').length} terminée(s)`)}{stat('En retard',late.length,'non clôturée(s)')}
      {stat('À replanifier',all.filter(i=>i.status==='a_replanifier').length,'au total')}{stat('Ouvertes',all.filter(i=>i.status!=='terminee').length,`sur ${all.length} au total`)}</div>
    <div className="card"><h2>Aujourd'hui par technicien</h2><table className="tbl"><thead><tr><th>Technicien</th><th>Prévues</th><th>Terminées</th></tr></thead><tbody>
      {profiles.map(p=>{const x=td.filter(i=>i.assigned_to===p.id);return <tr key={p.id}><td>{p.full_name??p.id.slice(0,6)}</td><td>{x.length}</td><td>{x.filter(i=>i.status==='terminee').length}</td></tr>})}
      {td.some(i=>!i.assigned_to)&&<tr><td>Non assignées</td><td>{td.filter(i=>!i.assigned_to).length}</td><td>0</td></tr>}</tbody></table></div>
    <div className="grid2"><div className="card"><h2>Documents à renouveler (30 jours)</h2>{(docs.r??[]).map(d=><div className="row" key={d.id}><span>{d.title}<div className="mute">{nm(profiles,d.tech_id)}</div></span><span className={`chip ${d.expires_on!<t?'a_replanifier':'en_cours'}`}>{d.expires_on}</span></div>)}{docs.r&&!docs.r.length&&<p className="mute">Rien à renouveler.</p>}</div>
      <div className="card"><h2>Stock bas (2 ou moins)</h2>{(stock.r??[]).map(s=><div className="row" key={s.id}><span>{s.name}<div className="mute">{nm(profiles,s.assigned_to)}</div></span><b>{s.qty}</b></div>)}{stock.r&&!stock.r.length&&<p className="mute">Stock suffisant.</p>}</div></div></>
}

/* ---------- Interventions ---------- */
export function Interventions(){
  const{profiles}=useCtx(),{r,err,load}=useQ<Int>(()=>supabase.from('interventions').select('*').order('scheduled_at',{ascending:false}).limit(2000))
  const[q,setQ]=useState(''),[st,setSt]=useState(''),[tech,setTech]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[modal,setModal]=useState<''|'new'|'import'>(''),[msg,setMsg]=useState('')
  const[detail,setDetail]=useState<Int|null>(null)
  const rows=(r??[]).filter(i=>(!st||i.status===st)&&(!tech||(tech==='none'?!i.assigned_to:i.assigned_to===tech))&&(!from||dayOf(i.scheduled_at)>=from)&&(!to||dayOf(i.scheduled_at)<=to)&&`${i.client} ${i.city} ${i.ref} ${i.address}`.toLowerCase().includes(q.toLowerCase()))
  const upd=async(id:string,x:Partial<Int>)=>{const{error}=await supabase.from('interventions').update(x).eq('id',id);setMsg(error?.message??'');load()}
  const del=async(id:string)=>{if(!confirm('Supprimer cette intervention ?'))return;const{error}=await supabase.from('interventions').delete().eq('id',id);setMsg(error?.message??'');load()}
  const exp=()=>download('interventions.csv',toCsv([['Date','Heure','Client','Référence','Adresse','Ville','Technicien','Statut'],...rows.map(i=>[dayOf(i.scheduled_at),hhmm(i.scheduled_at),i.client,i.ref,i.address,i.city,nm(profiles,i.assigned_to),lab(i.status)])]))
  const done=()=>{setModal('');load()}
  return <><div className="row"><h1>Interventions</h1><span><button onClick={()=>setModal('new')}>+ Nouvelle</button> <button className="ghost" onClick={()=>setModal('import')}>Importer</button> <button className="ghost" onClick={exp}>Exporter CSV</button></span></div>
    <div className="filters"><input placeholder="Rechercher…" value={q} onChange={e=>setQ(e.target.value)}/>
      <select value={st} onChange={e=>setSt(e.target.value)}><option value="">Tous les statuts</option>{ST.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
      <select value={tech} onChange={e=>setTech(e.target.value)}><option value="">Tous les techniciens</option><option value="none">Non assignées</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name??p.id.slice(0,6)}</option>)}</select>
      <input type="date" value={from} onChange={e=>setFrom(e.target.value)} aria-label="Du"/><input type="date" value={to} onChange={e=>setTo(e.target.value)} aria-label="Au"/></div>
    <Err e={err||msg}/><div className="card"><table className="tbl"><thead><tr><th>Date</th><th>Client</th><th>Adresse</th><th>Technicien</th><th>Statut</th><th/></tr></thead><tbody>
      {rows.map(i=><tr key={i.id}><td>{dayOf(i.scheduled_at)}<div className="mute">{hhmm(i.scheduled_at)}</div></td><td><b>{i.client}</b><div className="mute">{i.ref}</div></td><td>{[i.address,i.city].filter(Boolean).join(', ')}</td>
        <td><TechSel v={i.assigned_to} set={x=>upd(i.id,{assigned_to:x})} blank="Non assignée"/></td>
        <td><select value={i.status} onChange={e=>upd(i.id,{status:e.target.value})}>{ST.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></td>
        <td><button className="ghost" onClick={()=>setDetail(i)}>Détails</button> <button className="ghost" onClick={()=>del(i.id)}>Supprimer</button></td></tr>)}</tbody></table>
      {r&&!rows.length&&<p className="mute">Aucune intervention.</p>}<p className="mute">{rows.length} ligne(s)</p></div>
    {modal==='new'&&<Modal title="Nouvelle intervention" onClose={()=>setModal('')}><NewInt onDone={done}/></Modal>}
    {modal==='import'&&<Modal title="Importer des interventions" onClose={()=>setModal('')}><Import onDone={done}/></Modal>}
    {detail&&<Modal title={`Détails · ${detail.client}`} onClose={()=>setDetail(null)}>
      <p><b>Adresse :</b> {[detail.address,detail.city].filter(Boolean).join(', ')||'—'}</p>
      {detail.ref&&<p><b>Référence dossier :</b> {detail.ref}</p>}
      {detail.notes&&<p><b>Notes :</b> {detail.notes}</p>}
      {detail.details&&Object.entries(detail.details).map(([key,value])=><p key={key}><b>{key} :</b> {value||'—'}</p>)}
      {!detail.details&&!detail.notes&&<p className="mute">Aucun détail complémentaire.</p>}
    </Modal>}</>
}
function NewInt({onDone}:{onDone:()=>void}){
  const blank={ref:'',client:'',address:'',city:'',postal:'',date:today(),time:'09:00',assigned:null as string|null,notes:'',vid:'',energy:'',steps:'Planifié',ecs:'',display:'',department:'',enterprise:'',residentName:'',residentFirstName:'',email:'',phone:'',residence:'',building:'',floor:'',apartment:'',heating:'',installationType:'',housingType:'',surface:'',radiators:'',statusKo:'',motifKo:'',motifSavKo:''},[f,setF]=useState(blank),[err,setErr]=useState('')
  const inp=(k:'ref'|'client'|'address'|'city'|'notes',l:string)=><label>{l}<input value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/></label>
  const save=async()=>{if(!f.client.trim())return setErr('Le client est obligatoire.')
    const details={vid:f.vid||null,type_energie:f.energy||null,steps:f.steps||null,option_ecs:f.ecs||null,departement:f.department||null,option_afficheur:f.display||null,entreprise_technicien:f.enterprise||null,nom_occupant:f.residentName||null,prenom_occupant:f.residentFirstName||null,email_occupant:f.email||null,telephone_mobile_occupant:f.phone||null,residence:f.residence||null,escalier_batiment:f.building||null,etage:f.floor||null,numero_logement:f.apartment||null,type_chauffage:f.heating||null,type:f.installationType||null,type_logement:f.housingType||null,code_postal:f.postal||null,surface_logement:f.surface||null,nombre_radiateurs:f.radiators||null,statut_ko:f.statusKo||null,motif_ko:f.motifKo||null,motif_sav_ko:f.motifSavKo||null}
    const cleanDetails=Object.fromEntries(Object.entries(details).filter(([,v])=>v!==null))
    const{error}=await supabase.from('interventions').insert({ref:f.ref||null,client:f.client,address:f.address||null,city:f.city||null,postal_code:f.postal||null,scheduled_at:new Date(`${f.date}T${f.time}`).toISOString(),assigned_to:f.assigned,notes:f.notes||null,details:cleanDetails});if(error)return setErr(error.message);onDone()}
  return <><h3>Intervention</h3>{inp('client','Client')}{inp('ref','Référence dossier')}{inp('address','Adresse logement')}{inp('city','Ville')}
    <label>Code postal<input value={f.postal} onChange={e=>setF({...f,postal:e.target.value})}/></label>
    <div className="grid2"><label>Date<input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label><label>Heure<input type="time" value={f.time} onChange={e=>setF({...f,time:e.target.value})}/></label></div>
    <label>Technicien<TechSel v={f.assigned} set={x=>setF({...f,assigned:x})} blank="Non assignée"/></label>
    <h3>Logement</h3><div className="grid2">
      <label>VID<input value={f.vid} onChange={e=>setF({...f,vid:e.target.value})}/></label><label>Type d'énergie<input value={f.energy} onChange={e=>setF({...f,energy:e.target.value})}/></label>
      <label>Statut / steps<input value={f.steps} onChange={e=>setF({...f,steps:e.target.value})}/></label><label>Option ECS<input value={f.ecs} onChange={e=>setF({...f,ecs:e.target.value})}/></label>
      <label>Option afficheur<input value={f.display} onChange={e=>setF({...f,display:e.target.value})}/></label><label>Département<input value={f.department} onChange={e=>setF({...f,department:e.target.value})}/></label>
      <label>Entreprise technicien<input value={f.enterprise} onChange={e=>setF({...f,enterprise:e.target.value})}/></label><label>Résidence<input value={f.residence} onChange={e=>setF({...f,residence:e.target.value})}/></label>
      <label>Escalier / bâtiment<input value={f.building} onChange={e=>setF({...f,building:e.target.value})}/></label><label>Étage<input value={f.floor} onChange={e=>setF({...f,floor:e.target.value})}/></label>
      <label>N° logement<input value={f.apartment} onChange={e=>setF({...f,apartment:e.target.value})}/></label><label>Type chauffage<input value={f.heating} onChange={e=>setF({...f,heating:e.target.value})}/></label>
      <label>Type<input value={f.installationType} onChange={e=>setF({...f,installationType:e.target.value})}/></label><label>Type logement<input value={f.housingType} onChange={e=>setF({...f,housingType:e.target.value})}/></label>
      <label>Surface logement<input value={f.surface} onChange={e=>setF({...f,surface:e.target.value})}/></label><label>Nombre radiateurs<input value={f.radiators} onChange={e=>setF({...f,radiators:e.target.value})}/></label>
    </div><h3>Occupant</h3><div className="grid2">
      <label>Nom occupant<input value={f.residentName} onChange={e=>setF({...f,residentName:e.target.value})}/></label><label>Prénom occupant<input value={f.residentFirstName} onChange={e=>setF({...f,residentFirstName:e.target.value})}/></label>
      <label>Email occupant<input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label><label>Téléphone mobile occupant<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label>
    </div><h3>Commentaires et anomalies</h3>
    <label>Statut KO<input value={f.statusKo} onChange={e=>setF({...f,statusKo:e.target.value})}/></label><label>Motif KO<input value={f.motifKo} onChange={e=>setF({...f,motifKo:e.target.value})}/></label><label>Motif SAV KO<input value={f.motifSavKo} onChange={e=>setF({...f,motifSavKo:e.target.value})}/></label>
    {inp('notes','Commentaire technicien')}<Err e={err}/><button onClick={save}>Créer</button></>
}
function Import({onDone}:{onDone:()=>void}){
  const[recs,setRecs]=useState<ReturnType<typeof toRecords>>([]),[tech,setTech]=useState<string|null>(null),[err,setErr]=useState('')
  const onFile=async(f?:File)=>{if(!f)return;setErr('')
    try{const rows=/\.xlsx$/i.test(f.name)?(await readXlsxFile(f)).map(r=>r.map(c=>c instanceof Date?c.toLocaleDateString('sv'):String(c??''))):parseCsv(await f.text());setRecs(toRecords(rows))}catch{setErr('Fichier illisible (.xlsx ou .csv).')}}
  const good=recs.filter(r=>r.client&&parseDate(r.date))
  const go=async()=>{const{error}=await supabase.from('interventions').insert(good.map(r=>{
    const details=r.details??{}
    const start=r.time.trim()
    const time=/^\d{1,2}:\d{2}/.test(start)?start.padStart(5,'0'): /^\d{1,2}$/.test(start)?`${start.padStart(2,'0')}:00`:'09:00'
    return{ref:r.ref||null,client:r.client,address:r.address||null,city:r.city||null,
    postal_code:details['code postal']||null,
    scheduled_at:new Date(`${parseDate(r.date)}T${time}`).toISOString(),assigned_to:tech,details:Object.keys(details).length?details:null}
  }));if(error)return setErr(error.message);onDone()}
  return <><p className="mute">Colonnes reconnues : client/occupant, adresse logement/adresse, ville, date RDV, heure de début, référence dossier, ainsi que tous les autres champs détaillés.</p>
    <label>Fichier .xlsx ou .csv<input type="file" accept=".xlsx,.csv" onChange={e=>onFile(e.target.files?.[0])}/></label>
    <label>Assigner à<TechSel v={tech} set={setTech} blank="Non assignée"/></label>
    {recs.length>0&&<p><b>{good.length}</b> ligne(s) valide(s) sur {recs.length}{good.length<recs.length&&<span className="err"> — {recs.length-good.length} ignorée(s) (client ou date manquant)</span>}</p>}
    <Err e={err}/><button disabled={!good.length} onClick={go}>Importer {good.length||''} intervention(s)</button></>
}

/* ---------- PV ---------- */
type PVr={id:string;outcome:string;work_done:string|null;ended_at:string|null;signature:string|null;photo_paths:string[]|null;interventions:{client:string;address:string|null;city:string|null}|null;profiles:{full_name:string|null}|null}
export function PVs(){
  const{r,err}=useQ<PVr>(()=>supabase.from('pv').select('id,outcome,work_done,ended_at,signature,photo_paths,interventions(client,address,city),profiles(full_name)').order('ended_at',{ascending:false}).limit(300))
  const[open,setOpen]=useState<PVr|null>(null),[urls,setUrls]=useState<string[]>([])
  useEffect(()=>{setUrls([]);const p=open?.photo_paths??[];if(!p.length)return;supabase.storage.from('pv-photos').createSignedUrls(p,3600).then(x=>setUrls((x.data??[]).map(d=>d.signedUrl).filter((u):u is string=>!!u)))},[open])
  return <><h1>Procès-verbaux</h1><Err e={err}/><div className="card"><table className="tbl"><thead><tr><th>Date</th><th>Client</th><th>Technicien</th><th>Résultat</th><th>Photos</th></tr></thead><tbody>
    {(r??[]).map(p=><tr key={p.id} className="click" onClick={()=>setOpen(p)}><td>{p.ended_at?`${dayOf(p.ended_at)} ${hhmm(p.ended_at)}`:'—'}</td><td>{p.interventions?.client}</td><td>{p.profiles?.full_name}</td>
      <td><span className={`chip ${p.outcome==='ok'?'terminee':'a_replanifier'}`}>{p.outcome==='ok'?'OK':'KO'}</span></td><td>{p.photo_paths?.length??0}</td></tr>)}</tbody></table>{r&&!r.length&&<p className="mute">Aucun PV.</p>}</div>
    {open&&<Modal title={`PV · ${open.interventions?.client??''}`} onClose={()=>setOpen(null)}>
      <p className="mute">{[open.interventions?.address,open.interventions?.city].filter(Boolean).join(', ')} · {open.profiles?.full_name}</p>
      <p>{open.work_done||<span className="mute">Aucun commentaire.</span>}</p>
      {urls.length>0&&<div className="photos">{urls.map((u,i)=><a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Photo ${i+1}`}/></a>)}</div>}
      {open.signature&&<><h2>Signature du client</h2><img className="sig" src={open.signature} alt="Signature"/></>}</Modal>}</>
}

/* ---------- Activité ---------- */
type Act={tech_id:string;day:string;hours:number;km:number;fees:number}
export function Activite(){
  const{profiles}=useCtx(),[m,setM]=useState(today().slice(0,7))
  const start=`${m}-01`,end=(()=>{const d=new Date(`${m}-01T12:00`);d.setMonth(d.getMonth()+1);return d.toLocaleDateString('sv')})()
  const{r,err}=useQ<Act>(()=>supabase.from('activity').select('tech_id,day,hours,km,fees').gte('day',start).lt('day',end).order('day'),[m])
  const tot=profiles.map(p=>{const x=(r??[]).filter(a=>a.tech_id===p.id);return{p,j:x.length,h:x.reduce((s,a)=>s+Number(a.hours),0),km:x.reduce((s,a)=>s+Number(a.km),0),f:x.reduce((s,a)=>s+Number(a.fees),0)}}).filter(t=>t.j>0)
  const exp=()=>download(`activite-${m}.csv`,toCsv([['Technicien','Jour','Heures','Km','Frais (€)'],...(r??[]).map(a=>[nm(profiles,a.tech_id),a.day,a.hours,a.km,a.fees])]))
  return <><div className="row"><h1>Activité</h1><span><input type="month" value={m} onChange={e=>setM(e.target.value||m)}/> <button className="ghost" onClick={exp}>Exporter CSV</button></span></div><Err e={err}/>
    <div className="card"><table className="tbl"><thead><tr><th>Technicien</th><th>Jours</th><th>Heures</th><th>Km</th><th>Frais</th></tr></thead><tbody>
      {tot.map(t=><tr key={t.p.id}><td>{t.p.full_name}</td><td>{t.j}</td><td>{num(t.h)}</td><td>{num(t.km)}</td><td>{eur(t.f)}</td></tr>)}</tbody></table>{r&&!tot.length&&<p className="mute">Aucune activité déclarée ce mois-ci.</p>}</div>
    <div className="card"><h2>Détail</h2><table className="tbl"><tbody>{(r??[]).map(a=><tr key={a.tech_id+a.day}><td>{a.day}</td><td>{nm(profiles,a.tech_id)}</td><td>{num(Number(a.hours))} h</td><td>{num(Number(a.km))} km</td><td>{eur(Number(a.fees))}</td></tr>)}</tbody></table></div></>
}

/* ---------- Équipe ---------- */
export function Equipe(){
  const{profiles,me,reload}=useCtx(),[msg,setMsg]=useState('')
  const set=async(id:string,role:string)=>{const{error}=await supabase.from('profiles').update({role}).eq('id',id);setMsg(error?.message??'');reload()}
  return <><h1>Équipe</h1><Err e={msg}/><div className="card"><table className="tbl"><thead><tr><th>Nom</th><th>Code apporteur</th><th>Rôle</th></tr></thead><tbody>
    {profiles.map(p=><tr key={p.id}><td>{p.full_name}{p.id===me.id&&<span className="mute"> (vous)</span>}</td><td>{p.referral_code}</td>
      <td><select value={p.role} disabled={p.id===me.id} onChange={e=>set(p.id,e.target.value)}><option value="tech">Technicien</option><option value="admin">Administrateur</option></select></td></tr>)}</tbody></table>
    <p className="mute">Pour ajouter quelqu'un : Supabase &gt; Authentication &gt; Users &gt; Add user. Il apparaît ici dès sa première connexion.</p></div></>
}

/* ---------- Stock ---------- */
export function Stock(){
  const{r,err,load}=useQ<Stk>(()=>supabase.from('stock_items').select('*').order('name'))
  const blank={name:'',barcode:'',qty:'',assigned:null as string|null},[f,setF]=useState(blank),[msg,setMsg]=useState(''),{profiles}=useCtx()
  const add=async()=>{if(!f.name.trim()||!f.barcode.trim())return setMsg('Nom et code-barres obligatoires.')
    const{error}=await supabase.from('stock_items').insert({name:f.name,barcode:f.barcode.trim(),qty:Math.max(0,Math.floor(+f.qty||0)),assigned_to:f.assigned});if(error)return setMsg(error.message);setMsg('');setF(blank);load()}
  const setQty=async(id:string,v:string)=>{const{error}=await supabase.from('stock_items').update({qty:Math.max(0,Math.floor(+v||0))}).eq('id',id);setMsg(error?.message??'');load()}
  const del=async(id:string)=>{if(!confirm('Supprimer cet article ?'))return;await supabase.from('stock_items').delete().eq('id',id);load()}
  return <><h1>Stock</h1><div className="card"><h2>Confier du matériel</h2><div className="filters"><input placeholder="Nom" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/><input placeholder="Code-barres" value={f.barcode} onChange={e=>setF({...f,barcode:e.target.value})}/>
    <input placeholder="Quantité" inputMode="numeric" value={f.qty} onChange={e=>setF({...f,qty:e.target.value})}/><TechSel v={f.assigned} set={x=>setF({...f,assigned:x})} blank="Non assigné"/><button onClick={add}>Ajouter</button></div></div>
    <Err e={err||msg}/><div className="card"><table className="tbl"><thead><tr><th>Article</th><th>Code-barres</th><th>Technicien</th><th>Quantité</th><th/></tr></thead><tbody>
    {(r??[]).map(s=><tr key={s.id}><td><b>{s.name}</b></td><td>{s.barcode}</td><td>{profiles.find(p=>p.id===s.assigned_to)?.full_name??'—'}</td>
      <td><input style={{width:80}} defaultValue={s.qty} key={s.qty} inputMode="numeric" onBlur={e=>{if(e.target.value!==String(s.qty))setQty(s.id,e.target.value)}}/>{s.qty<=2&&<span className="chip a_replanifier"> bas</span>}</td>
      <td><button className="ghost" onClick={()=>del(s.id)}>Supprimer</button></td></tr>)}</tbody></table>{r&&!r.length&&<p className="mute">Aucun article.</p>}</div></>
}

/* ---------- Documents ---------- */
export function Documents(){
  const{profiles}=useCtx(),{r,err}=useQ<Doc>(()=>supabase.from('documents').select('*').order('expires_on',{ascending:true,nullsFirst:false})),t=today(),soon=plus(30)
  const[vmsg,setVmsg]=useState('')
  const view=async(p:string)=>setVmsg(await openStored('documents',p))
  return <><h1>Documents</h1><Err e={err||vmsg}/><div className="card"><table className="tbl"><thead><tr><th>Technicien</th><th>Type</th><th>Intitulé</th><th>Expiration</th><th/></tr></thead><tbody>
    {(r??[]).map(d=><tr key={d.id}><td>{nm(profiles,d.tech_id)}</td><td>{d.type}</td><td>{d.title}</td><td>{d.expires_on?<span className={`chip ${d.expires_on<t?'a_replanifier':d.expires_on<=soon?'en_cours':'terminee'}`}>{d.expires_on}</span>:'—'}</td><td><button className="ghost" onClick={()=>view(d.file_path)}>Ouvrir</button></td></tr>)}</tbody></table>{r&&!r.length&&<p className="mute">Aucun document.</p>}</div></>
}

/* ---------- Factures ---------- */
type Inv={id:string;tech_id:string;number:string;client:string;amount:number;status:string;created_at:string}
const IS:[string,string][]=[['brouillon','Brouillon'],['envoyee','Envoyée'],['payee','Payée']]
export function Factures(){
  const{profiles}=useCtx(),{r,err,load}=useQ<Inv>(()=>supabase.from('invoices').select('*').order('created_at',{ascending:false})),[msg,setMsg]=useState('')
  const set=async(id:string,status:string)=>{const{error}=await supabase.from('invoices').update({status}).eq('id',id);setMsg(error?.message??'');load()}
  const sum=(s:string)=>(r??[]).filter(i=>i.status===s).reduce((a,i)=>a+Number(i.amount),0)
  const exp=()=>download('factures.csv',toCsv([['Numéro','Date','Technicien','Client','Montant','Statut'],...(r??[]).map(i=>[i.number,dayOf(i.created_at),nm(profiles,i.tech_id),i.client,i.amount,IS.find(s=>s[0]===i.status)?.[1]??i.status])]))
  return <><div className="row"><h1>Factures</h1><button className="ghost" onClick={exp}>Exporter CSV</button></div><Err e={err||msg}/>
    <div className="grid4"><div className="card"><div className="mute">À envoyer</div><div className="big">{eur(sum('brouillon'))}</div></div><div className="card"><div className="mute">En attente de paiement</div><div className="big">{eur(sum('envoyee'))}</div></div><div className="card"><div className="mute">Payées</div><div className="big">{eur(sum('payee'))}</div></div></div>
    <div className="card"><table className="tbl"><thead><tr><th>N°</th><th>Date</th><th>Technicien</th><th>Client</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
    {(r??[]).map(i=><tr key={i.id}><td><b>{i.number}</b></td><td>{dayOf(i.created_at)}</td><td>{nm(profiles,i.tech_id)}</td><td>{i.client}</td><td>{eur(Number(i.amount))}</td>
      <td><select value={i.status} onChange={e=>set(i.id,e.target.value)}>{IS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></td></tr>)}</tbody></table>{r&&!r.length&&<p className="mute">Aucune facture.</p>}</div></>
}

/* ---------- Apporteurs ---------- */
type Ref={id:string;referrer_id:string;kind:string;paid:boolean;created_at:string}
export function Apporteurs(){
  const{profiles}=useCtx(),{r,err,load}=useQ<Ref>(()=>supabase.from('referrals').select('*').order('created_at',{ascending:false})),[msg,setMsg]=useState('')
  const add=async(id:string,kind:string)=>{const{error}=await supabase.from('referrals').insert({referrer_id:id,kind});setMsg(error?.message??'');load()}
  const pay=async(id:string,paid:boolean)=>{const{error}=await supabase.from('referrals').update({paid}).eq('id',id);setMsg(error?.message??'');load()}
  const all=r??[]
  return <><h1>Apporteurs</h1><Err e={err||msg}/><div className="card"><table className="tbl"><thead><tr><th>Apporteur</th><th>Code</th><th>Demandes</th><th>Installations</th><th>Récompense due</th><th/></tr></thead><tbody>
    {profiles.map(p=>{const x=all.filter(a=>a.referrer_id===p.id),due=x.filter(a=>a.kind==='installation'&&!a.paid).length*REWARD
      return <tr key={p.id}><td>{p.full_name}</td><td>{p.referral_code}</td><td>{x.length}</td><td>{x.filter(a=>a.kind==='installation').length}</td><td><b>{eur(due)}</b></td>
        <td><button className="ghost" onClick={()=>add(p.id,'demande')}>+ demande</button> <button className="ghost" onClick={()=>add(p.id,'installation')}>+ installation</button></td></tr>})}</tbody></table>
    <p className="mute">Récompense : {REWARD} € par installation. Les demandes venant du site se saisissent ici à la main pour l'instant.</p></div>
    <div className="card"><h2>Historique</h2><table className="tbl"><tbody>{all.map(a=><tr key={a.id}><td>{dayOf(a.created_at)}</td><td>{nm(profiles,a.referrer_id)}</td><td>{a.kind==='installation'?'Installation':'Demande'}</td>
      <td>{a.kind==='installation'&&<button className="ghost" onClick={()=>pay(a.id,!a.paid)}>{a.paid?'Payée ✓ (annuler)':'Marquer payée'}</button>}</td></tr>)}</tbody></table>{r&&!r.length&&<p className="mute">Aucun parrainage.</p>}</div></>
}
