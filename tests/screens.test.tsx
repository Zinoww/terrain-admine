// @vitest-environment jsdom
import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest'
import {render,screen,cleanup,waitFor,fireEvent,within} from '@testing-library/react'
import {readFileSync} from 'node:fs'
const norm=(s:string)=>s.replace(/[\u202f\u00a0]/g,' ')
const money=(v:string)=>(c:string)=>norm(c)===v

const fx=vi.hoisted(()=>({data:{} as Record<string,any[]>,uid:'a1',session:true,profilesError:'',signedError:'',writes:[] as {table:string;op:string;args:any[]}[]}))
vi.mock('../src/lib/supabase',()=>{
  const chain=(t:string)=>{const p:any=new Proxy(function(){},{get:(_,k:string)=>{
    if(k==='then')return(res:any,rej:any)=>Promise.resolve(t==='profiles'&&fx.profilesError?{data:null,error:{message:fx.profilesError}}:{data:fx.data[t]??[],error:null}).then(res,rej)
    if(['insert','update','upsert','delete'].includes(k))return(...args:any[])=>{fx.writes.push({table:t,op:k,args});return p}
    return()=>p},apply:()=>p});return p}
  return{supabase:{from:chain,
    storage:{from:()=>({createSignedUrl:async()=>fx.signedError?({data:null,error:{message:fx.signedError}}):({data:{signedUrl:'https://signed/doc.pdf'},error:null}),createSignedUrls:async(paths:string[])=>({data:paths.map(p=>({signedUrl:'https://signed/'+p})),error:null})})},
    auth:{getSession:async()=>({data:{session:fx.session?{user:{id:fx.uid,email:fx.uid+'@x.fr'}}:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({}),signInWithPassword:async()=>({error:null})}}}})
import App from '../src/App'

const iso=(plus:number,h=9)=>{const d=new Date();d.setDate(d.getDate()+plus);d.setHours(h,0,0,0);return d.toISOString()}
const month=new Date().toLocaleDateString('sv').slice(0,7)
const visit=(hash:string)=>{window.location.hash=hash;return render(<App/>)}
const text=async(t:string|RegExp)=>expect((await screen.findAllByText(t)).length).toBeGreaterThan(0)
const last=()=>fx.writes[fx.writes.length-1]
beforeEach(()=>{
  fx.uid='a1';fx.session=true;fx.profilesError='';fx.signedError='';fx.writes=[]
  fx.data={profiles:[{id:'a1',full_name:'Admin',role:'admin',referral_code:'AAA111'},{id:'t1',full_name:'Tech Un',role:'tech',referral_code:'BBB222'}],
    interventions:[{id:'i1',ref:'R1',client:'Mme Lefèvre',address:'12 rue A',city:'Rouen',scheduled_at:iso(0),status:'planifiee',assigned_to:'a1'},
      {id:'i2',ref:'R2',client:'M. Benali',address:'5 rue B',city:'Elbeuf',scheduled_at:iso(-1),status:'planifiee',assigned_to:'t1'},
      {id:'i3',ref:'R3',client:'Mme Roussel',address:null,city:null,scheduled_at:iso(3),status:'terminee',assigned_to:null}],
    pv:[{id:'p1',outcome:'ok',work_done:'Chaudière remplacée',ended_at:iso(0,10),signature:'data:image/png;base64,AAAA',photo_paths:['t1/p1/0.jpg'],interventions:{client:'Mme Lefèvre',address:'12 rue A',city:'Rouen'},profiles:{full_name:'Tech Un'}}],
    activity:[{tech_id:'t1',day:`${month}-02`,hours:7.5,km:40,fees:10},{tech_id:'t1',day:`${month}-03`,hours:6,km:20,fees:5.5}],
    stock_items:[{id:'s1',barcode:'111',name:'Vanne',qty:1,assigned_to:'t1'},{id:'s2',barcode:'222',name:'Joint',qty:20,assigned_to:null}],
    documents:[{id:'d1',tech_id:'t1',type:'Kbis / avis SIRENE',title:'Kbis Tech',issued_on:null,expires_on:iso(10).slice(0,10),file_path:'t1/kbis.pdf'},{id:'d2',tech_id:'a1',type:'Assurance',title:'Assurance vieille',issued_on:null,expires_on:'2020-01-01',file_path:'a1/a.pdf'}],
    invoices:[{id:'v1',tech_id:'t1',number:'F-1',client:'C1',amount:1000,status:'payee',created_at:iso(-5)},{id:'v2',tech_id:'t1',number:'F-2',client:'C2',amount:250.5,status:'envoyee',created_at:iso(-2)},{id:'v3',tech_id:'a1',number:'F-3',client:'C3',amount:80,status:'brouillon',created_at:iso(-1)}],
    referrals:[{id:'r1',referrer_id:'t1',kind:'demande',paid:false,created_at:iso(-3)},{id:'r2',referrer_id:'t1',kind:'installation',paid:false,created_at:iso(-2)},{id:'r3',referrer_id:'t1',kind:'installation',paid:true,created_at:iso(-1)}]}
  vi.stubGlobal('confirm',()=>true);vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:()=>'blob:x',revokeObjectURL:()=>{}}))
})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()})

