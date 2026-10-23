import {createHash} from 'node:crypto';
import type{CatalogItem,MerchantOffer}from'../src/types/catalog.ts';
import{catalogSpecFields}from'../src/types/catalog.ts';
import{AdminError}from'./adminRequest.ts';
const invalid=(message='راجع بيانات الصنف وخياراته.')=>{throw new AdminError(400,message);};
const text=(value:unknown,max:number,required=false)=>{if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))return invalid();return value.trim();};
const number=(value:unknown,max:number)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)return invalid('قيمة رقمية غير صالحة.');return value;};
export const offerId=(itemId:string,storeId:string,variantId:string)=>'offer-'+createHash('sha256').update([itemId,storeId,variantId].join('\0')).digest('hex').slice(0,40);
export function catalogItemData(input:any):Omit<CatalogItem,'id'|'version'>{
 if(!input||!Object.hasOwn(catalogSpecFields,input.kind)||typeof input.archived!=='boolean')return invalid();
 if(input.available!==undefined&&typeof input.available!=='boolean')return invalid();
 if(input.promoted!==undefined&&typeof input.promoted!=='boolean')return invalid();
 if(!Array.isArray(input.variants)||input.variants.length<1||input.variants.length>20)return invalid('أضف متغيرًا واحدًا على الأقل وبحد أقصى 20.');
 const variants=input.variants.map((v:any)=>{if(!v||typeof v.id!=='string'||!/^[\w-]{1,64}$/.test(v.id))return invalid();const imageUrl=text(v.imageUrl??'',2048);if(imageUrl){try{if(new URL(imageUrl).protocol!=='https:')return invalid('رابط صورة المتغير غير صالح.');}catch{return invalid('رابط صورة المتغير غير صالح.');}}return{imageUrl,id:v.id,label:text(v.label,80,true),unit:text(v.unit,60,true),color:text(v.color,60),size:text(v.size,60),barcode:text(v.barcode,100),weightGrams:v.weightGrams===null?null:number(v.weightGrams,1000000)};});
 if(new Set(variants.map((v:any)=>v.id)).size!==variants.length)return invalid('معرّف المتغير مكرر.');
 const specs:Record<string,string|number|null>={};for(const field of catalogSpecFields[input.kind as CatalogItem['kind']]){const value=input.specs?.[field.key];specs[field.key]=field.number?(value===null||value===undefined?null:number(value,1000000)):text(value??'',1000);}
 const imageUrl=text(input.imageUrl,2048);if(imageUrl){try{if(new URL(imageUrl).protocol!=='https:')return invalid('رابط الصورة يجب أن يبدأ بـ HTTPS.');}catch{return invalid('رابط الصورة غير صالح.');}}
 let imageVariants:CatalogItem['imageVariants'];if(input.imageVariants!==undefined){if(!input.imageVariants||typeof input.imageVariants!=='object'||Array.isArray(input.imageVariants)||Object.keys(input.imageVariants).some(key=>!['thumbnail','menu','original'].includes(key)))return invalid('مقاسات الصورة غير صالحة.');for(const key of ['thumbnail','menu','original']){const url=text(input.imageVariants[key],2048,true);try{if(new URL(url).protocol!=='https:')return invalid('رابط صورة غير صالح.');}catch{return invalid('رابط صورة غير صالح.');}}imageVariants=input.imageVariants;}
 return{...(imageVariants?{imageVariants}:{}),name:text(input.name,120,true),sku:text(input.sku,80),brand:text(input.brand,100),description:text(input.description,1000),imageUrl,kind:input.kind,archived:input.archived,available:input.available??true,promoted:input.promoted??false,variants,specs};
}
export function merchantOfferData(input:any,item:CatalogItem):Pick<MerchantOffer,'variantId'|'price'|'stockQuantity'|'active'|'notes'|'preparationMinutes'|'expiryDate'>{
 if(!input||!item.variants.some(v=>v.id===input.variantId)||typeof input.active!=='boolean')return invalid('اختر متغير الصنف وحالة العرض.');
 const price=input.price===null?null:number(input.price,100000),stockQuantity=input.stockQuantity===null?null:number(input.stockQuantity,10000000);
 if(item.kind!=='produce'&&stockQuantity!==null&&!Number.isInteger(stockQuantity))return invalid('كمية القطع أو الوجبات يجب أن تكون عددًا صحيحًا.');
 if(input.active&&(item.archived||!(item.variants.find(v=>v.id===input.variantId)?.imageUrl||item.imageUrl)||price===null||stockQuantity===null||stockQuantity<1))return invalid('لنشر العرض: أضف صورة وسعرًا وكمية متاحة، وتأكد أن الصنف غير مؤرشف.');
 const expiryDate=text(input.expiryDate??'',10);if(expiryDate&&!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate))return invalid('تاريخ الصلاحية غير صالح.');
 return{variantId:input.variantId,price,stockQuantity,active:input.active,notes:text(input.notes??'',1000),preparationMinutes:item.kind==='meal'&&input.preparationMinutes!==null?number(input.preparationMinutes,1440):null,expiryDate};
}
export function offerProduct(item:CatalogItem,offer:MerchantOffer){
 const variant=item.variants.find(v=>v.id===offer.variantId);if(!variant||offer.price===null)return null;
 return{...(!variant.imageUrl&&item.imageVariants?{imageVariants:item.imageVariants}:{}),id:offer.id,catalogItemId:item.id,merchantOfferId:offer.id,variantId:variant.id,storeId:offer.storeId,storeName:offer.storeName,name:[item.name,variant.label].filter(Boolean).join(' — ').slice(0,120),description:[item.description,variant.color,variant.size].filter(Boolean).join(' · ').slice(0,1000),sku:item.sku,brand:item.brand,unit:variant.unit,price:offer.price,originalPrice:offer.price,imageUrl:variant.imageUrl||item.imageUrl,imageType:item.kind==='meal'?'hawawshi':item.kind==='produce'?'foul':'croissant',category:item.kind==='meal'?'سندوتشات':'سوبر ماركت بالقطعة',archived:item.archived,hasPromotion:item.promoted===true,badge:item.promoted?'عرض مميز':'',inStock:Boolean(item.available!==false&&!item.archived&&(variant.imageUrl||item.imageUrl)&&offer.active&&offer.stockQuantity!==null&&offer.stockQuantity>=1),catalogKind:item.kind,catalogSpecs:item.specs,catalogVariant:variant,preparationMinutes:offer.preparationMinutes,expiryDate:offer.expiryDate};
}

export function catalogMerchantSummary(item:CatalogItem,offers:MerchantOffer[]){return {merchantCount:new Set(offers.map(o=>o.storeId)).size,activeMerchantCount:new Set(offers.filter(o=>offerProduct(item,o)?.inStock).map(o=>o.storeId)).size,offerCount:offers.length};}
