import { SIGNUP_URL } from '../config/site.js';
import { MINISTRIES } from '../config/ministries.js';
import { normalizePhone } from '../utils/publicOrdering';
export type SignupInput={name:string;phone:string;ministry:string;bus_line:string;website:string};
export type SignupStatus='served'|'waitlist'|'duplicate'|'ignored';
export async function submitSignup(input:SignupInput,fetcher:typeof fetch=fetch):Promise<SignupStatus>{
 if(!SIGNUP_URL)throw new Error('التسجيل مش متاح دلوقتي. كلمنا على واتساب.');
 if(!input.name.trim()||input.name.trim().length>120||!MINISTRIES.includes(input.ministry)||input.bus_line.length>160)throw new Error('راجع الاسم وجهة العمل وبيانات التسجيل.');
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetcher(SIGNUP_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...input,name:input.name.trim(),phone:normalizePhone(input.phone),bus_line:input.bus_line.trim()}),signal:controller.signal,redirect:'follow'});
  if(!response.ok)throw new Error('signup-http');
  const result=await response.json();
  if(result.ok!==true||!['served','waitlist','duplicate','ignored'].includes(result.status))throw new Error('signup-response');
  return result.status;
 }finally{clearTimeout(timeout);}
}
