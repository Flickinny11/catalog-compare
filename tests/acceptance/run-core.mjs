import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const coreArgument=process.argv[2];
if(!coreArgument){console.error('Usage: node run-core.mjs <path/to/core.mjs> [results-directory]');process.exit(2);}
const corePath=path.resolve(coreArgument);
const resultDirectory=path.resolve(process.argv[3] || path.join(here,'results'));
const fixtureDirectory=path.join(here,'fixtures');
fs.mkdirSync(resultDirectory,{recursive:true});
const api=await import(pathToFileURL(corePath));
const manifest=JSON.parse(fs.readFileSync(path.join(fixtureDirectory,'expected-results.json'),'utf8'));
const results=[];
const reports=path.join(resultDirectory,'reports'); fs.mkdirSync(reports,{recursive:true});
function check(id,fn){try{fn();results.push({id,passed:true});}catch(error){results.push({id,passed:false,error:error.message});}}
const load=n=>api.parseCSV(fs.readFileSync(path.join(fixtureDirectory,n),'utf8'),manifest.files[n].delimiter);
for(const [name,spec] of Object.entries(manifest.files)){
 check(`parse:${name}`,()=>{
  if(!spec.valid_csv){assert.throws(()=>load(name),new RegExp(`Record ${spec.logical_record}:`));return;}
  const table=load(name); assert.deepEqual(table.headers,spec.header);
  assert.deepEqual(table.rows,spec.rows.map((values,i)=>({record:i+2,values})));
 });
}
for(const spec of manifest.comparison_cases){
 check(`compare:${spec.id}`,()=>{
  const before=load(spec.before),after=load(spec.after),o=spec.options;
  const actual=api.compareTables(before,after,{
   beforeKey:before.headers.indexOf(o.before_sku_column),beforeValue:before.headers.indexOf(o.before_value_column),
   afterKey:after.headers.indexOf(o.after_sku_column),afterValue:after.headers.indexOf(o.after_value_column),
   beforeDecimal:o.before_decimal==='comma'?',':'.',afterDecimal:o.after_decimal==='comma'?',':'.',trimKeys:o.trim_skus});
  const e={...spec.expected.counts};
  if('invalid_keyed' in e){e.invalid=e.invalid_keyed+e.unkeyed_invalid_rows;delete e.invalid_keyed;delete e.unkeyed_invalid_rows;}
  assert.deepEqual(actual.counts,e);
  for(const expected of spec.expected.rows){
   const found=actual.rows.filter(r=>r.key===expected.sku);assert.equal(found.length,1,`Expected one output for ${JSON.stringify(expected.sku)}`);
   const r=found[0];assert.equal(r.status,expected.status,`${expected.sku} status`);
   if(expected.before_numeric!==undefined && r.beforeNumber!==undefined)assert.equal(r.beforeNumber,expected.before_numeric);
   if(expected.after_numeric!==undefined && r.afterNumber!==undefined)assert.equal(r.afterNumber,expected.after_numeric);
   if(expected.delta!==undefined)assert.equal(Number(r.delta),Number(expected.delta),`${expected.sku} delta`);
   if(expected.before_records)assert.deepEqual(r.before.map(x=>x.record),expected.before_records);
   if(expected.after_records)assert.deepEqual(r.after.map(x=>x.record),expected.after_records);
  }
  if(spec.expected.unkeyed_invalid_records){for(const side of ['before','after'])assert.deepEqual(actual.rows.filter(r=>!r.key.trim()).flatMap(r=>r[side].map(x=>x.record)),spec.expected.unkeyed_invalid_records[side]);}
  assert.deepEqual(actual.sourceCounts,{before:before.rows.length,after:after.rows.length});
  fs.writeFileSync(path.join(reports,spec.id+'.csv'),api.reportCSV(actual));
  fs.writeFileSync(path.join(reports,spec.id+'.json'),JSON.stringify(actual,null,2));
 });
}
for(const cell of manifest.comparison_cases.find(x=>x.id==='formula-looking-sku-and-report').expected.report_text_cells){
 check('report-cell:'+JSON.stringify(cell.raw),()=>assert.equal(api.safeReportCell(cell.raw),cell.safe_csv_cell_content));
}
const valid=['0','-0','+0','000012.300',' 12.30 ','-12.50'];
const expected=['0','0','0','12.3','12.3','-12.5'];
valid.forEach((raw,i)=>check('decimal-valid:'+JSON.stringify(raw),()=>assert.deepEqual(api.parseDecimal(raw,'.'),{ok:true,value:expected[i]})));
for(const raw of ['',' ','\t','12,30','$12','1e3','0x10','1.2.3','Infinity','NaN','12xyz','1_000','12.',' .5','1 000','1\u00a0000','=1+1'])
 check('decimal-reject:'+JSON.stringify(raw),()=>assert.equal(api.parseDecimal(raw,'.').ok,false));
