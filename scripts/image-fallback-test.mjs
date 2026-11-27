import assert from 'node:assert/strict';
import vm from 'node:vm';
import {imageFallbackClient,imageFallbackSvg} from '../src/product-image-assets.mjs';
class Img{constructor(marked=true,complete=false,width=0){this.marked=marked;this.complete=complete;this.naturalWidth=width;this.alt='';this.src='https://image.example/product';}hasAttribute(k){return k==='data-product-image'&&this.marked;}removeAttribute(){this.marked=false;}}
const handlers={},failed=new Img(true,true),loaded=new Img(true,true,100),pending=new Img(true,false),unmarked=new Img(false,true);
const document={addEventListener(name,fn,opts){handlers[name]=fn;if(name==='error')assert.equal(opts,true);},querySelectorAll(){return [failed,loaded,pending,unmarked];}};
vm.runInNewContext(imageFallbackClient,{document,HTMLImageElement:Img});
handlers.DOMContentLoaded();assert.equal(failed.src,'/assets/product-unavailable.svg');assert(!failed.marked);assert.equal(loaded.src,'https://image.example/product');assert.equal(pending.src,'https://image.example/product');assert.equal(unmarked.src,'https://image.example/product');
handlers.error({target:pending});assert.equal(pending.src,'/assets/product-unavailable.svg');assert.equal(pending.alt,'商品圖片暫時無法顯示');pending.src='test-failed-fallback';handlers.error({target:pending});assert.equal(pending.src,'test-failed-fallback');assert(imageFallbackSvg.includes('暫時無法顯示'));console.log('Product image fallback checks passed');
