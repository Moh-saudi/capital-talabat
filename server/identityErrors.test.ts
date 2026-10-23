import test from 'node:test';
import assert from 'node:assert/strict';
import {isInvalidIdentityError} from './identityErrors.ts';
test('invalid sessions are separated from server authentication failures',()=>{
 for(const code of ['auth/id-token-expired','auth/id-token-revoked','auth/argument-error','auth/user-disabled'])assert.equal(isInvalidIdentityError({code}),true);
 for(const code of ['auth/insufficient-permission','auth/invalid-credential','auth/internal-error','ECONNRESET'])assert.equal(isInvalidIdentityError({code}),false);
 assert.equal(isInvalidIdentityError(new Error('provider detail')),false);
});
