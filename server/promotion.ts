import{AdminError,validId}from'./adminRequest.ts';import type{CatalogPromotion}from'../src/types/promotion.ts';
export function promotionData(value:any):CatalogPromotion|null{
 if(value===null||value===undefined)return null;
 if(typeof value!=='object'||Array.isArray(value))throw new AdminError(400,'تفاصيل العرض غير صالحة.');
 const limits={title:120,occasion:120,startsAt:40,endsAt:40,couponCode:80,terms:1000};const result:any={};
 for(const[key,max]of Object.entries(limits)){if(typeof value[key]!=='string'||value[key].length>max)throw new AdminError(400,'راجع تفاصيل العرض.');result[key]=value[key].trim();}
 if(result.couponCode)validId(result.couponCode);
 if(!result.title)throw new AdminError(400,'اكتب عنوان العرض.');
 if(!result.startsAt||!result.endsAt||!Number.isFinite(Date.parse(result.startsAt))||!Number.isFinite(Date.parse(result.endsAt))||Date.parse(result.endsAt)<=Date.parse(result.startsAt))throw new AdminError(400,'حدّد بداية ونهاية صحيحتين للعرض.');
 return result;
}
export function activePromotion(promoted:boolean|undefined,promotion:CatalogPromotion|null|undefined,now=Date.now()){
 return Boolean(promoted&&(!promotion||(Date.parse(promotion.startsAt)<=now&&now<Date.parse(promotion.endsAt))));
}
export async function requirePromotionCoupon(tx:any,db:any,promotion:CatalogPromotion|null){if(promotion?.couponCode&&!(await tx.get(db.doc('coupons/'+promotion.couponCode))).exists)throw new AdminError(400,'كود الخصم غير موجود. أنشئه من قسم الخصومات أولًا.');}
