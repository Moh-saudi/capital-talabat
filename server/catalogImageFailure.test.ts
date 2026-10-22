import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogImageFailure} from './catalogImageFailure.ts';

test('image diagnostics distinguish administration, storage configuration and audit failures',()=>{
 assert.equal(catalogImageFailure({code:'FIREBASE_ADMIN_NOT_CONFIGURED'},'authorization').code,'IMAGE_AUTH_SERVICE_NOT_CONFIGURED');
 assert.equal(catalogImageFailure(new Error('R2_NOT_CONFIGURED'),'storage-configuration').code,'IMAGE_STORAGE_NOT_CONFIGURED');
 assert.equal(catalogImageFailure(new Error('invalid URL'),'storage-configuration').code,'IMAGE_STORAGE_NOT_CONFIGURED');
 assert.equal(catalogImageFailure({},'audit').code,'IMAGE_AUDIT_UNAVAILABLE');
});
test('image failures never expose raw provider messages, keys or signed URLs',()=>{
 const result=catalogImageFailure({message:'private-key https://private.example?signature=secret',code:'SECRET_VALUE'},'storage-signing');
 assert.equal(result.code,'IMAGE_SERVICE_FAILED');assert.ok(result.incidentId);
 assert.doesNotMatch(JSON.stringify(result),/private-key|signature|SECRET_VALUE|private\.example/);
});
