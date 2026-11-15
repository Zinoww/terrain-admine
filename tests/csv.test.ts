import {describe,it,expect} from 'vitest'
import {parseCsv,toCsv,parseDate,toRecords,norm} from '../src/lib/csv'
describe('csv',()=>{
  it('détecte ; ou , et gère les guillemets et retours à la ligne',()=>{
    expect(parseCsv('a;b;c\n1;"x;y";3')).toEqual([['a','b','c'],['1','x;y','3']])
    expect(parseCsv('a,b\r\n"il dit ""oui""","l1\nl2"\r\n')).toEqual([['a','b'],['il dit "oui"','l1\nl2']])
    expect(parseCsv('a;b\n\n;\n1;2')).toEqual([['a','b'],['1','2']])})
  it('toCsv échappe et reste relisible (aller-retour)',()=>{
    const rows=[['Client','Adresse'],['Dupont; fils','12 "rue"\nRouen'],['',null as unknown as string]]
    const out=toCsv(rows);expect(out.startsWith('\ufeff')).toBe(true)
    expect(parseCsv(out.slice(1))).toEqual([['Client','Adresse'],['Dupont; fils','12 "rue"\nRouen']])})
  it('parseDate accepte plusieurs formats',()=>{
    expect(parseDate('2026-11-14')).toBe('2026-11-14');expect(parseDate('14/11/2026')).toBe('2026-11-14');expect(parseDate('4.1.2027')).toBe('2027-01-04')
    expect(parseDate('demain')).toBeNull();expect(parseDate('')).toBeNull()})
  it('toRecords reconnaît les en-têtes avec accents et majuscules',()=>{
    const r=toRecords(parseCsv('Client;Adresse;Ville;Date;Heure;Référence\nMartin;1 rue A;Rouen;14/11/2026;14:30;R1'))
    expect(r).toEqual([{client:'Martin',address:'1 rue A',city:'Rouen',date:'14/11/2026',time:'14:30',ref:'R1'}])})
  it('heure par défaut 09:00, fichier vide sans erreur',()=>{expect(toRecords(parseCsv('client;date\nA;2026-11-14'))[0].time).toBe('09:00');expect(toRecords([])).toEqual([])})
  it('norm',()=>expect(norm('  Référence ')).toBe('reference'))
})
