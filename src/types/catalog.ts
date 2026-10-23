import type{CatalogPromotion}from'./promotion';
export type CatalogKind='grocery'|'meal'|'produce';
export type CatalogVariant={imageUrl?:string;id:string;label:string;unit:string;color:string;size:string;barcode:string;weightGrams:number|null};
export type CatalogItem={sourceProductId?:string;requiresReview?:boolean;reviewNote?:string;showInApp?:boolean;promotion?:CatalogPromotion|null;available?:boolean;promoted?:boolean;merchantCount?:number;activeMerchantCount?:number;offerCount?:number;imageVariants?:{thumbnail:string;menu:string;original:string};id:string;name:string;sku:string;brand:string;description:string;imageUrl:string;kind:CatalogKind;variants:CatalogVariant[];specs:Record<string,string|number|null>;archived:boolean;version:number};
export type MerchantOffer={id:string;catalogItemId:string;storeId:string;storeName:string;variantId:string;price:number|null;stockQuantity:number|null;active:boolean;notes:string;preparationMinutes:number|null;expiryDate:string;version:number};
export const catalogKindNames:Record<CatalogKind,string>={grocery:'سوبر ماركت ومنتجات',meal:'مطاعم ووجبات',produce:'خضار وفاكهة'};
export const catalogSpecFields:Record<CatalogKind,{key:string;label:string;number?:boolean}[]>={
 grocery:[{key:'ingredients',label:'المكونات'},{key:'allergens',label:'مسببات الحساسية'},{key:'storage',label:'طريقة الحفظ'},{key:'shelfLifeDays',label:'مدة الصلاحية بالأيام',number:true}],
 meal:[{key:'mealPeriod',label:'قسم الوجبة: فطور / غداء / عشاء'},{key:'ingredients',label:'مكونات الوجبة'},{key:'allergens',label:'مسببات الحساسية'},{key:'portion',label:'حجم الحصة / عدد الأفراد'},{key:'spiceLevel',label:'درجة الحرارة / الشطة'},{key:'calories',label:'السعرات الحرارية',number:true}],
 produce:[{key:'variety',label:'الصنف الزراعي'},{key:'origin',label:'بلد / منطقة المنشأ'},{key:'grade',label:'درجة الجودة'},{key:'saleBasis',label:'أساس البيع: كجم / قطعة / ربطة'},{key:'storage',label:'طريقة الحفظ'}],
};
