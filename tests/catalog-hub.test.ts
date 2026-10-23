import test from'node:test';import assert from'node:assert/strict';import{catalogItemData,merchantOfferData,offerId,offerProduct}from'../server/catalogModel.ts';import{catalogHub}from'../server/catalogHub.ts';
const definition=()=>({name:'صنف للاختبار',sku:'TEST-1',brand:'اختبار',description:'وصف اختبار',imageUrl:'https://example.com/image.webp',kind:'grocery',archived:false,specs:{storage:'تبريد'},variants:[{id:'small',label:'صغير',unit:'قطعة',color:'أحمر',size:'S',barcode:'123',weightGrams:500},{id:'large',label:'كبير',unit:'قطعة',color:'أزرق',size:'L',barcode:'456',weightGrams:1000}]});
function database(){const data=new Map<string,any>([['admins/admin',{}],['stores/store-a',{name:'تاجر أ'}],['stores/store-b',{name:'تاجر ب'}]]);let counter=0;const doc=(path:string):any=>({path,id:path.split('/').at(-1),collection:(child:string)=>collection(path+'/'+child)});const collection=(path:string):any=>({path,doc:(id?:string)=>doc(path+'/'+(id||'event-'+(++counter))),where:(field:string,_op:string,value:any)=>({path,field,value,limit:()=>({path,field,value})})});return{data,doc,collection,async runTransaction(fn:any){const pending:[string,any][]=[];const tx={get:async(ref:any)=>{if(ref.field){const docs=[...data].filter(([key,value])=>key.startsWith(ref.path+'/')&&key.split('/').length===ref.path.split('/').length+1&&value[ref.field]===ref.value).map(([key,value])=>({id:key.split('/').at(-1),data:()=>value}));return{docs,size:docs.length};}return{exists:data.has(ref.path),data:()=>data.get(ref.path)};},set:(ref:any,value:any)=>pending.push([ref.path,value]),create:(ref:any,value:any)=>pending.push([ref.path,value])};const result=await fn(tx);for(const[key,value]of pending)data.set(key,value);return result;}};}
const actor={uid:'admin',email:'admin@example.com'};
test('typed masters keep grocery, meal and produce specifications separate',()=>{
 const grocery=catalogItemData(definition());assert.equal(grocery.specs.storage,'تبريد');assert.equal(grocery.variants[0].color,'أحمر');
 const meal=catalogItemData({...definition(),kind:'meal',specs:{ingredients:'أرز',calories:500,origin:'ليس حقل وجبة'}});assert.equal(meal.specs.calories,500);assert.equal(meal.specs.origin,undefined);
 const produce=catalogItemData({...definition(),kind:'produce',specs:{variety:'طماطم',saleBasis:'كجم',calories:500}});assert.equal(produce.specs.saleBasis,'كجم');assert.equal(produce.specs.calories,undefined);
 assert.throws(()=>catalogItemData({...definition(),variants:[definition().variants[0],definition().variants[0]]}));
 assert.throws(()=>merchantOfferData({variantId:'small',price:null,stockQuantity:10,active:true,notes:'',expiryDate:''},{...grocery,id:'item',version:1}));
});
test('one item has independent prices and inventory per merchant and variant, with immutable price events',async()=>{
 const db=database();const item=(await catalogHub(db,actor,{action:'catalog-master-save',id:'item',data:definition()})).item;
 const assignment=await catalogHub(db,actor,{action:'catalog-assign',itemId:'item',variantId:'small',storeIds:['store-a','store-b']});assert.equal(assignment.created,2);
 assert.equal((await catalogHub(db,actor,{action:'catalog-assign',itemId:'item',variantId:'small',storeIds:['store-a']})).created,0);
 for(const[storeId,price,stock]of [['store-a',20,10],['store-b',25,5]]as const){const id=offerId('item',storeId,'small');await catalogHub(db,actor,{action:'catalog-offer-save',id,expectedVersion:1,reason:'جرد وتسعير افتتاحي',data:{variantId:'small',price,stockQuantity:stock,active:true,notes:'',preparationMinutes:null,expiryDate:''}});}
 const a=db.data.get('merchantOffers/'+offerId('item','store-a','small')),b=db.data.get('merchantOffers/'+offerId('item','store-b','small'));assert.equal(a.price,20);assert.equal(b.price,25);assert.equal(a.stockQuantity,10);assert.equal(b.stockQuantity,5);assert.equal(db.data.get('products/'+a.id).price,20);assert.equal('stockQuantity' in db.data.get('products/'+a.id),false);
 await assert.rejects(()=>catalogHub(db,actor,{action:'catalog-offer-save',id:a.id,expectedVersion:1,reason:'تعديل قديم مرفوض',data:{...a,price:100}}),/تغيّر العرض/);
 assert.equal(db.data.get('merchantOffers/'+a.id).price,20);
 const events=[...db.data].filter(([key])=>key.startsWith('catalogPriceHistory/'));assert.equal(events.length,2);assert.equal(events[0][1].before,null);assert.equal(events[0][1].actorUid,'admin');
 await catalogHub(db,actor,{action:'catalog-master-save',id:'item',expectedVersion:item.version,data:{...definition(),name:'اسم محدّث'}});
 assert.equal(db.data.get('products/'+a.id).name,'اسم محدّث — صغير');assert.equal(db.data.get('products/'+b.id).price,25);
 await assert.rejects(()=>catalogHub(db,actor,{action:'catalog-master-save',id:'item',expectedVersion:2,data:{...definition(),variants:[definition().variants[1]]}}),/حذف متغير/);
});
test('negative stock, unknown variants and revoked administrators never commit changes',async()=>{
 const db=database();await catalogHub(db,actor,{action:'catalog-master-save',id:'item',data:definition()});await assert.rejects(()=>catalogHub(db,{uid:'other'},{action:'catalog-assign',itemId:'item',variantId:'small',storeIds:['store-a']}));
 const item=db.data.get('catalogItems/item');assert.throws(()=>merchantOfferData({variantId:'small',price:20,stockQuantity:-1,active:false},item));assert.throws(()=>merchantOfferData({variantId:'unknown',price:20,stockQuantity:1,active:false},item));
 const projection=offerProduct(item,{id:'offer',catalogItemId:'item',storeId:'store-a',storeName:'تاجر',variantId:'small',price:20,stockQuantity:0,active:true,version:1,notes:'',preparationMinutes:null,expiryDate:''});assert.equal(projection?.inStock,false);
});
test('adopting a merchant product preserves its ID and price, and assignment does not duplicate it',async()=>{
 const db=database();db.data.set('products/legacy',{id:'legacy',name:'صنف سابق',storeId:'store-a',price:37,inStock:true,imageUrl:'https://example.com/old.webp'});
 const result=await catalogHub(db,actor,{action:'catalog-adopt',productId:'legacy'});assert.equal(result.item.id,'legacy');const offer=db.data.get('merchantOffers/legacy');assert.equal(offer.price,37);assert.equal(offer.stockQuantity,null);assert.equal(offer.active,false);assert.equal(db.data.get('products/legacy').merchantOfferId,'legacy');
 assert.equal((await catalogHub(db,actor,{action:'catalog-assign',itemId:'legacy',variantId:'base',storeIds:['store-a']})).created,0);
});

