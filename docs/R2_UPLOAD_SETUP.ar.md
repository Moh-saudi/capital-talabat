# رفع صور الكتالوج

الملف يُرفع مباشرة من المتصفح إلى حاوية Cloudflare R2 `capitaltalabat` بواسطة رابط رفع مؤقت يصدره `/api/catalog-images`. بعد نجاحه تُحفظ روابط `imageUrl` أو `bannerUrl` أو `logoUrl` في مستند المنتج أو المتجر. لا تُرسل ملفات الصور إلى Firebase Storage.

## متطلبات نسخة المعاينة

في Vercel → Settings → Environment Variables يجب أن تشمل المتغيرات بيئة **Preview** ونطاق الفرع الحالي، ثم يُعاد نشر النسخة:

- `FIREBASE_PROJECT_ID=capital-talabat`
- `FIREBASE_CLIENT_EMAIL` و`FIREBASE_PRIVATE_KEY`: يستخدمهما الخادم للتحقق من صلاحية المدير وتسجيل العملية، وليس لتخزين الملف.
- `CLOUDFLARE_R2_ACCESS_KEY_ID` و`CLOUDFLARE_R2_SECRET_ACCESS_KEY`: مفاتيح S3 للحاوية، مع صلاحية قراءة وكتابة الكائنات. توكن Cloudflare العام ليس بديلًا لهما.
- `CLOUDFLARE_R2_PUBLIC_URL`: رابط الحاوية العام الفعلي أو النطاق المخصص من Cloudflare. فعّل Public Development URL أو اربط نطاقًا عامًا. رابط S3 ورقم الحساب لا يصلحان لتكوين هذا الرابط.

يدعم الكود كذلك أسماء `R2_ACCESS_KEY_ID` و`R2_SECRET_ACCESS_KEY` و`R2_PUBLIC_URL` ولها أولوية على الأسماء الطويلة؛ راجع عدم وجود قيم قديمة فيها.

في إعدادات الحاوية → CORS Policy أضف سياسة مثل:

```json
[
  {
    "AllowedOrigins": [
      "https://capital-talabat.vercel.app",
      "https://capital-talabat-git-preview-brand-c55390-mohamedsaudis-projects.vercel.app"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Cache-Control"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

أضف رابط النشر الذي تستخدمه فعلًا إن اختلف. لا تضع مفاتيح R2 أو مفتاح حساب الخدمة في متغيرات تبدأ بـ`VITE_` ولا في المستودع.

## التشخيص

- `IMAGE_AUTH_SERVICE_NOT_CONFIGURED`: لم تصل إعدادات اعتماد خادم الإدارة إلى هذا النشر.
- `IMAGE_STORAGE_NOT_CONFIGURED`: مفاتيح التخزين أو رابط الصور العام ناقص أو غير صالح.
- `IMAGE_AUDIT_UNAVAILABLE`: تعذر تسجيل إذن الرفع قبل إرسال الملف.
- `IMAGE_SERVICE_FAILED`: راجع سجل وظيفة `/api/catalog-images` باستخدام معرّف الخطأ؛ يسجل المرحلة ورمزًا مضبوطًا دون المفاتيح أو الروابط الموقّعة.
- إذا نجح طلب `/api/catalog-images` وفشل طلب `PUT` التالي، راجع CORS واتصال المتصفح وصلاحيات مفتاح R2.

هذه التعليمات لا تعني أن إعدادات حساب الاستضافة عُدلت تلقائيًا. لا تتوفر مفاتيح R2 أو صلاحية إدارة Vercel/Cloudflare في جلسة العمل الحالية للتحقق من رفع ملف حي.
