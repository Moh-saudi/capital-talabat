import { whatsappUrl } from '../config/site.js';
import { useEffect, useRef } from 'react';
import { ArrowLeft, Smartphone, X } from 'lucide-react';
export type AppSelection = { title: string; kind: 'product' | 'store' | 'category' };
export function AppPromotionDialog({ open, selection, appUrl, onClose }: {
  open: boolean; selection?: AppSelection; appUrl: string | null; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open) element?.showModal(); else element?.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <dialog ref={dialog} className="app-promotion" dir="rtl" aria-labelledby="mobile-app-title" aria-describedby="mobile-app-description" onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === dialog.current) { const rect=dialog.current.getBoundingClientRect(); if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)onClose(); } }}>
    <button className="app-promotion-close" aria-label="إغلاق" onClick={onClose}><X size={21} /></button>
    <div className="app-promotion-visual" aria-hidden="true"><img src="/images/brand-logo.webp" alt="" loading="lazy" /></div>
    <div className="app-promotion-copy"><span className="eyebrow"><Smartphone size={15} />طلبات العاصمة على موبايلك</span><h2 id="mobile-app-title">نكمل على التطبيق؟</h2>{selection && <p className="app-selection">{selection.title}</p>}<p id="mobile-app-description">التطبيق قريبًا. لحد ما يجهز، اختار من المنيو واطلب على واتساب؛ الاستلام عند بوابة وزارتك.</p>
      {appUrl ? <a className="site-button site-button-orange" href={appUrl}>افتح التطبيق<ArrowLeft size={18} /></a> : <><p className="app-release-note">رابط التحميل الرسمي سيتاح قريبًا.</p><a className="site-button site-button-orange" href={whatsappUrl()} target="_blank" rel="noopener noreferrer">استفسر عن التطبيق<ArrowLeft size={18} /></a></>}
      <button className="app-promotion-later" onClick={onClose}>أكمل تصفح الموقع</button>
    </div>
  </dialog>;
}
