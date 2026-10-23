import { FieldValue } from 'firebase-admin/firestore';
import { AdminError } from './adminRequest.ts';
import { searchSources, SEARCH_VERSION, normalizeSearch, searchDocument, searchIndexId, matchesSearch, type SearchSource } from './searchIndex.ts';
const sources=Object.keys(searchSources) as SearchSource[];
const statePath='adminSearchControl/state';
export async function adminSearch(db:any,input:any){
 if(input.action==='search-record'){
  if(!Object.hasOwn(searchSources,input.source)||typeof input.id!=='string'||!input.id||input.id.includes('/')||input.id.length>1500)throw new AdminError(400,'سجل البحث غير صالح.');
  const snapshot=await db.doc(input.source+'/'+input.id).get();if(!snapshot.exists)throw new AdminError(404,'السجل لم يعد موجودًا.');
  const data=snapshot.data(),record=searchDocument(input.source,input.id,data);if(!record)throw new AdminError(404,'السجل لم يعد متاحًا في البحث.');
  const labels:Record<string,string>={name:'الاسم',fullName:'الاسم',nameEn:'الاسم بالإنجليزية',sku:'كود الصنف',brand:'العلامة التجارية',category:'التصنيف',description:'الوصف',storeName:'المتجر',locationInDistrict:'العنوان',type:'نوع النشاط',price:'السعر',inStock:'متاح للطلب',archived:'مؤرشف',available:'متاح',promoted:'مميز',orderNumber:'رقم الطلب',profileName:'العميل',phone:'الهاتف',email:'البريد',ministry:'الوزارة / الجهة',floorNumber:'الدور',roomNumber:'الغرفة',orderStatus:'حالة الطلب',itemsSummary:'الأصناف',total:'إجمالي الطلب',courierName:'المندوب',role:'الدور',status:'الحالة',code:'الكود',title:'العنوان',storeId:'معرّف المتجر',catalogItemId:'معرّف الصنف',variantId:'معرّف المتغير',stockQuantity:'الكمية المسجلة',active:'نشط',preparationMinutes:'دقائق التجهيز',action:'العملية',actorEmail:'المنفّذ',entityType:'نوع السجل',entityId:'معرّف السجل'};
  const fields=Object.entries(labels).filter(([key])=>data[key]!==undefined&&data[key]!==null&&typeof data[key]!=='object').map(([key,label])=>({label,value:String(data[key]).slice(0,1000)}));
  return{source:input.source,id:snapshot.id,label:record.title,group:searchSources[input.source as SearchSource],fields,catalogItemId:typeof data.catalogItemId==='string'?data.catalogItemId:''};
 }
 if(input.action==='search-sync'){
  // Bounded, resumable reconciliation. Read live source documents in the transaction so a concurrent edit cannot overwrite newer index content.
  return db.runTransaction(async(tx:any)=>{
   const ref=db.doc(statePath),snapshot=await tx.get(ref);const old=snapshot.data();
   const reset=input.restart===true&&old?.complete===true;
   const state=!old||old.version!==SEARCH_VERSION||reset?{version:SEARCH_VERSION,sourceIndex:0,cursor:null,processed:0,complete:false}:old;
   if(state.complete)return{...state,updatedAt:state.updatedAt?.toDate?.().toISOString()||null};
   const source=sources[state.sourceIndex];let query=db.collection(source).orderBy('__name__').limit(60);if(state.cursor)query=query.startAfter(state.cursor);
   const rows=await tx.get(query);for(const row of rows.docs){const indexed=searchDocument(source,row.id,row.data()),ref=db.doc('adminSearchIndex/'+searchIndexId(source,row.id));if(indexed)tx.set(ref,{...indexed,indexedAt:FieldValue.serverTimestamp()});else tx.delete(ref);}
   const nextSource=rows.size===60?state.sourceIndex:state.sourceIndex+1;
   const next={version:SEARCH_VERSION,sourceIndex:nextSource,cursor:rows.size===60?rows.docs.at(-1).id:null,processed:state.processed+rows.size,complete:nextSource>=sources.length,updatedAt:FieldValue.serverTimestamp()};tx.set(ref,next);
   return{...next,sourceLabel:searchSources[source],updatedAt:null};
  });
 }
 if(input.action!=='search')throw new AdminError(400,'عملية بحث غير صالحة.');
 if(typeof input.query!=='string'||input.query.length>160)throw new AdminError(400,'اكتب بحثًا لا يتجاوز 160 حرفًا.');
 const term=normalizeSearch(input.query);if(term.length<2)throw new AdminError(400,'اكتب حرفين على الأقل للبحث.');
 if(input.source&&!Object.hasOwn(searchSources,input.source))throw new AdminError(400,'نوع البحث غير صالح.');
 const state=(await db.doc(statePath).get()).data();
 const key=term.split(' ').sort((a,b)=>b.length-a.length)[0].slice(0,32);
 if(input.cursor&&(typeof input.cursor!=='string'||!/^[a-f0-9]{64}$/.test(input.cursor)))throw new AdminError(400,'مؤشر البحث غير صالح.');
 const build=(filtered:boolean)=>{let q=db.collection('adminSearchIndex').where('prefixes','array-contains',key);if(filtered&&input.source)q=q.where('source','==',input.source);return input.cursor?q.orderBy('__name__').startAfter(input.cursor):q;};
 let rows,filterOptimized=true;
 try{rows=await build(true).limit(61).get();}catch(error){
  // Single-field array indexes work immediately. Until the optional composite is published, page over the global index and apply the source filter after retrieval.
  if(!input.source||!['9','failed-precondition'].includes(String((error as any)?.code)))throw error;
  filterOptimized=false;rows=await build(false).limit(61).get();
 }
 const docs=rows.docs.slice(0,60);
 const candidates=docs.filter((d:any)=>d.data().version===SEARCH_VERSION&&Object.hasOwn(searchSources,d.data().source)&&(!input.source||d.data().source===input.source)&&matchesSearch(d.data(),term));
 // Rehydrate from current records: stale or deleted indexed records cannot leak obsolete values.
 const live=candidates.length?await db.getAll(...candidates.map((d:any)=>db.doc(d.data().source+'/'+d.data().entityId))):[];
 const results=live.flatMap((d:any,i:number)=>{
  if(!d.exists)return[];const source=candidates[i].data().source as SearchSource;
  const fresh=searchDocument(source,d.id,d.data());if(!fresh||!matchesSearch(fresh,term))return[];
  return[{source,id:d.id,label:fresh.title,detail:fresh.detail,group:searchSources[source],catalogItemId:source==='merchantOffers'?String(d.data().catalogItemId||''):undefined}];
 }).sort((a:any,b:any)=>(normalizeSearch(a.label)===term?-1:0)-(normalizeSearch(b.label)===term?-1:0));
 // Omit undefined fields for JSON-compatible consumers.
 return{filterOptimized,results:results.map(({catalogItemId,...row}:any)=>({...row,...(catalogItemId?{catalogItemId}:{})})),nextCursor:rows.size>60?docs.at(-1).id:null,indexReady:state?.version===SEARCH_VERSION&&state.complete===true,indexedCount:state?.processed||0,lastSyncedAt:state?.updatedAt?.toDate?.().toISOString()||null};
}
