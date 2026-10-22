import { randomUUID } from 'node:crypto';

// Return only controlled diagnostics, never provider messages, keys or signed URLs.
export function catalogImageFailure(error: unknown, stage: string) {
  const rawCode = (error as {code?: unknown; message?: unknown})?.code;
  const message = (error as {message?: unknown})?.message;
  let code = 'IMAGE_SERVICE_FAILED';
  let text = 'تعذر تجهيز رفع الصورة. تواصل مع مسؤول المنصة واذكر معرّف الخطأ.';
  if (rawCode === 'FIREBASE_ADMIN_NOT_CONFIGURED') {
    code = 'IMAGE_AUTH_SERVICE_NOT_CONFIGURED';
    text = 'إعدادات التحقق من صلاحية الإدارة غير مكتملة على هذه النسخة. يجب على المسؤول تفعيل إعدادات الخادم ثم إعادة النشر.';
  } else if (message === 'R2_NOT_CONFIGURED' || stage === 'storage-configuration') {
    code = 'IMAGE_STORAGE_NOT_CONFIGURED';
    text = 'إعدادات تخزين الصور غير مكتملة على هذه النسخة. راجع مفاتيح التخزين ورابط الصور العام في إعدادات الاستضافة ثم أعد النشر.';
  } else if (stage === 'audit') {
    code = 'IMAGE_AUDIT_UNAVAILABLE';
    text = 'تعذر تسجيل إذن رفع الصورة. لم يبدأ الرفع؛ يرجى مراجعة صلاحيات خدمة الإدارة.';
  }
  return {error: text, code, incidentId: randomUUID()};
}
