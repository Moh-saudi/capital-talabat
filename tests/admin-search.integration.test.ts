import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {adminSearch} from '../server/adminSearch.ts';
import {auditInTransaction} from '../server/audit.ts';
import {searchIndexId} from '../server/searchIndex.ts';

test('real indexed queries cover unloaded records, reconcile pages, hydrate fresh values and remove deleted results',async()=>{
 assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'This test must run only against the local emulator.');
 const app=initializeApp({projectId:'demo-capital-search'},'search-integration'),db=getFirestore(app);
 try{
  const batch=db.batch();for(let i=0;i<135;i++)batch.set(db.doc('products/item-'+String(i).padStart(3,'0')),{name:'قهوة للاختبار '+i,sku:'CT-'+i,brand:'اختبار',price:20});
  batch.set(db.doc('users/unloaded-user'),{fullName:'أحمد خارج الصفحة',email:'search@example.com',phone:'01017799580',walletBalance:123456});
  batch.set(db.doc('orders/mobile-order'),{orderNumber:'CT-MOBILE',profileName:'عميل الموبايل',otpCode:'8765'});
  await batch.commit();
  let state:any;let pages=0;do{state=await adminSearch(db,{action:'search-sync'});pages++;assert.ok(pages<50);}while(!state.complete);
  assert.ok(pages>11,'large collections reconcile using bounded pages');
  let cursor:null|string=null;const ids=new Set<string>();do{const page=await adminSearch(db,{action:'search',query:'قهوة',cursor});for(const row of page.results)ids.add(row.id);cursor=page.nextCursor;}while(cursor);
  assert.equal(ids.size,135);
  const user=await adminSearch(db,{action:'search',query:'احمد خارج',source:'users'});assert.equal(user.results[0].id,'unloaded-user');
  const details=await adminSearch(db,{action:'search-record',source:'orders',id:'mobile-order'});assert.ok(!JSON.stringify(details).includes('8765'));
  await db.doc('users/unloaded-user').update({fullName:'اسم جديد'});
  assert.equal((await adminSearch(db,{action:'search',query:'احمد خارج'})).results.length,0,'stale index cannot display obsolete data');
  await db.runTransaction(async tx=>{const ref=db.doc('products/new-item');await tx.get(ref);const data={name:'منتج جديد لحظي',sku:'FRESH-1'};tx.set(ref,data);auditInTransaction(db,tx,{uid:'admin',email:'admin@example.com'},'products.create','products','new-item',null,data);});
  assert.equal((await adminSearch(db,{action:'search',query:'لحظي'})).results[0].id,'new-item','admin writes index in the same transaction');
  await db.doc('products/new-item').delete();assert.equal((await adminSearch(db,{action:'search',query:'لحظي'})).results.length,0);
  const indexed=await db.doc('adminSearchIndex/'+searchIndexId('users','unloaded-user')).get();assert.ok(!JSON.stringify(indexed.data()).includes('123456'));
  await db.doc('users/mobile-new').set({fullName:'تسجيل موبايل جديد',email:'new@example.com'});
  state=await adminSearch(db,{action:'search-sync',restart:true});while(!state.complete)state=await adminSearch(db,{action:'search-sync'});
  assert.equal((await adminSearch(db,{action:'search',query:'تسجيل موبايل'})).results[0].id,'mobile-new');
 }finally{await deleteApp(app);}
});
