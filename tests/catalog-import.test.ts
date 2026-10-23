import test from 'node:test';import assert from 'node:assert/strict';
import{parseCatalogRows}from'../src/utils/catalogImport.ts';import{importCatalogRow}from'../server/catalogImport.ts';
const header=['SKU','department','name','brand','unit','price','عدد الوحدات بالكرتونة','سعر الكرتونة جملة (ج.م)','سعر الوحدة جملة (ج.م)'];
const sheet=()=>[header,['SKU-1','ألبان','لبن','علامة اختبار','1 لتر',46,12,468,null],['الإجمالي / المتوسط']];
test('spreadsheet pricing formulas are derived without importing summary rows or inventing blank prices',()=>{
 const rows=parseCatalogRows(sheet());assert.equal(rows.length,1);assert.equal(rows[0].unitCost,39);assert.equal(rows[0].profit,7);assert.equal(rows[0].marginPercent,15.22);
 const missing=sheet();missing[1][5]=null;assert.ok(parseCatalogRows(missing)[0].errors.includes('سعر بيع مفقود أو غير صالح'));
 const duplicated=sheet();duplicated.push(duplicated[1]);assert.ok(parseCatalogRows(duplicated).every(r=>r.errors.includes('SKU مكرر في الملف')));
 assert.throws(()=>parseCatalogRows([['متوسط المبيعات'],[12]]));
});
function database(){const records=new Map<string,any>([['admins/admin',{exists:true}],['stores/store',{name:'متجر اختبار'}]]);let audit=0;return {records,doc:(path:string)=>({path}),collection:()=>({doc:()=>({path:'auditLogs/'+(++audit)})}),async runTransaction(fn:any){const writes:[string,any][]=[];const tx={get:async(ref:any)=>({exists:records.has(ref.path),data:()=>records.get(ref.path)}),set:(ref:any,data:any)=>writes.push([ref.path,data]),create:(ref:any,data:any)=>writes.push([ref.path,data])};const result=await fn(tx);for(const [key,value]of writes)records.set(key,value);return result;}};}
test('imports keep wholesale data private, create drafts, audit changes and retry without duplicates',async()=>{
 const db=database(),actor={uid:'admin',email:'test@example.com'},row=parseCatalogRows(sheet())[0];const input={storeId:'store',row,updateExisting:false};
 const first=await importCatalogRow(db,actor,input);assert.equal(first.status,'created');const product=db.records.get('products/'+first.id);assert.equal(product.inStock,false);for(const key of ['unitCost','profit','competitorPrice','cartonCost'])assert.equal(key in product,false);assert.equal(db.records.get('catalogPricing/'+first.id).unitCost,39);
 assert.equal((await importCatalogRow(db,actor,input)).status,'skipped');assert.equal([...db.records.keys()].filter(k=>k.startsWith('products/')).length,1);
 db.records.set('products/'+first.id,{...product,imageUrl:'https://example.com/a.webp',inStock:true});
 assert.equal((await importCatalogRow(db,actor,{...input,updateExisting:true,row:{...row,price:50}})).status,'updated');assert.equal(db.records.get('products/'+first.id).imageUrl,'https://example.com/a.webp');assert.equal(db.records.get('products/'+first.id).price,50);
 assert.equal([...db.records.keys()].filter(k=>k.startsWith('auditLogs/')).length,4);
});
test('server rejects forged rows and missing administrator rights without committing products',async()=>{
 const db=database(),row=parseCatalogRows(sheet())[0];await assert.rejects(()=>importCatalogRow(db,{uid:'admin'},{storeId:'store',row:{...row,price:null}}));
 await assert.rejects(()=>importCatalogRow(db,{uid:'not-admin'},{storeId:'store',row}));assert.equal([...db.records.keys()].filter(k=>k.startsWith('products/')).length,0);
});