check('semicolon-quoted',()=>assert.deepEqual(api.parseCSV('SKU;Price;Desc\r\nA;12,50;"a;b"\r\n',';').rows[0].values,['A','12,50','a;b']));
check('tab-quoted',()=>assert.deepEqual(api.parseCSV('SKU\tPrice\tDesc\nA\t12.50\t"a\tb"\n','\t').rows[0].values,['A','12.50','a\tb']));
for(const text of ['','SKU,Price\r\n','SKU,SKU\r\nA,1\r\n','SKU, \r\nA,1\r\n'])check('invalid-header:'+JSON.stringify(text),()=>assert.throws(()=>api.parseCSV(text)));
check('10000-row-boundary',()=>assert.equal(api.parseCSV('SKU,Price\n'+Array.from({length:10000},(_,i)=>`A${i},1`).join('\n')).rows.length,10000));
check('10001-row-rejected',()=>assert.throws(()=>api.parseCSV('SKU,Price\n'+Array.from({length:10001},(_,i)=>`A${i},1`).join('\n')),/10,000/));
check('prototype-property-keys',()=>{const b=api.parseCSV('SKU,Price\n__proto__,1\nconstructor,2\ntoString,3');assert.deepEqual(api.compareTables(b,b,{beforeKey:0,beforeValue:1,afterKey:0,afterValue:1}).counts,{changed:0,unchanged:3,added:0,removed:0,conflict:0,invalid:0});});
// Additional source-review hypothesis: an unmatched row still needs numeric validation.
check('unmatched-invalid-values',()=>{
 const before=api.parseCSV('SKU,Price\nOLD-EMPTY,\nOLD-BAD,1x\nGOOD,1');
 const after=api.parseCSV('SKU,Price\nNEW-EMPTY,\nNEW-BAD,1x\nGOOD,1');
 const result=api.compareTables(before,after,{beforeKey:0,beforeValue:1,afterKey:0,afterValue:1});
 assert.equal(result.counts.invalid,4,'Missing/malformed values on unmatched rows must still be flagged as numeric exceptions');
});
// Limits are tested on decoded field lengths, including the escaped-quote path.
for (const count of [199,200]) check(`columns-${count}-accepted`,()=>{
 const header=Array.from({length:count},(_,i)=>`H${i}`).join(',');
 const data=Array.from({length:count},()=>'x').join(',');
 assert.equal(api.parseCSV(header+'\r\n'+data).headers.length,count);
});
check('columns-201-rejected',()=>{
 const header=Array.from({length:201},(_,i)=>`H${i}`).join(',');
 const data=Array.from({length:201},()=>'x').join(',');
 assert.throws(()=>api.parseCSV(header+'\r\n'+data),/200 columns/);
});
check('data-record-201-fields-rejected',()=>assert.throws(()=>api.parseCSV('SKU,Price\r\n'+Array.from({length:201},()=>'x').join(',')),/200 columns/));
for (const quoted of [false,true]) for (const size of [65535,65536,65537]) check(`field-${quoted?'quoted':'plain'}-${size}`,()=>{
 const content='x'.repeat(size),encoded=quoted?'"'+content+'"':content;
 const csv='SKU,Price,Description\r\nA,1,'+encoded+'\r\n';
 if(size<=65536)assert.equal(api.parseCSV(csv).rows[0].values[2],content);
 else assert.throws(()=>api.parseCSV(csv),/65,536-character/);
});
for(const size of [65536,65537])check(`escaped-quote-field-${size}`,()=>{
 const csv='SKU,Price,Description\r\nA,1,"'+'""'.repeat(size)+'"\r\n';
 if(size===65536)assert.equal(api.parseCSV(csv).rows[0].values[2],'"'.repeat(size));
 else assert.throws(()=>api.parseCSV(csv),/65,536-character/);
});
check('unicode-field-at-65536-code-units',()=>{
 const value='🧾'.repeat(32768);assert.equal(value.length,65536);
 assert.equal(api.parseCSV('SKU,Price,Description\nA,1,"'+value+'"').rows[0].values[2],value);
});
check('unicode-field-over-65536-code-units',()=>assert.throws(()=>api.parseCSV('SKU,Price,Description\nA,1,"'+'🧾'.repeat(32768)+'x"'),/65,536-character/));
check('quoted-newlines-at-field-boundary',()=>{
 const value='x'.repeat(65534)+'\r\n';assert.equal(api.parseCSV('SKU,Price,Description\r\nA,1,"'+value+'"').rows[0].values[2],value);
});
check('header-field-over-limit',()=>assert.throws(()=>api.parseCSV('SKU,'+'H'.repeat(65537)+'\nA,1'),/65,536-character/));
check('numeric-100-character-boundary',()=>assert.equal(api.parseDecimal('9'.repeat(100)).ok,true));
check('numeric-101-character-rejected',()=>assert.equal(api.parseDecimal('9'.repeat(101)).ok,false));

const output={date:new Date().toISOString(),coreFile:path.basename(corePath),coreSha256:createHash('sha256').update(fs.readFileSync(corePath)).digest('hex'),passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results};
fs.writeFileSync(path.join(resultDirectory,'core-results.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({passed:output.passed,failed:output.failed,failures:results.filter(x=>!x.passed),coreSha256:output.coreSha256},null,2));

process.exitCode=output.failed ? 1 : 0;
