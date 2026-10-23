import test from'node:test';import assert from'node:assert/strict';import{catalogReviewPlan}from'../server/catalogReviewPlan.ts';import{catalogItemData,offerProduct}from'../server/catalogModel.ts';import{promotionData,activePromotion}from'../server/promotion.ts';
test('combined brands become independent drafts without copying an ambiguous price or image',()=>{
 const plan=catalogReviewPlan([{id:'old',name:'مشروب غازي كانز — سبيرو سباتس / فيروز — 330 مل',brand:'سبيرو سباتس / فيروز',sku:'SKU-6004',unit:'330 مل',price:25,imageUrl:'https://example.com/mixed.webp',inStock:false}]);
 const split=plan.items.filter(i=>i.sourceProductId==='old');assert.equal(split.length,2);assert.ok(split.every(i=>!i.name.includes('/')&&!i.imageUrl&&i.available===false&&i.showInApp===false&&!('price'in i)));assert.equal(plan.archive.length,1);assert.equal(new Set(plan.items.map(i=>i.id)).size,plan.items.length);for(const item of plan.items)catalogItemData(item);
 assert.ok(plan.items.some(i=>i.specs.mealPeriod==='فطور'));assert.ok(plan.items.some(i=>i.specs.mealPeriod==='غداء'));assert.ok(plan.items.some(i=>i.specs.mealPeriod==='عشاء'));assert.ok(plan.items.some(i=>i.kind==='produce'));
 assert.equal(catalogReviewPlan([{id:'archived',name:'قديم',archived:true}]).archive.length,0);
});
test('promotion validates dates and keeps campaign metadata separate from sale prices',()=>{
 const campaign=promotionData({title:'عرض مناسبة',occasion:'رمضان',startsAt:'2026-01-01T00:00:00Z',endsAt:'2026-02-01T00:00:00Z',couponCode:'RAMADAN',terms:'وفق شروط الكوبون'})!;
 assert.equal(activePromotion(true,campaign,Date.parse('2026-01-15')),true);assert.equal(activePromotion(true,campaign,Date.parse('2026-02-01')),false);assert.equal(activePromotion(false,campaign,Date.parse('2026-01-15')),false);
 assert.throws(()=>promotionData({...campaign,endsAt:campaign.startsAt}));assert.throws(()=>promotionData({...campaign,title:''}));
 const item=catalogReviewPlan([]).items[0];item.imageUrl='https://example.com/image.webp';item.available=true;item.showInApp=false;const offer={id:'offer',catalogItemId:item.id,storeId:'s',storeName:'متجر',variantId:'base',price:40,stockQuantity:5,active:true,notes:'',preparationMinutes:null,expiryDate:'',version:1};const product=offerProduct(item,offer)!;assert.equal(product.inStock,false);assert.equal(product.showInApp,false);assert.equal(product.price,40);
});
