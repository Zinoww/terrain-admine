import {createRoot} from 'react-dom/client'
import './styles.css'
import './logout.css'

const root=document.getElementById('root')!
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined

if(!url||!key){
  root.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui;background:#eef1f4;color:#14232b"><div style="max-width:560px;padding:24px;background:white;border-radius:12px"><h1>Configuration Supabase manquante</h1><p>Ajoutez les secrets <b>VITE_SUPABASE_URL</b> et <b>VITE_SUPABASE_ANON_KEY</b> dans GitHub, puis relancez le workflow GitHub Pages.</p></div></div>'
}else{
  Promise.all([import('./App'),import('./ErrorBoundary')]).then(([{default:App},{ErrorBoundary}])=>{
    createRoot(root).render(<ErrorBoundary><App/></ErrorBoundary>)
  }).catch(error=>{
    root.innerHTML=`<div style="padding:24px;font-family:system-ui"><h1>Une erreur est survenue</h1><p>${String(error?.message??error)}</p></div>`
  })
}
