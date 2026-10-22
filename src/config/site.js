function httpsUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
export const SERVED_MINISTRIES = ['وزارة الصحة والسكان'];
export const ORDER_CUTOFF = '11:30';
export const DELIVERY_TIME = '1:30'; // Afternoon, Cairo time.
export const MIN_ORDER = null; // EGP; fill after approval. Do not assume zero.
export const DELIVERY_FEE = null; // EGP; confirmed before payment until configured.
export const WHATSAPP = '201017799580';
export const CONTACT_EMAIL = ''; // Add the approved contact email; hidden while empty.
export const APP_URL = httpsUrl(import.meta.env?.VITE_MOBILE_APP_URL || '');
export const SIGNUP_URL = httpsUrl(import.meta.env?.VITE_SIGNUP_URL || 'https://script.google.com/macros/s/AKfycbzxm2uRZPAyHLKCpfNc6xjvvPIxFsmrmz6APlXoIZlGTPAxdMgG23IoBMwxj4C3cj-7dA/exec');
export const SITE_URL = 'https://capital-talabat.vercel.app';
export const RETENTION_DAYS = 180; // Draft policy: owner must approve and implement retention.
export const BULK_TIERS = [{ min: 10, discountPercent: null }, { min: 25, discountPercent: null }, { min: 50, discountPercent: null }];
export const whatsappUrl = (message = 'أهلًا، محتاج مساعدة في طلبات العاصمة.') => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;
