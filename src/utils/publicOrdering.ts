import { MINISTRIES } from '../config/ministries.js';
import { DELIVERY_FEE, DELIVERY_TIME, MIN_ORDER, ORDER_CUTOFF, SERVED_MINISTRIES, whatsappUrl } from '../config/site.js';
export type MenuItem = {id:string;category:string;name:string;desc:string;price:number|null;image:string;available:boolean;sizes?:{id:string;name:string;price:number|null}[]};
export type CartLine = {key:string;id:string;sizeId?:string;quantity:number};
export const money = (value:number|null) => value === null ? 'يُحدَّد قريبًا' : `${new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(value)} ج.م`;
export function normalizePhone(value:string):string {
 const digits=value.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[\s()-]/g,'');
 const local=digits.replace(/^(?:\+20|0020|20)/,'0');
 if(!/^01[0125]\d{8}$/.test(local))throw new Error('اكتب رقم موبايل مصري صحيح، زي 01012345678.');
 return '+20'+local.slice(1);
}
export function cartDetails(menu:MenuItem[],lines:CartLine[]){
 return lines.map(line=>{
  const item=menu.find(item=>item.id===line.id);
  const size=item?.sizes?.find(size=>size.id===line.sizeId);
  const price=item?.sizes?.length ? size?.price : item?.price;
  if(!item||!item.available||typeof price!=='number'||!Number.isFinite(price)||price<0||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99)throw new Error('في صنف مش متاح أو سعره لسه مش محدد. راجع السلة.');
  return {...line,name:item.name+(size?' — '+size.name:''),price,total:price*line.quantity};
 });
}
export function orderLink(menu:MenuItem[],lines:CartLine[],ministry:string,phone:string){
 if(!MINISTRIES.includes(ministry))throw new Error('اختار جهة العمل من القائمة.');
 if(!SERVED_MINISTRIES.includes(ministry))throw new Error('لسه مش بنوصل لوزارتك');
 const normalized=normalizePhone(phone),items=cartDetails(menu,lines);
 if(!items.length)throw new Error('اختار أصناف طلبك الأول.');
 const subtotal=items.reduce((sum,item)=>sum+item.total,0);
 if(MIN_ORDER!==null && subtotal<Number(MIN_ORDER))throw new Error('مجموع الأصناف أقل من الحد الأدنى للطلب.');
 const message=['أهلًا طلبات العاصمة، ده طلبي:',...items.map(item=>`${item.name} × ${item.quantity}: ${money(item.total)}`),`مجموع الأصناف: ${money(subtotal)}`,DELIVERY_FEE===null?'رسوم التوصيل: محتاجة تأكيد قبل الدفع.':`رسوم التوصيل: ${money(DELIVERY_FEE)}`,DELIVERY_FEE===null?'المبلغ النهائي بيتأكد مع الفريق قبل الدفع.':`الإجمالي: ${money(subtotal+Number(DELIVERY_FEE))}`,`الوزارة: ${ministry}`,`الموبايل: ${normalized}`,'نقطة الاستلام: بوابة الوزارة',`الطلب قبل ${ORDER_CUTOFF} والتسليم ${DELIVERY_TIME} ظهرًا، بتوقيت القاهرة.`,'الدفع مسبق عبر InstaPay أو فودافون كاش بعد تأكيد التوافر والمبلغ مع الفريق.'];
 return whatsappUrl(message.join('\n'));
}

/** Interpret a datetime-local field in Cairo rather than the visitor's timezone. */
export function cairoDateTime(value:string):number {
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);if(!match)return NaN;
 const [,year,month,day,hour,minute]=match.map(Number),wanted=Date.UTC(year,month-1,day,hour,minute);
 const format=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 let instant=wanted;
 for(let i=0;i<3;i++){const parts=Object.fromEntries(format.formatToParts(instant).map(part=>[part.type,part.value]));instant+=wanted-Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));}
 const parts=Object.fromEntries(format.formatToParts(instant).map(part=>[part.type,part.value]));
 return [year,month,day,hour,minute].every((value,i)=>value===Number(parts[['year','month','day','hour','minute'][i]]))?instant:NaN;
}
