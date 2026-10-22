export const CATEGORIES = ['فطار', 'غداء', 'سوبر ماركت', 'بوكسات'];
// Null prices intentionally disable purchasing. Replace images with owned product WebP files.
export const MENU = [
  { id:'breakfast-foul', category:'فطار', name:'ساندوتش فول', desc:'فطار بسيط لبداية يومك.', price:null, image:'/images/menu-placeholder.webp', available:true },
  { id:'breakfast-falafel', category:'فطار', name:'ساندوتش طعمية', desc:'اختيار خفيف للفطار.', price:null, image:'/images/menu-placeholder.webp', available:true },
  { id:'breakfast-foul-plate', category:'فطار', name:'طبق فول بالزيت الحار', desc:'اسألنا عن الإضافات المتاحة.', price:null, image:'/images/menu-placeholder.webp', available:true },
  { id:'breakfast-box', category:'فطار', name:'بوكس الفطار', desc:'فول + طعمية + بيض + عيش + مخلل.', price:null, image:'/images/menu-placeholder.webp', available:true },
  { id:'lunch-koshary', category:'غداء', name:'كشري', desc:'اختار الحجم المناسب ليك.', price:null, sizes:[{id:'small',name:'صغير',price:null},{id:'medium',name:'وسط',price:null},{id:'large',name:'كبير',price:null}], image:'/images/menu-placeholder.webp', available:true },
  { id:'lunch-koshary-spicy', category:'غداء', name:'كشري بالشطة والدقة', desc:'الصلصات والإضافات حسب التوافر.', price:null, image:'/images/menu-placeholder.webp', available:true },
  { id:'market-water', category:'سوبر ماركت', name:'مياه معدنية', desc:'الحجم والسعر هيتحددوا قريبًا.', price:null, image:'/images/menu-placeholder.webp', available:true },
  { id:'market-juice', category:'سوبر ماركت', name:'عصائر', desc:'الأنواع المتاحة هتتوضح مع المنيو.', price:null, image:'/images/menu-placeholder.webp', available:true },
  { id:'market-snacks', category:'سوبر ماركت', name:'سناكس', desc:'اختيارات لبريكك.', price:null, image:'/images/menu-placeholder.webp', available:true },
  { id:'market-tea-coffee', category:'سوبر ماركت', name:'شاي وقهوة سريعة التحضير', desc:'احتياجات المشروبات اليومية.', price:null, image:'/images/menu-placeholder.webp', available:true },
  { id:'market-groceries', category:'سوبر ماركت', name:'بقالة أساسية', desc:'لبن، جبنة، عيش حسب التوافر.', price:null, image:'/images/menu-placeholder.webp', available:true },
  { id:'meeting-box', category:'بوكسات', name:'بوكس الاجتماع (10 أفراد)', desc:'بنجهّزه لك بطلب مسبق قبل 24 ساعة؛ السعر بعرض مخصص.', price:null, image:'/images/menu-placeholder.webp', available:true },
  { id:'employee-meal', category:'بوكسات', name:'وجبة الموظف', desc:'طبق رئيسي + مياه.', price:null, image:'/images/menu-placeholder.webp', available:true },
];
export default MENU;
