import {parseCatalogRows} from '../utils/catalogImport';
const workbooks=new WeakMap<File,Promise<{sheet:string;data:unknown[][]}[]>>();
async function load(file:File){
 if(!/\.xlsx$/i.test(file.name)||file.size>10*1024*1024)throw new Error('اختر ملف Excel بصيغة XLSX حتى 10 ميجابايت.');
 let pending=workbooks.get(file);if(!pending){pending=import('read-excel-file/browser').then(({default:read})=>read(file));workbooks.set(file,pending);}return pending;
}
export async function readCatalogWorkbook(file:File,sheet:string){
 const found=(await load(file)).find(s=>s.sheet===sheet);if(!found)throw new Error('ورقة العمل غير موجودة.');return parseCatalogRows(found.data);
}
export async function catalogSheetNames(file:File):Promise<string[]>{return (await load(file)).map(s=>s.sheet);}
