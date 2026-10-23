import{randomUUID}from'node:crypto';import{FieldValue}from'firebase-admin/firestore';
import{AdminError,validId}from'./adminRequest.ts';import{auditInTransaction,auditSafe}from'./audit.ts';
import{catalogItemData,merchantOfferData,offerId,offerProduct}from'./catalogModel.ts';
import type{CatalogItem,MerchantOffer}from'../src/types/catalog.ts';
const fail=(message:string,status=400)=>{throw new AdminError(status,message);};
async function owner(tx:any,db:any,actor:any){if(!(await tx.get(db.doc('admins/'+actor.uid))).exists)fail('انتهت صلاحية الإدارة.',403);}
export async function catalogHub(db:any,actor:any,input:any){
 if(input.action==='catalog-items'){
  let q=db.collection('catalogItems').orderBy('__name__');if(input.cursor){validId(input.cursor);q=q.startAfter(input.cursor);}const rows=await q.limit(51).get();return{items:rows.docs.slice(0,50).map((d:any)=>({id:d.id,...auditSafe(d.data())})),nextCursor:rows.size>50?rows.docs[49].id:null};
 }
 if(input.action==='catalog-offers'){validId(input.itemId);const [item,rows]=await Promise.all([db.doc('catalogItems/'+input.itemId).get(),db.collection('merchantOffers').where('catalogItemId','==',input.itemId).limit(201).get()]);if(!item.exists)fail('الصنف غير موجود.',404);return{item:{id:item.id,...auditSafe(item.data())},offers:rows.docs.map((d:any)=>({id:d.id,...auditSafe(d.data())}))};}
 if(input.action==='catalog-history'){
  if(!['prices','inventory','specs'].includes(input.kind))fail('سجل غير صالح.');
  const id=input.kind==='specs'?input.itemId:input.offerId;validId(id);
  const collection=input.kind==='prices'?'catalogPriceHistory':input.kind==='inventory'?'catalogInventoryHistory':'catalogItemHistory';
  let q=db.collection(collection).doc(id).collection('events').orderBy('createdAt','desc');
  if(input.cursor){validId(input.cursor);const cursor=await db.doc(collection+'/'+id+'/events/'+input.cursor).get();if(!cursor.exists)fail('مؤشر غير صالح.');q=q.startAfter(cursor);}
  const rows=await q.limit(51).get();return{events:rows.docs.slice(0,50).map((d:any)=>({id:d.id,...auditSafe(d.data())})),nextCursor:rows.size>50?rows.docs[49].id:null};
 }
 if(input.action==='catalog-master-save'){
  const id=input.id||randomUUID();validId(id);const parsed=catalogItemData(input.data);const ref=db.doc('catalogItems/'+id);
  return db.runTransaction(async(tx:any)=>{
   await owner(tx,db,actor);const before=(await tx.get(ref)).data()||null;const offers=await tx.get(db.collection('merchantOffers').where('catalogItemId','==',id).limit(201));
   if(offers.size>200)fail('عدد العروض يتطلب تحديثًا مجزأً بواسطة مسؤول المنصة.');
   if(before&&input.expectedVersion!==before.version)fail('تغيّر الصنف منذ فتحه. حدّث البيانات ثم أعد المحاولة.',409);
   const after={...parsed,id,version:(before?.version||0)+1};
   if(offers.docs.some((d:any)=>!after.variants.some(v=>v.id===d.data().variantId)))fail('لا يمكن حذف متغير مرتبط بتجار؛ احتفظ به للحفاظ على عروضه وسجل حركاته.');
   if(before&&offers.docs.some((doc:any)=>{const old=before.variants.find((v:any)=>v.id===doc.data().variantId),next=after.variants.find(v=>v.id===doc.data().variantId);return old&&next&&['unit','weightGrams','size','color'].some(key=>old[key]!==next[key as keyof typeof next]);}))fail('لتغيير وحدة أو وزن أو مقاس أو لون متغير مرتبط بتجار، أضف متغيرًا جديدًا حتى لا يتغير معنى الأسعار والمخزون السابق.');
   for(const doc of offers.docs){const projection=offerProduct(after,doc.data());if(projection)tx.set(db.doc('products/'+doc.id),{...projection,updatedAt:FieldValue.serverTimestamp()});}
   tx.set(ref,{...after,updatedAt:FieldValue.serverTimestamp()});tx.create(db.collection('catalogItemHistory').doc(id).collection('events').doc(),{actorUid:actor.uid,actorEmail:actor.email||'',reason:String(input.reason||'تعديل مواصفات الصنف').slice(0,500),createdAt:FieldValue.serverTimestamp(),before,after});auditInTransaction(db,tx,actor,'catalog.item.'+(before?'update':'create'),'catalogItems',id,before,after,String(input.reason||'تعديل مواصفات الصنف').slice(0,500));return{item:after};
  });
 }
 if(input.action==='catalog-adopt'){
  validId(input.productId);const id=input.productId;
  return db.runTransaction(async(tx:any)=>{
   await owner(tx,db,actor);const old=await tx.get(db.doc('products/'+id)),master=await tx.get(db.doc('catalogItems/'+id));
   if(master.exists)return{item:{id,...master.data()},status:'existing'};
   if(!old.exists)fail('المنتج غير موجود.',404);const p=old.data();if(p.merchantOfferId)fail('هذا المنتج مرتبط بصنف مشترك بالفعل.');
   const store=p.storeId?await tx.get(db.doc('stores/'+p.storeId)):null;
   if(p.storeId&&!store?.exists)fail('متجر المنتج القديم غير موجود.');
   const item={id,version:1,...catalogItemData({name:p.name,sku:p.sku||'',brand:p.brand||'',description:p.description||'',imageUrl:p.imageUrl||'',kind:'grocery',archived:Boolean(p.archived),specs:{},variants:[{id:'base',label:p.unit||'الأساسي',unit:p.unit||'قطعة',size:'',color:'',barcode:'',weightGrams:null}]})};
   if(store){
    const price=typeof p.price==='number'&&Number.isFinite(p.price)&&p.price>=0?p.price:null;
    const stockQuantity=typeof p.stockQuantity==='number'&&Number.isFinite(p.stockQuantity)&&p.stockQuantity>=0?p.stockQuantity:null;
    const offer:MerchantOffer={id,catalogItemId:id,storeId:p.storeId,storeName:store.data().name,variantId:'base',price,stockQuantity,active:Boolean(p.inStock&&stockQuantity!==null&&stockQuantity>=1),notes:'',preparationMinutes:null,expiryDate:'',version:1};
    tx.set(db.doc('merchantOffers/'+id),{...offer,updatedAt:FieldValue.serverTimestamp()});
    const projection=offerProduct(item,offer);if(projection)tx.set(db.doc('products/'+id),{...projection,updatedAt:FieldValue.serverTimestamp()});
    auditInTransaction(db,tx,actor,'catalog.offer.adopt','merchantOffers',id,null,offer,'فصل بيانات الصنف عن عرض التاجر السابق');
    if(price!==null)tx.create(db.collection('catalogPriceHistory').doc(id).collection('events').doc(),{actorUid:actor.uid,actorEmail:actor.email||'',createdAt:FieldValue.serverTimestamp(),reason:'نقل السعر من الكتالوج السابق',before:null,after:price,itemId:id,storeId:p.storeId,variantId:'base'});
   }
   tx.set(db.doc('catalogItems/'+id),{...item,updatedAt:FieldValue.serverTimestamp()});tx.create(db.collection('catalogItemHistory').doc(id).collection('events').doc(),{actorUid:actor.uid,actorEmail:actor.email||'',reason:'تهيئة الصنف من الكتالوج السابق',createdAt:FieldValue.serverTimestamp(),before:null,after:item});auditInTransaction(db,tx,actor,'catalog.item.adopt','catalogItems',id,null,item);return{item,status:'created'};
  });
 }
 if(input.action==='catalog-assign'){
  validId(input.itemId);if(!Array.isArray(input.storeIds)||!input.storeIds.length||input.storeIds.length>50)fail('اختر من تاجر واحد إلى 50 تاجرًا في الدفعة.');const stores=[...new Set<string>(input.storeIds)];for(const id of stores)validId(id);
  return db.runTransaction(async(tx:any)=>{await owner(tx,db,actor);const itemDoc=await tx.get(db.doc('catalogItems/'+input.itemId));if(!itemDoc.exists)fail('الصنف غير موجود.',404);const item=itemDoc.data() as CatalogItem;if(!item.variants.some(v=>v.id===input.variantId))fail('اختر متغير الصنف.');const counts=await tx.get(db.collection('merchantOffers').where('catalogItemId','==',item.id).limit(201));const storeDocs=await Promise.all(stores.map(id=>tx.get(db.doc('stores/'+id))));const refs=stores.map(id=>{const known=counts.docs.find((d:any)=>d.data().storeId===id&&d.data().variantId===input.variantId);return db.doc('merchantOffers/'+(known?.id||offerId(item.id,id,input.variantId)));});const existing=await Promise.all(refs.map(ref=>tx.get(ref)));if(counts.size+existing.filter(d=>!d.exists).length>200)fail('الحد الحالي 200 عرض للصنف.');if(storeDocs.some(d=>!d.exists))fail('أحد التجار لم يعد موجودًا.',404);let created=0;
   refs.forEach((ref,index)=>{if(existing[index].exists)return;const offer:MerchantOffer={id:ref.id,catalogItemId:item.id,storeId:stores[index],storeName:storeDocs[index].data().name,variantId:input.variantId,price:null,stockQuantity:null,active:false,notes:'',preparationMinutes:null,expiryDate:'',version:1};tx.set(ref,{...offer,updatedAt:FieldValue.serverTimestamp()});auditInTransaction(db,tx,actor,'catalog.offer.assign','merchantOffers',ref.id,null,offer);created++;});return{created,skipped:refs.length-created};});
 }
 if(input.action==='catalog-offer-save'){
  validId(input.id);if(typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>500)fail('اكتب سببًا واضحًا للتغيير.');
  return db.runTransaction(async(tx:any)=>{await owner(tx,db,actor);const ref=db.doc('merchantOffers/'+input.id),snapshot=await tx.get(ref);if(!snapshot.exists)fail('العرض غير موجود.',404);const before=snapshot.data() as MerchantOffer;if(before.version!==input.expectedVersion)fail('تغيّر العرض منذ فتحه. حدّث الأسعار والمخزون ثم أعد المحاولة.',409);const itemDoc=await tx.get(db.doc('catalogItems/'+before.catalogItemId));if(!itemDoc.exists)fail('الصنف غير موجود.',404);const item=itemDoc.data() as CatalogItem;
   const parsed=merchantOfferData(input.data,item);if(parsed.variantId!==before.variantId)fail('لا يمكن نقل العرض إلى متغير آخر.');const after={...before,...parsed,version:before.version+1};const [store,currentProduct]=await Promise.all([tx.get(db.doc('stores/'+before.storeId)),tx.get(db.doc('products/'+before.id))]);if(!store.exists)fail('التاجر غير موجود.',404);after.storeName=store.data().name;
   const event={actorUid:actor.uid,actorEmail:actor.email||'',reason:input.reason.trim(),createdAt:FieldValue.serverTimestamp(),itemId:item.id,variantId:after.variantId,storeId:after.storeId};
   if(before.price!==after.price)tx.create(db.collection('catalogPriceHistory').doc(after.id).collection('events').doc(),{...event,before:before.price,after:after.price});
   if(before.stockQuantity!==after.stockQuantity)tx.create(db.collection('catalogInventoryHistory').doc(after.id).collection('events').doc(),{...event,before:before.stockQuantity,after:after.stockQuantity,delta:before.stockQuantity===null||after.stockQuantity===null?null:after.stockQuantity-before.stockQuantity});
   tx.set(ref,{...after,updatedAt:FieldValue.serverTimestamp()});const projection=offerProduct(item,after);if(projection)tx.set(db.doc('products/'+after.id),{...projection,updatedAt:FieldValue.serverTimestamp()});else if(currentProduct.exists)tx.set(db.doc('products/'+after.id),{...currentProduct.data(),inStock:false,updatedAt:FieldValue.serverTimestamp()});
   auditInTransaction(db,tx,actor,'catalog.offer.update','merchantOffers',after.id,before,after,input.reason);return{offer:after};});
 }
 fail('عملية كتالوج غير صالحة.');
}
