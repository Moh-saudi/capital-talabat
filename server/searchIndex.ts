import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';

export const SEARCH_VERSION=1;
export const searchSources={products:'منتجات',stores:'متاجر',catalogItems:'أصناف مشتركة',merchantOffers:'عروض تجار',orders:'طلبات',users:'مستخدمون',staff:'فريق التشغيل',partnerApplications:'طلبات شراكة',jobApplications:'طلبات توظيف',coupons:'خصومات',auditLogs:'سجل التدقيق'} as const;
export type SearchSource=keyof typeof searchSources;
export { normalizeSearch } from '../src/utils/searchText.ts';
import { normalizeSearch } from '../src/utils/searchText.ts';
const text=(value:unknown,max=160)=>typeof value==='string'||typeof value==='number'?String(value).slice(0,max):'';
export function searchDocument(source:SearchSource,id:string,data:any){
 if(!data||data.deletedAt||source==='products'&&data.merchantOfferId)return null;
 // Explicit allowlist only. Never index OTP, payment data, balances, costs, credentials or audit payloads.
 let title='',detail='',values:unknown[]=[];
 const common=[id];
 for(const phone of [data.phone,data.courierPhone]){const digits=String(phone||'').replace(/[^0-9٠-٩۰-۹]/g,'');if(digits){const normalized=normalizeSearch(digits);common.push(normalized);if(normalized.startsWith('20')&&normalized.length===12)common.push('0'+normalized.slice(2));if(normalized.startsWith('0')&&normalized.length===11)common.push('20'+normalized.slice(1));}}
 if(source==='products'||source==='catalogItems'){
  title=text(data.name);detail=[text(data.brand),text(data.category),text(data.storeName)].filter(Boolean).join(' · ');
  values=[data.sku,data.barcode,...(Array.isArray(data.variants)?data.variants.slice(0,20).map((v:any)=>v.barcode):[]),data.name,data.nameEn,data.brand,data.category,data.department,data.unit,...(Array.isArray(data.variants)?data.variants.slice(0,20).flatMap((v:any)=>[v.label,v.unit,v.size,v.color]):[]),...['ingredients','allergens','storage','portion','spiceLevel','variety','origin','grade','saleBasis'].map(key=>text(data.specs?.[key],120)),text(data.description,500)];
 }else if(source==='stores'){title=text(data.name);detail=[text(data.type),text(data.locationInDistrict)].filter(Boolean).join(' · ');values=[data.name,data.nameEn,data.type,data.category,data.locationInDistrict];}
 else if(source==='merchantOffers'){title=text(data.storeName)||id;detail='عرض تاجر · '+text(data.variantId);values=[data.storeName,data.catalogItemId,data.storeId,data.variantId];}
 else if(source==='orders'){title='#'+text(data.orderNumber||id);detail=[text(data.profileName),text(data.ministry)].filter(Boolean).join(' · ');values=[data.orderNumber,data.profileName,data.phone,data.ministry,data.floorNumber,data.roomNumber,data.courierName,data.courierPhone,data.itemsSummary];}
 else if(source==='users'||source==='staff'){title=text(data.fullName||data.name)||text(data.email)||id;detail=[text(data.email),text(data.phone),text(data.ministry)].filter(Boolean).join(' · ');values=[data.fullName,data.name,data.email,data.phone,data.ministry,data.role,data.storeId];}
 else if(source==='coupons'){title=text(data.title||data.code)||id;detail=text(data.description);values=[data.title,data.code,data.description];}
 else if(source==='auditLogs'){title=text(data.action)||id;detail=[text(data.actorEmail),text(data.entityType),text(data.entityId)].filter(Boolean).join(' · ');values=[data.action,data.actorEmail,data.actorUid,data.entityType,data.entityId,data.status];}
 else {title=text(data.fullName||data.name||data.storeName||data.restaurantName)||id;detail=[text(data.phone),text(data.email),text(data.status)].filter(Boolean).join(' · ');values=[data.fullName,data.name,data.storeName,data.restaurantName,data.phone,data.email,data.status,data.ministry,data.jobTitle];}
 const fields=[...common,...values].map(v=>normalizeSearch(text(v,1000))).filter(Boolean);
 const words=[...new Set(fields.flatMap(v=>[v,...v.split(/[\s@._+-]+/u)]))];
 const prefixes=new Set<string>();
 // Each source field is bounded; long descriptions cannot crowd out identifiers.
 for(const word of words){for(let n=2;n<=Math.min(word.length,32);n++)prefixes.add(word.slice(0,n));if(prefixes.size>=1800)break;}
 return{source,entityId:id,title:title.slice(0,160),detail:detail.slice(0,240),text:fields.join(' ').slice(0,10000),prefixes:[...prefixes].slice(0,1800),version:SEARCH_VERSION};
}
export function searchIndexId(source:string,id:string){return createHash('sha256').update(source+'/'+id).digest('hex');}
export function writeSearchIndex(db:any,writer:any,source:string,id:string,data:any){
 if(!Object.hasOwn(searchSources,source))return;
 const ref=db.doc('adminSearchIndex/'+searchIndexId(source,id));const doc=searchDocument(source as SearchSource,id,data);
 if(doc)writer.set(ref,{...doc,indexedAt:FieldValue.serverTimestamp()});else writer.delete(ref);
}
export function matchesSearch(doc:{text:string},query:string){return normalizeSearch(query).split(' ').filter(Boolean).every(word=>doc.text.includes(word));}
