import {supabase} from './supabase'
/** Ouvre un fichier privé du stockage dans un nouvel onglet. Retourne un message d'erreur, ou '' si tout va bien. */
export async function openStored(bucket:string,path:string):Promise<string>{
  const w=window.open('','_blank') // ouvert tout de suite (clic de l'utilisateur) pour ne pas être bloqué par le navigateur
  const{data,error}=await supabase.storage.from(bucket).createSignedUrl(path,120)
  if(error||!data?.signedUrl){w?.close();return /not found/i.test(error?.message??'')?'Fichier introuvable dans le stockage (document de test ?).':(error?.message??'Impossible de créer le lien du fichier.')}
  if(w)w.location.href=data.signedUrl;else window.location.href=data.signedUrl
  return ''
}
