import {Component,type ReactNode} from 'react'
export class ErrorBoundary extends Component<{children:ReactNode},{error:Error|null}>{
  state={error:null as Error|null}
  static getDerivedStateFromError(error:Error){return{error}}
  render(){
    if(!this.state.error)return this.props.children
    return <div style={{padding:24,maxWidth:560,margin:'0 auto',fontFamily:'system-ui'}}><h1>Une erreur est survenue</h1>
      <p style={{color:'#b3402f',fontWeight:600}}>{this.state.error.message}</p>
      <button style={{padding:'10px 16px'}} onClick={()=>location.reload()}>Recharger</button></div>}
}
