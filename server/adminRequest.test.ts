import test from 'node:test';
import assert from 'node:assert/strict';
import {adminError,AdminError} from './adminRequest.ts';
function response(){return {statusCode:0,body:undefined as any,status(value:number){this.statusCode=value;return this},json(value:any){this.body=value;return this}};}
test('server database permission failures are distinguished from an unauthorized administrator',()=>{
 for(const code of [7,403,'permission-denied','PERMISSION_DENIED']){const res=response();adminError(res,{code,message:'secret provider diagnostics'});assert.equal(res.statusCode,503);assert.equal(res.body.code,'ADMIN_DATA_ACCESS_DENIED');assert.ok(res.body.incidentId);assert.doesNotMatch(JSON.stringify(res.body),/secret provider diagnostics/);}
 const res=response();adminError(res,new AdminError(403,'هذه العملية للإدارة فقط.'));assert.equal(res.statusCode,403);assert.equal(res.body.incidentId,undefined);
});
test('unexpected administration failures receive a safe trace identifier',()=>{
 const res=response();adminError(res,new Error('private server detail'));assert.equal(res.body.code,'ADMIN_SERVICE_FAILED');assert.ok(res.body.incidentId);assert.doesNotMatch(JSON.stringify(res.body),/private server detail/);
});

test('authentication service permission failure is not blamed on the user session',()=>{
 const res=response();adminError(res,{code:'auth/insufficient-permission'});assert.equal(res.statusCode,503);assert.equal(res.body.code,'ADMIN_AUTH_ACCESS_DENIED');
});
