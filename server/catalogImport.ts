import {createHash} from 'node:crypto';
import {AdminError} from './adminRequest.ts';
import {parseCatalogRows,catalogProductName} from '../src/utils/catalogImport.ts';
import {auditInTransaction} from './audit.ts';
import {FieldValue} from 'firebase-admin/firestore';
export async function importCatalogRow(db:any,actor:any,input:any){
 const row=input.row,storeId=input.storeId;
 if(typeof row?.sourceAvailable!=='boolean'||(input.updateExisting!==undefined&&typeof input.updateExisting!=='boolean'))throw new AdminError(400,'راجع خيارات الاستيراد والتوافر.');
 if(typeof storeId!=='string'||!/^[\w-]{1,128}$/.test(storeId)||!row||typeof row!=='object')throw new AdminError(400,'اختر المتجر وراجع بيانات الصف.');
 // Re-parse trusted columns on the server; do not trust client-side validation or computed costs.
 const columns=['SKU','department','name','brand','unit','price','عدد الوحدات بالكرتونة','سعر الكرتونة جملة (ج.م)','سعر الوحدة جملة (ج.م)','متوسط سعر المنافسين - طلبات/إنستاشوب (ج.م)','حالة التوفر','imageUrl','imageSource','imageLicense'];
 let parsed;
 try{parsed=parseCatalogRows([columns,[row.sku,row.department,row.name,row.brand,row.unit,row.price,row.unitsPerCarton,row.cartonCost,row.unitCost,row.competitorPrice,row.sourceAvailable?'متوفر':'غير متوفر',row.imageUrl,row.imageSource,row.imageLicense]])[0];}catch{throw new AdminError(400,'راجع بيانات صف الاستيراد.');}
 if(!parsed||parsed.errors.length)throw new AdminError(400,parsed?.errors.join('، ')||'بيانات غير صالحة.');
 for(const key of ['department','brand','unit','imageSource','imageLicense'])if(String((parsed as any)[key]).length>500)throw new AdminError(400,'أحد حقول المنتج أطول من المسموح.');
 const id='sku-'+createHash('sha256').update(storeId+'\0'+parsed.sku).digest('hex').slice(0,40);
 return db.runTransaction(async(tx:any)=>{
  const ref=db.doc('products/'+id),pricing=db.doc('catalogPricing/'+id);
  const [own,store,current,oldPricing]=await Promise.all([tx.get(db.doc('admins/'+actor.uid)),tx.get(db.doc('stores/'+storeId)),tx.get(ref),tx.get(pricing)]);
  if(!own.exists)throw new AdminError(403,'انتهت صلاحية الإدارة.');
  if(!store.exists)throw new AdminError(404,'المتجر غير موجود.');
  if(current.exists&&!input.updateExisting)return {id,status:'skipped'};
  const before=current.data()||null;
  const imageUrl=parsed.imageUrl||before?.imageUrl||'';
  const after={...(before||{}),id,storeId,storeName:store.data().name,sku:parsed.sku,brand:parsed.brand,unit:parsed.unit,department:parsed.department,name:catalogProductName(parsed),description:[parsed.department,parsed.unit].filter(Boolean).join(' · '),price:parsed.price,originalPrice:parsed.price,category:'سوبر ماركت بالقطعة',imageType:before?.imageType||'croissant',imageUrl,archived:before?.archived||false,inStock:Boolean(before?.inStock&&!before?.archived&&parsed.sourceAvailable&&imageUrl)};
  if(parsed.imageUrl)delete after.imageVariants;
  const privateData={sku:parsed.sku,storeId,unitsPerCarton:parsed.unitsPerCarton,cartonCost:parsed.cartonCost,unitCost:parsed.unitCost,competitorPrice:parsed.competitorPrice,profit:parsed.profit,marginPercent:parsed.marginPercent,sourceAvailable:parsed.sourceAvailable,imageSource:parsed.imageUrl?parsed.imageSource:parsed.imageSource||oldPricing.data()?.imageSource||'',imageLicense:parsed.imageUrl?parsed.imageLicense:parsed.imageLicense||oldPricing.data()?.imageLicense||''};
  tx.set(ref,{...after,updatedAt:FieldValue.serverTimestamp()});tx.set(pricing,{...privateData,updatedAt:FieldValue.serverTimestamp()});
  auditInTransaction(db,tx,actor,'catalog.import.'+(before?'update':'create'),'products',id,before,after);
  auditInTransaction(db,tx,actor,'catalog.pricing.import','catalogPricing',id,oldPricing.data()||null,privateData);
  return {id,status:before?'updated':'created'};
 });
}
