export function parseCsv(text:string):string[][]{
  const first=text.split(/\r?\n/)[0]??'',d=(first.match(/;/g)?.length??0)>(first.match(/,/g)?.length??0)?';':','
  const rows:string[][]=[];let row:string[]=[],cur='',q=false
  for(let i=0;i<text.length;i++){const c=text[i]
    if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else if(c==='"')q=true
    else if(c===d){row.push(cur);cur=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cur);rows.push(row);row=[];cur=''}
    else cur+=c}
  if(cur!==''||row.length){row.push(cur);rows.push(row)}
  return rows.filter(r=>r.some(c=>c.trim()!==''))
}
// Protection « injection de formule » : Excel exécute une cellule texte qui commence par = + - @ (ou tabulation).
// On la préfixe d'une apostrophe. Les vrais nombres (type number) ne sont pas touchés.
const safe=(c:string|number|null|undefined)=>{const s=String(c??'');return typeof c==='string'&&/^[=+\-@\t\r]/.test(s)?`'${s}`:s}
export const toCsv=(rows:(string|number|null|undefined)[][])=>'\ufeff'+rows.map(r=>r.map(c=>{const s=safe(c);return /[";\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}).join(';')).join('\r\n')
export function download(name:string,content:string){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
export const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()
export function parseDate(s:string):string|null{
  const t=s.trim();let m=t.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return`${m[1]}-${m[2]}-${m[3]}`
  if(/^\d{10}$/.test(t)){const d=new Date(Number(t)*1000);if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,10)}
  m=t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if(m){
    if(t.includes('/')&&Number(m[2])>12)return`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
    if(t.includes('/')&&Number(m[1])>12)return`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
    if(t.includes('/'))return`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
    return`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  }
  m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if(m&&Number(m[1])>12)return`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
  if(m)return`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
  return null
}
export function toRecords(rows:string[][]){
  if(!rows.length)return[]
  const[h,...b]=rows,k=h.map(norm)
  const g=(r:string[],...names:string[])=>{for(const n of names){const i=k.indexOf(n);if(i>=0&&r[i]&&r[i].trim())return r[i].trim()}return''}
  return b.map(r=>{
    const record:any={client:g(r,'client','nom','nom occupant','occupant logement'),address:g(r,'adresse logement','adresse','address'),city:g(r,'ville','city'),date:g(r,'date rdv','date du rendez-vous (timestamp)','date'),time:g(r,'heure de debut','heure de début','heure','time')||'09:00',ref:g(r,'reference dossier','référence dossier','reference','ref')}
    const details:Record<string,string>={}
    for(let i=0;i<k.length;i++){
      const key=k[i],value=(r[i]??'').trim()
      if(value&&![ 'client','nom','adresse','address','ville','city','date','heure','time','reference','ref' ].includes(key))details[key]=value
    }
    if(Object.keys(details).length)record.details=details
    return record
  })
}
