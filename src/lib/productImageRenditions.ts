// Fit the whole package inside a square: never crop labels, never upscale pixels.
export async function productImageRenditions(file:File){
 const bitmap=await createImageBitmap(file);
 try{
  if(bitmap.width*bitmap.height>40000000)throw new Error('دقة الصورة كبيرة جدًا. اختر صورة أصغر من 40 ميجابكسل.');
  async function resize(limit:number){
   const size=Math.min(limit,Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
   const context=canvas.getContext('2d');if(!context)throw new Error('تعذرت معالجة الصورة.');
   context.fillStyle='#ffffff';context.fillRect(0,0,size,size);const scale=Math.min(size/bitmap.width,size/bitmap.height,1);const width=bitmap.width*scale,height=bitmap.height*scale;
   context.drawImage(bitmap,(size-width)/2,(size-height)/2,width,height);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('تعذرت معالجة الصورة.')),'image/webp',.86));
   return new File([blob],file.name.replace(/\.[^.]+$/,'')+'-'+size+'.webp',{type:blob.type});
  }
  return {thumbnail:await resize(320),menu:await resize(1000)};
 }finally{bitmap.close();}
}
