// Visual/interaction checks with local module mocks only: no authentication or database requests.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const base='http://127.0.0.1:3136';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','3136','--strictPort'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{await fetch(base);break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
 const errors=[],external=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.setDefaultTimeout(10000);
 await page.route(/https:\/\//,route=>{external.push(route.request().url());return route.abort();});
 await page.route(/\/src\/lib\/firebase(?:\.ts)?(?:\?|$)/,route=>route.fulfill({contentType:'text/javascript',body:`export const auth={currentUser:{uid:'layout-test'}};export const db={};export async function saveRecord(...args){window.__saved=args;}export async function deleteRecord(){}export async function updateKitchenStage(){}` }));
 await page.route(/\/src\/lib\/adminApi(?:\.ts)?(?:\?|$)/,route=>route.fulfill({contentType:'text/javascript',body:`export async function adminApi(){return {users:[],nextPageToken:null,events:[{id:'visual-test',createdAt:'2026-10-22T09:00:00Z',actorUid:'visual-only',actorEmail:'test@example.com',action:'catalog.update',entityType:'products',entityId:'layout-only',status:'success',reason:'اختبار محلي',changedFields:['name'],before:{name:'قبل'},after:{name:'بعد'}}],nextCursor:null};}` }));
 await page.route('**/src/main.tsx*',route=>route.fulfill({contentType:'text/javascript',body:`import React from '/node_modules/.vite/deps/react.js';import Client from'/node_modules/.vite/deps/react-dom_client.js';const{createRoot}=Client;import'/src/index.css';import'/src/admin.css';import{AdminWorkspace}from'/src/components/AdminWorkspace.tsx';import{AdminDashboard}from'/src/components/AdminDashboard.tsx';const h=React.createElement;const stores=[{id:'visual-store',name:'متجر للاختبار المحلي',nameEn:'Test',type:'مطعم',category:'breakfast',status:'closed',locationInDistrict:'عنوان للاختبار',minOrder:0,deliveryFee:0}];const data={orders:[],stores,products:[],couriers:[],staff:[],coupons:[],connected:true,onError:console.error};createRoot(document.getElementById('root')).render(h('div',{className:'admin-app',dir:'rtl'},h('header',{className:'admin-global-header'},h('div',{style:{display:'flex',alignItems:'center',padding:'12px 24px'}},h('strong',null,'طلبات العاصمة — الإدارة'),h('div',{id:'admin-header-search'}))),h(AdminWorkspace,data,h(AdminDashboard,{...data,partnerApplications:[],jobApplications:[]}))));` }));
 await page.goto(base+'/#catalog');
 await page.getByRole('button',{name:'إضافة منتج',exact:true}).waitFor();
 await page.getByRole('button',{name:'المتاجر',exact:true}).click();
 await page.getByRole('button',{name:'إضافة متجر',exact:true}).click();
 let dialog=page.getByRole('dialog',{name:'إضافة متجر',exact:true});await dialog.waitFor();
 const name=dialog.getByLabel('اسم المتجر',{exact:true}),english=dialog.getByLabel('الاسم بالإنجليزية — اختياري',{exact:true});
 const first=await name.boundingBox(),second=await english.boundingBox();assert.ok(Math.abs(first.y-second.y)<2,'desktop fields should share a row');
 assert.ok(first.height<=44,'inputs should remain compact');
 await page.screenshot({path:'/tmp/admin-store-desktop.png'});
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'dialog overflow '+width);
  const form=dialog.locator('form');await form.evaluate(el=>el.scrollTop=el.scrollHeight);
  const save=await dialog.getByRole('button',{name:'إضافة المتجر',exact:true}).boundingBox();assert.ok(save.y>=0&&save.y+save.height<=901,'save stays visible '+width);
  if(width===390){await form.evaluate(el=>el.scrollTop=0);const a=await name.boundingBox(),b=await english.boundingBox();assert.ok(b.y>a.y+a.height,'phone uses stacked fields');await page.screenshot({path:'/tmp/admin-store-mobile.png'});}
 }
 await page.setViewportSize({width:1440,height:960});await name.fill('متجر اختبار التصميم');await dialog.getByLabel('عنوان المتجر',{exact:true}).fill('عنوان اختبار محلي');await dialog.getByLabel('نوع النشاط',{exact:true}).fill('مطعم');await dialog.getByRole('button',{name:'إضافة المتجر',exact:true}).click();await dialog.waitFor({state:'hidden'});
 const saved=await page.evaluate(()=>window.__saved);assert.equal(saved[0],'stores');assert.equal(saved[2].name,'متجر اختبار التصميم');assert.equal(saved[2].locationInDistrict,'عنوان اختبار محلي');
 await page.getByRole('button',{name:'المنتجات',exact:true}).click();await page.getByRole('button',{name:'إضافة منتج',exact:true}).click();dialog=page.getByRole('dialog',{name:'إضافة منتج',exact:true});await dialog.waitFor();assert.equal(await dialog.locator('.admin-form-section').count(),3);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 for(const section of ['مركز العمليات','شاشة المطبخ','المستخدمون','سجل التدقيق','الفريق والخصومات','الطلبات والتقديمات']){
  await page.getByRole('button',{name:section,exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,section);
  if(section==='المستخدمون'){
   await page.getByRole('button',{name:'إضافة مستخدم',exact:true}).click();const user=page.getByRole('dialog',{name:'إضافة مستخدم',exact:true});await user.waitFor();await page.screenshot({path:'/tmp/admin-users-desktop.png'});await page.setViewportSize({width:390,height:844});await user.locator('form').evaluate(el=>el.scrollTop=el.scrollHeight);await user.getByRole('button',{name:'إلغاء',exact:true}).click();await user.waitFor({state:'hidden'});await page.setViewportSize({width:1440,height:960});
  }
  if(section==='سجل التدقيق'){await page.getByRole('button',{name:'عرض التغيير',exact:true}).click();await page.getByRole('dialog',{name:'تفاصيل العملية',exact:true}).waitFor();await page.screenshot({path:'/tmp/admin-audit-desktop.png'});await page.keyboard.press('Escape');}
 }
 for(const width of [320,390,768,1440]){for(const section of ['operations','catalog','users','audit','kitchen','settings','management']){
  await page.setViewportSize({width,height:900});await page.goto(base+'/?layout='+width+'-'+section+'#'+section);await page.locator('#admin-content').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,section+' page overflow '+width);
 }}
 assert.deepEqual(errors,[]);assert.equal(external.filter(url=>/firestore|identitytoolkit|\/api\//.test(url)).length,0);
 console.log('Admin layout passed: desktop/mobile modal geometry, sticky actions, catalog payload preserved using mocked save, all workspace sections, users and audit. No live backend calls.');
}finally{await browser?.close();server.kill('SIGTERM');}