test('clearing an offer price also stops the existing mobile product projection',async()=>{
 const db=database();await catalogHub(db,actor,{action:'catalog-master-save',id:'item',data:definition()});await catalogHub(db,actor,{action:'catalog-assign',itemId:'item',variantId:'small',storeIds:['store-a']});const id=offerId('item','store-a','small');
 const data={variantId:'small',price:20,stockQuantity:5,active:true,notes:'',preparationMinutes:null,expiryDate:''};
 await catalogHub(db,actor,{action:'catalog-offer-save',id,expectedVersion:1,reason:'تسعير افتتاحي',data});assert.equal(db.data.get('products/'+id).inStock,true);
 await catalogHub(db,actor,{action:'catalog-offer-save',id,expectedVersion:2,reason:'مراجعة سعر المورد',data:{...data,price:null,active:false}});assert.equal(db.data.get('products/'+id).inStock,false);
});
test('table flags pause all offers without resetting merchant settings, and promotion never changes prices',async()=>{
 const db=database(),input=definition();await catalogHub(db,actor,{action:'catalog-master-save',id:'item',data:input});
 await catalogHub(db,actor,{action:'catalog-assign',itemId:'item',variantId:'small',storeIds:['store-a','store-b']});
 await catalogHub(db,actor,{action:'catalog-assign',itemId:'item',variantId:'large',storeIds:['store-a']});
 assert.equal(db.data.get('catalogItems/item').merchantCount,2);assert.equal(db.data.get('catalogItems/item').offerCount,3);
 for(const storeId of ['store-a','store-b'])await catalogHub(db,actor,{action:'catalog-offer-save',id:offerId('item',storeId,'small'),expectedVersion:1,reason:'تسجيل مخزون وتسعير',data:{variantId:'small',price:storeId==='store-a'?20:25,stockQuantity:10,active:true,notes:'',preparationMinutes:null,expiryDate:''}});
 assert.equal(db.data.get('catalogItems/item').activeMerchantCount,2);
 const paused=(await catalogHub(db,actor,{action:'catalog-master-save',id:'item',expectedVersion:1,data:{...input,available:false,promoted:true}})).item;
 assert.equal(paused.merchantCount,2);assert.equal(paused.activeMerchantCount,0);const a=offerId('item','store-a','small');assert.equal(db.data.get('products/'+a).inStock,false);assert.equal(db.data.get('products/'+a).hasPromotion,true);assert.equal(db.data.get('products/'+a).price,20);assert.equal(db.data.get('merchantOffers/'+a).active,true);
 const enabled=(await catalogHub(db,actor,{action:'catalog-master-save',id:'item',expectedVersion:2,data:{...input,available:true,promoted:false}})).item;assert.equal(enabled.activeMerchantCount,2);assert.equal(db.data.get('products/'+a).inStock,true);assert.equal(db.data.get('products/'+a).hasPromotion,false);
 await assert.rejects(()=>catalogHub(db,actor,{action:'catalog-master-save',id:'item',expectedVersion:2,data:{...input,available:false}}),/تغيّر الصنف/);
 assert.throws(()=>catalogItemData({...input,available:'false'}));assert.throws(()=>catalogItemData({...input,promoted:'true'}));
});
test('campaign coupon must exist and hiding from the app preserves offer prices',async()=>{
 const db=database(),promotion={title:'حملة اختبار',occasion:'مناسبة',startsAt:'2026-01-01T00:00:00Z',endsAt:'2027-01-01T00:00:00Z',couponCode:'EXISTS',terms:'حسب شروط الكوبون'};
 await assert.rejects(()=>catalogHub(db,actor,{action:'catalog-master-save',id:'promo',data:{...definition(),promotion,promoted:true}}),/كود الخصم غير موجود/);
 assert.equal(db.data.has('catalogItems/promo'),false);db.data.set('coupons/EXISTS',{code:'EXISTS',discountType:'percent',value:10,minOrder:100});
 const result=await catalogHub(db,actor,{action:'catalog-master-save',id:'promo',data:{...definition(),promotion,promoted:true,showInApp:false}});assert.equal(result.item.promotion.couponCode,'EXISTS');assert.equal(result.item.showInApp,false);
});
