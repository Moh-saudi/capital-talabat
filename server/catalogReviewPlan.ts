import{createHash}from'node:crypto';import type{CatalogItem}from'../src/types/catalog.ts';
const alternatives:Record<string,string[]>={
 'SKU-5007':['ينسون فتلة','نعناع فتلة','كركديه فتلة'],'SKU-9506':['مزيل عرق رول أون','مزيل عرق سبراي'],'SKU-1015':['كرتونة بيض أبيض','كرتونة بيض أحمر'],'SKU-2004':['مكرونة خواتم','مكرونة فرن','مكرونة اسباجتي'],'SKU-2007':['شعرية','لسان عصفور'],'SKU-4004':['تونة قطعة واحدة في محلول ملحي','تونة قطعة واحدة في الزيت'],'SKU-8005':['لانشون بقري سادة','لانشون بقري بالزيتون'],'SKU-2005':['مكرونة فوسيلي','مكرونة بنا'],'SKU-8004':['بسلة بالجزر مجمدة','بامية مجمدة'],'SKU-2011':['لوبيا','فاصوليا بيضاء'],'SKU-2006':['مكرونة خواتم','مكرونة مرمرية'],'SKU-8001':['بانيه دجاج مقرمش عادي','بانيه دجاج مقرمش حار'],'SKU-6005':['عصير مانجو','عصير جوافة','عصير برتقال'],'SKU-5006':['بن تركي محوج فاتح','بن تركي محوج وسط'],'SKU-7004':['شوكولاتة بالحليب','شوكولاتة بالبندق'],
};
const newSections:Record<string,string[]>={
 'فطور':['ساندوتش فول','ساندوتش طعمية','ساندوتش بطاطس','ساندوتش بيض مسلوق','ساندوتش بيض أومليت','ساندوتش جبنة بيضاء','ساندوتش جبنة رومي','علبة فول','علبة فلافل','وجبة فطور فول وطعمية'],
 'غداء':['وجبة ربع دجاجة مشوية','وجبة نصف دجاجة مشوية','وجبة شيش طاووق','وجبة كفتة مشوية','وجبة بانيه دجاج','وجبة شاورما دجاج','وجبة شاورما لحم','وجبة سمك مشوي','مكرونة بشاميل','كشري','أرز أبيض','خضار مطبوخ','سلطة خضراء'],
 'عشاء':['ساندوتش شاورما دجاج','ساندوتش شاورما لحم','ساندوتش كفتة','ساندوتش فراخ بانيه','برجر لحم','برجر دجاج','بيتزا مارجريتا','بيتزا خضار','سلطة تونة','سلطة دجاج'],
 'خضار':['طماطم','بطاطس','بصل أحمر','بصل أبيض','خيار','جزر','كوسة','باذنجان رومي','فلفل أخضر','فلفل ألوان','ليمون','ثوم','خس','جرجير','بقدونس','شبت','كزبرة خضراء','سبانخ','ملوخية','بسلة خضراء','فاصوليا خضراء','بروكلي','قرنبيط','كرنب'],
 'فاكهة':['موز','تفاح أحمر','تفاح أخضر','برتقال','يوسفي','جوافة','رمان'],
};
function id(key:string){return'catalog-'+createHash('sha256').update(key).digest('hex').slice(0,32);}
function master(key:string,name:string,brand:string,unit:string,kind:CatalogItem['kind'],specs:CatalogItem['specs']={}):CatalogItem{
 return{id:id(key),version:1,name,brand,sku:key,description:'',imageUrl:'',kind,specs,variants:[{id:'base',label:unit||'الأساسي',unit:unit||'قطعة',color:'',size:'',barcode:'',weightGrams:null}],archived:false,available:false,showInApp:false,promoted:false,promotion:null,merchantCount:0,activeMerchantCount:0,offerCount:0};
}
export function catalogReviewPlan(products:any[]){
 const items:any[]=[],archive:any[]=[];
 for(const p of products){if(p.archived||p.merchantOfferId)continue;const pieces=String(p.name).split(' — '),stem=pieces[0],brand=String(p.brand||pieces[1]||''),unit=String(p.unit||pieces.at(-1)||'قطعة');const combined=String(p.name).includes('/');
  if(combined){const brands=brand.split(/\s*\/\s*/).filter(Boolean),names=alternatives[p.sku]||[stem];let n=0;for(const b of brands.length?brands:[''])for(const name of names){n++;const key=String(p.sku)+'-S'+n;const m=master(key,[name,b,unit].filter(Boolean).join(' — '),b,unit,'grocery');m.sourceProductId=p.id;m.requiresReview=true;m.reviewNote='تم فصل هوية مجمعة؛ يلزم تدقيق حجم العبوة والصورة والتسعير لكل علامة ونكهة قبل النشر.';items.push(m);}archive.push(p);
  }else{const m=master(String(p.sku||p.id),p.name,brand,unit,'grocery');m.id=p.id;m.imageUrl=p.imageUrl||'';if(p.imageVariants)m.imageVariants=p.imageVariants;m.description=p.description||'';m.sourceProductId=p.id;m.requiresReview=true;items.push(m);}
 }
 for(const[section,names]of Object.entries(newSections))names.forEach((name,index)=>{const produce=['خضار','فاكهة'].includes(section),unit=produce?['جرجير','بقدونس','شبت','كزبرة خضراء'].includes(name)?'ربطة':'كجم':'حصة';const key='CT-'+(produce?'FRESH':section==='فطور'?'BREAKFAST':section==='غداء'?'LUNCH':'DINNER')+'-'+(section==='فاكهة'?'FRUIT-':'')+String(index+1).padStart(3,'0');const m=master(key,name,'',unit,produce?'produce':'meal',produce?{variety:name,saleBasis:unit}:{mealPeriod:section});items.push({...m,requiresReview:true,reviewNote:'مسودة تعريف صنف بطلب الإدارة؛ مواصفات الوصفة أو المنشأ والصورة والسعر يحددها التاجر.'});});
 return{items,archive,summary:{reviewed:products.length,combined:archive.length,splitItems:items.filter(i=>String(i.sku).includes('-S')).length,mealDrafts:items.filter(i=>i.kind==='meal').length,produceDrafts:items.filter(i=>i.kind==='produce').length,total:items.length}};
}
