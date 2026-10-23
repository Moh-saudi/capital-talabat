import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSearch,searchDocument,searchIndexId,matchesSearch,writeSearchIndex} from '../server/searchIndex.ts';

test('Arabic search normalizes tashkeel, alef, tatweel, case and Arabic digits',()=>{
 assert.equal(normalizeSearch('إِبـراهِيم ١٢٣ ABC'),'ابراهيم 123 abc');
 const row=searchDocument('catalogItems','item',{name:'أُرْز بسمتي',sku:'SKU-123',brand:'Brand',variants:[{barcode:'6221234567',color:'أحمر'}]})!;
 assert.ok(row.prefixes.includes('ارز'));assert.ok(row.prefixes.includes('622123'));assert.ok(row.prefixes.includes('brand'));
 assert.ok(matchesSearch(row,'أرز Brand'));assert.ok(!matchesSearch(row,'أرز سكر'));
});
test('phone variants and exact identifiers remain searchable without indexing secrets',()=>{
 const row=searchDocument('orders','order',{orderNumber:'CT-555',profileName:'أحمد',phone:'+201017799580',otpCode:'8765',walletBalance:44444,paymentReference:'SECRET-PAY',privateKey:'SECRET-KEY',unitCost:789})!;
 assert.ok(row.prefixes.includes('010177'));assert.ok(row.prefixes.includes('201017'));assert.ok(row.prefixes.includes('555'));
 assert.ok(!JSON.stringify(row).includes('8765'));assert.ok(!row.text.includes('44444'));assert.ok(!row.text.includes('secret-pay'));assert.ok(!row.text.includes('secret-key'));
 const audit=searchDocument('auditLogs','event',{action:'user.update',actorEmail:'ADMIN@EXAMPLE.COM',before:{password:'old-password'},after:{otpCode:'1234'},request:{ip:'PRIVATE-IP'}})!;
 assert.ok(audit.prefixes.includes('example'));assert.ok(!JSON.stringify(audit).includes('password'));assert.ok(!audit.text.includes('private-ip'));
});
test('managed products and deleted users do not create duplicate or obsolete results',()=>{
 assert.equal(searchDocument('products','offer',{name:'صنف',merchantOfferId:'offer'}),null);
 assert.equal(searchDocument('users','deleted',{fullName:'حساب محذوف',deletedAt:{}}),null);
 assert.notEqual(searchIndexId('users','same'),searchIndexId('products','same'));
});
test('index writes use a supplied transaction; deletes remove the entry; unknown collections are ignored',()=>{
 const writes:any[]=[],db={doc:(path:string)=>({path})},tx={set:(ref:any,value:any)=>writes.push({ref,value}),delete:(ref:any)=>writes.push({ref,deleted:true})};
 writeSearchIndex(db,tx,'products','sku',{name:'منتج',price:10});assert.equal(writes.length,1);assert.equal(writes[0].value.title,'منتج');
 writeSearchIndex(db,tx,'products','sku',null);assert.equal(writes[1].deleted,true);
 writeSearchIndex(db,tx,'orderSecrets','sku',{otpCode:'1234'});assert.equal(writes.length,2);
});
test('index payloads have bounded tokens and explicitly omit merchant costs and stock from full text',()=>{
 const row=searchDocument('products','x',{name:'منتج',description:'كلمة '.repeat(50000),unitCost:91,cartonCost:1092,stockQuantity:123456})!;
 assert.ok(row.prefixes.length<=1800);assert.ok(row.text.length<=10000);assert.ok(!row.text.includes('1092'));assert.ok(!row.text.includes('123456'));
});
test('source filtering remains usable before the composite index is deployed; unsupported sources are rejected',async()=>{
 const {adminSearch}=await import('../server/adminSearch.ts');const indexed=searchDocument('users','user',{fullName:'مستخدم اختبار',email:'user@example.com'})!;
 let filtered=false;const db:any={doc:()=>({get:async()=>({data:()=>({version:1,complete:true,processed:1})})}),collection:()=>{const q:any={where:(key:string)=>{if(key==='source')filtered=true;return q;},limit:()=>q,get:async()=>{if(filtered){filtered=false;throw Object.assign(new Error('index not ready'),{code:9});}return{size:1,docs:[{id:searchIndexId('users','user'),data:()=>indexed}]};}};return q;},getAll:async()=>[{exists:true,id:'user',data:()=>({fullName:'مستخدم اختبار',email:'user@example.com'})}]};
 const result=await adminSearch(db,{action:'search',query:'مستخدم',source:'users'});assert.equal(result.filterOptimized,false);assert.equal(result.results[0].id,'user');
 await assert.rejects(()=>adminSearch({}, {action:'search',query:'اسم',source:'orderSecrets'}),/نوع البحث/);
 await assert.rejects(()=>adminSearch({}, {action:'search-record',source:'users',id:'a/b'}),/غير صالح/);
});
