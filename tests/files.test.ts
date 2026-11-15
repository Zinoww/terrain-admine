import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import readXlsxFile from 'read-excel-file/node'
import {parseCsv,parseDate,toRecords} from '../src/lib/csv'
const file=(n:string)=>join(process.cwd(),'test-data',n)   // chemins compatibles Windows
const check=(recs:ReturnType<typeof toRecords>)=>{
  expect(recs).toHaveLength(9)
  const good=recs.filter(r=>r.client&&parseDate(r.date))
  expect(good).toHaveLength(8)
  expect(good[0]).toMatchObject({client:'Mme Lefèvre',city:'Rouen',time:'08:30',ref:'TEST-X01'})
  expect(parseDate(good[0].date)).toBe('2026-11-16')
  expect(good[6].address).toBe('Résidence Les Pins; bât. B')
  expect(recs[8].client).toBe('Client sans date')}
describe('fichiers de test fournis',()=>{
  it('CSV (UTF-8 avec BOM, ;)',()=>check(toRecords(parseCsv(readFileSync(file('interventions-test.csv'),'utf8')))))
  it('XLSX (vraies dates Excel)',async()=>{
    const rows=(await readXlsxFile(file('interventions-test.xlsx'))).map(r=>r.map(c=>c instanceof Date?c.toLocaleDateString('sv'):String(c??'')))
    check(toRecords(rows))})
})