describe('accès',()=>{
  it('sans session → écran de connexion',async()=>{fx.session=false;visit('#/');await text('Se connecter')})
  it('compte technicien → Droits insuffisants avec e-mail et rôle lu',async()=>{fx.uid='t1';visit('#/');await text('Droits insuffisants');await text('t1@x.fr');await text(/Rôle de ce compte : tech/)})
  it('profil illisible → affiche la VRAIE erreur (pas un faux « pas admin »)',async()=>{fx.profilesError='column "referral_code" does not exist';visit('#/');await text(/Erreur de lecture du profil : column "referral_code" does not exist/)})
  it('administrateur → tableau de bord + les 9 entrées du menu',async()=>{visit('#/');await text('Tableau de bord');for(const l of['Interventions','PV','Activité','Stock','Documents','Factures','Apporteurs','Équipe'])await text(l)})
})
describe('tableau de bord',()=>{
  it('compteurs, techniciens, documents à renouveler, stock bas',async()=>{
    visit('#/');await text('sur 3 au total');await text('Kbis Tech');await text('Assurance vieille');await text('Stock bas (2 ou moins)');await text('Vanne')})
})
describe('interventions',()=>{
  it('liste, recherche, filtres statut et technicien',async()=>{
    visit('#/interventions');await text('Mme Lefèvre');await text('3 ligne(s)')
    fireEvent.change(screen.getByPlaceholderText('Rechercher…'),{target:{value:'benali'}});await waitFor(()=>expect(screen.queryByText('Mme Lefèvre')).toBeNull());await text('M. Benali')
    fireEvent.change(screen.getByPlaceholderText('Rechercher…'),{target:{value:''}})
    const [statusFilter,techFilter]=screen.getAllByRole('combobox')
    fireEvent.change(statusFilter,{target:{value:'terminee'}});await waitFor(()=>expect(screen.queryByText('M. Benali')).toBeNull());await text('Mme Roussel')
    fireEvent.change(statusFilter,{target:{value:''}})
    fireEvent.change(techFilter,{target:{value:'none'}});await waitFor(()=>expect(screen.queryByText('Mme Lefèvre')).toBeNull());await text('Mme Roussel')})
  it('changer le statut envoie la bonne mise à jour',async()=>{
    visit('#/interventions');const row=(await screen.findByText('Mme Lefèvre')).closest('tr')!
    fireEvent.change(within(row).getByDisplayValue('Planifiée'),{target:{value:'en_cours'}})
    await waitFor(()=>expect(last()).toMatchObject({table:'interventions',op:'update',args:[{status:'en_cours'}]}))})
  it('réassigner envoie assigned_to',async()=>{
    visit('#/interventions');const row=(await screen.findByText('Mme Roussel')).closest('tr')!
    fireEvent.change(within(row).getByDisplayValue('Non assignée'),{target:{value:'t1'}})
    await waitFor(()=>expect(last()).toMatchObject({op:'update',args:[{assigned_to:'t1'}]}))})
  it('supprimer (avec confirmation)',async()=>{
    visit('#/interventions');const row=(await screen.findByText('M. Benali')).closest('tr')!;fireEvent.click(within(row).getByText('Supprimer'))
    await waitFor(()=>expect(last()).toMatchObject({table:'interventions',op:'delete'}))})
  it('créer : client obligatoire puis envoi correct',async()=>{
    visit('#/interventions');fireEvent.click(await screen.findByText('+ Nouvelle'));fireEvent.click(screen.getByText('Créer'));await text('Le client est obligatoire.')
    fireEvent.change(screen.getByLabelText('Client'),{target:{value:'Nouveau client'}});fireEvent.change(screen.getByLabelText('Ville'),{target:{value:'Rouen'}})
    fireEvent.change(screen.getByLabelText('Date'),{target:{value:'2026-12-01'}});fireEvent.change(screen.getByLabelText('Heure'),{target:{value:'14:30'}})
    fireEvent.click(screen.getByText('Créer'))
    await waitFor(()=>expect(last()).toMatchObject({table:'interventions',op:'insert'}))
    const row=last().args[0];expect(row).toMatchObject({client:'Nouveau client',city:'Rouen',assigned_to:null});expect(new Date(row.scheduled_at).getTime()).toBe(new Date('2026-12-01T14:30').getTime())})
  it('IMPORT du fichier CSV fourni : 8 valides sur 9, envoi de 8 lignes assignées',async()=>{
    const csv=readFileSync(process.cwd()+'/test-data/interventions-test.csv','utf8')
    visit('#/interventions');fireEvent.click(await screen.findByText('Importer'))
    const file=new File([csv],'i.csv',{type:'text/csv'});Object.defineProperty(file,'text',{value:async()=>csv})
    fireEvent.change(screen.getByLabelText(/Fichier .xlsx/),{target:{files:[file]}})
    await text(/valide\(s\) sur 9/);await text(/1 ignorée/)
    fireEvent.change(screen.getByLabelText('Assigner à'),{target:{value:'t1'}});fireEvent.click(screen.getByText(/Importer 8 intervention/))
    await waitFor(()=>expect(last()).toMatchObject({table:'interventions',op:'insert'}))
    const rows=last().args[0];expect(rows).toHaveLength(8);expect(rows[0]).toMatchObject({client:'Mme Lefèvre',city:'Rouen',ref:'TEST-X01',assigned_to:'t1'})
    expect(new Date(rows[0].scheduled_at).getTime()).toBe(new Date('2026-11-16T08:30').getTime());expect(rows[6].address).toBe('Résidence Les Pins; bât. B')})
  it('export CSV déclenche un téléchargement',async()=>{
    const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
    visit('#/interventions');fireEvent.click(await screen.findByText('Exporter CSV'));expect(click).toHaveBeenCalledTimes(1)})
})
describe('PV',()=>{
  it('liste puis détail : commentaire, photo, signature',async()=>{
    visit('#/pv');fireEvent.click(await screen.findByText('Mme Lefèvre'));await text('Chaudière remplacée')
    expect(await screen.findByAltText('Photo 1')).toHaveProperty('src','https://signed/t1/p1/0.jpg');expect(screen.getByAltText('Signature')).toHaveProperty('src','data:image/png;base64,AAAA')})
})
describe('activité',()=>{
  it('totaux du mois par technicien',async()=>{visit('#/activite');const t=within((await screen.findAllByRole('table'))[0]);await waitFor(()=>expect(t.getByText('Tech Un')).toBeTruthy());expect(t.getByText('13,5')).toBeTruthy();expect(t.getByText('60')).toBeTruthy();expect(t.getByText(money('15,50 €'))).toBeTruthy()})
})
describe('équipe',()=>{
  it('changer un rôle ; son propre rôle est verrouillé',async()=>{
    visit('#/equipe');const row=(await within(await screen.findByRole('table')).findByText('Tech Un')).closest('tr')!
    fireEvent.change(within(row).getByDisplayValue('Technicien'),{target:{value:'admin'}})
    await waitFor(()=>expect(last()).toMatchObject({table:'profiles',op:'update',args:[{role:'admin'}]}))
    const mine=within(screen.getByRole('table')).getByText(/\(vous\)/).closest('tr')!;expect((within(mine).getByDisplayValue('Administrateur') as HTMLSelectElement).disabled).toBe(true)})
})
describe('stock',()=>{
  it('ajout : champs obligatoires puis envoi',async()=>{
    visit('#/stock');fireEvent.click(await screen.findByText('Ajouter'));await text('Nom et code-barres obligatoires.')
    fireEvent.change(screen.getByPlaceholderText('Nom'),{target:{value:'Câble'}});fireEvent.change(screen.getByPlaceholderText('Code-barres'),{target:{value:' 999 '}});fireEvent.change(screen.getByPlaceholderText('Quantité'),{target:{value:'7'}})
    fireEvent.click(screen.getByText('Ajouter'));await waitFor(()=>expect(last()).toMatchObject({table:'stock_items',op:'insert',args:[{name:'Câble',barcode:'999',qty:7,assigned_to:null}]}))})
  it('badge « bas », modification de quantité, suppression',async()=>{
    visit('#/stock');const row=(await screen.findByText('Vanne')).closest('tr')!;expect(within(row).getByText(/bas/)).toBeTruthy()
    const q=within(row).getByDisplayValue('1');fireEvent.change(q,{target:{value:'12'}});fireEvent.blur(q)
    await waitFor(()=>expect(last()).toMatchObject({table:'stock_items',op:'update',args:[{qty:12}]}))
    fireEvent.click(within(row).getByText('Supprimer'));await waitFor(()=>expect(last()).toMatchObject({op:'delete'}))})
})
describe('documents : bouton Ouvrir',()=>{
  it('ouvre le fichier (lien signé)',async()=>{
    const w={location:{href:''},close:vi.fn()};vi.stubGlobal('open',vi.fn(()=>w))
    visit('#/documents');const row=(await screen.findByText('Kbis Tech')).closest('tr')!;fireEvent.click(within(row).getByText('Ouvrir'))
    await waitFor(()=>expect(w.location.href).toBe('https://signed/doc.pdf'))})
  it('fichier introuvable → message visible',async()=>{
    fx.signedError='Object not found';const w={location:{href:''},close:vi.fn()};vi.stubGlobal('open',vi.fn(()=>w))
    visit('#/documents');const row=(await screen.findByText('Kbis Tech')).closest('tr')!;fireEvent.click(within(row).getByText('Ouvrir'))
    await text(/Fichier introuvable/);expect(w.close).toHaveBeenCalled()})
})
describe('factures et apporteurs',()=>{
  it('totaux et changement de statut',async()=>{
    visit('#/factures');await screen.findByText('F-3');expect(screen.getAllByText(money('1 000,00 €')).length).toBeGreaterThan(0);expect(screen.getAllByText(money('250,50 €')).length).toBeGreaterThan(0);expect(screen.getAllByText(money('80,00 €')).length).toBeGreaterThan(0)
    const row=(await screen.findByText('F-3')).closest('tr')!;fireEvent.change(within(row).getByDisplayValue('Brouillon'),{target:{value:'payee'}})
    await waitFor(()=>expect(last()).toMatchObject({table:'invoices',op:'update',args:[{status:'payee'}]}))})
  it('apporteurs : récompense due, ajout et paiement',async()=>{
    visit('#/apporteurs');await screen.findAllByText('Tech Un');expect(screen.getAllByText(money('100,00 €')).length).toBeGreaterThan(0)   // 1 installation non payée × 100 €
    const row=within(screen.getAllByRole('table')[0]).getByText('Tech Un').closest('tr')!;fireEvent.click(within(row).getByText('+ installation'))
    await waitFor(()=>expect(last()).toMatchObject({table:'referrals',op:'insert',args:[{referrer_id:'t1',kind:'installation'}]}))
    fireEvent.click((await screen.findAllByText('Marquer payée'))[0]);await waitFor(()=>expect(last()).toMatchObject({op:'update',args:[{paid:true}]}))})
})
