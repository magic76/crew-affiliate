import assert from 'node:assert/strict';
import {unitPrice,unitMarkup} from '../src/unit-price.mjs';
assert.deepEqual(unitPrice(200,40,12,100),{total:240,amount:1200,per:0.2});
assert.equal(unitPrice(300,0,2,1500,100).per,10);
assert.equal(unitPrice(0,0,1,1).per,0);
for(const args of [[-1,0,1,1],[1,-1,1,1],[1,0,0,1],[1,0,1,0],[1,0,1.5,1],[NaN,0,1,1],[Infinity,0,1,1]])assert.equal(unitPrice(...args),null);
assert(unitMarkup().includes('每100毫升'));assert(unitMarkup().includes('預設數字只供試算'));
console.log('Unit price checks passed');
