export type CatalogImportRow = {
 rowNumber:number;sku:string;department:string;name:string;brand:string;unit:string;
 price:number|null;unitsPerCarton:number|null;cartonCost:number|null;unitCost:number|null;
 competitorPrice:number|null;profit:number|null;marginPercent:number|null;sourceAvailable:boolean;
 imageUrl:string;imageSource:string;imageLicense:string;errors:string[];
};
const columns={sku:['كود الصنف (SKU)','SKU'],department:['القسم الرئيسي','department'],name:['اسم المنتج','name'],brand:['العلامة التجارية','brand'],unit:['الوحدة / الوزن','unit'],price:['سعر البيع القطاعي المقترح - التطبيق (ج.م)','سعر البيع','price'],unitsPerCarton:['عدد الوحدات بالكرتونة'],cartonCost:['سعر الكرتونة جملة (ج.م)'],unitCost:['سعر الوحدة جملة (ج.م)'],competitorPrice:['متوسط سعر المنافسين - طلبات/إنستاشوب (ج.م)'],available:['حالة التوفر'],imageUrl:['رابط الصورة','imageUrl'],imageSource:['مصدر الصورة','imageSource'],imageLicense:['ترخيص الصورة','imageLicense']};
const text=(value:unknown)=>typeof value==='string'?value.trim().replace(/\s+/g,' '):typeof value==='number'?String(value):'';
const numeric=(v:unknown)=>{if(v===null||v===undefined||text(v)==='')return null;const s=text(v).replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x))).replace(/[۰-۹]/g,x=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x))).replace(/[٬,]/g,'').replace(/٫/g,'.');const n=Number(s);return Number.isFinite(n)?n:null;};
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function parseCatalogRows(rows:unknown[][]):CatalogImportRow[]{
 const header=rows.findIndex(row=>columns.sku.some(k=>row.some(cell=>text(cell)===k))&&columns.name.some(k=>row.some(cell=>text(cell)===k)));
 if(header<0)throw new Error('لم نجد أعمدة SKU واسم المنتج. استخدم ورقة قاعدة بيانات المنتجات.');
 const index=Object.fromEntries(Object.entries(columns).map(([key,aliases])=>[key,rows[header].findIndex(cell=>aliases.includes(text(cell)))]));
 if(index.price<0)throw new Error('عمود سعر البيع غير موجود.');
 const result:CatalogImportRow[]=[];
 for(let i=header+1;i<rows.length;i++){
  const row=rows[i],value=(k:string)=>row[index[k]];
  if(row.every(v=>!text(v))||/^الإجمالي|^المتوسط/.test(text(value('sku'))))continue;
  const units=numeric(value('unitsPerCarton')),cost=numeric(value('cartonCost')),rawUnit=numeric(value('unitCost'));
  const unitCost=rawUnit??(cost!==null&&units!==null&&units>0?round(cost/units):null),price=numeric(value('price'));
  const profit=price!==null&&unitCost!==null?round(price-unitCost):null;
  const item:CatalogImportRow={rowNumber:i+1,sku:text(value('sku')),department:text(value('department')),name:text(value('name')),brand:text(value('brand')),unit:text(value('unit')),price,unitsPerCarton:units,cartonCost:cost,unitCost,competitorPrice:numeric(value('competitorPrice')),profit,marginPercent:profit!==null&&price!==null&&price>0?round(profit/price*100):null,sourceAvailable:!['غير متوفر','غير متاح','نفد','false','0'].includes(text(value('available'))),imageUrl:text(value('imageUrl')),imageSource:text(value('imageSource')),imageLicense:text(value('imageLicense')),errors:[]};
  if(!item.sku||item.sku.length>80)item.errors.push('كود SKU مفقود أو طويل');
  if(!item.name||[item.name,item.brand,item.unit].filter(Boolean).join(' — ').length>120)item.errors.push('اسم المنتج مفقود أو طويل');
  if(price===null||price<0||price>100000)item.errors.push('سعر بيع مفقود أو غير صالح');
  if(item.imageUrl){try{if(new URL(item.imageUrl).protocol!=='https:')throw Error();}catch{item.errors.push('رابط الصورة غير صالح');}}
  for(const n of [units,cost,unitCost,item.competitorPrice])if(n!==null&&(n<0||n>10000000))item.errors.push('بيانات تكلفة غير صالحة');
  if(units!==null&&(!Number.isInteger(units)||units<1))item.errors.push('عدد وحدات الكرتونة غير صالح');
  result.push(item);
 }
 const counts=new Map<string,number>();for(const row of result)counts.set(row.sku,(counts.get(row.sku)||0)+1);
 for(const row of result)if((counts.get(row.sku)||0)>1)row.errors.push('SKU مكرر في الملف');
 if(!result.length)throw new Error('الورقة لا تحتوي على منتجات.');
 if(result.length>1000)throw new Error('الحد الأقصى 1000 منتج في الملف الواحد.');
 return result;
}
export const catalogProductName=(row:Pick<CatalogImportRow,'name'|'brand'|'unit'>)=>[row.name,row.brand,row.unit].filter(Boolean).join(' — ');
