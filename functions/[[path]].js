import {catalogPage} from '../src/live-catalog.mjs';
import guides from '../data/guides.json';
import products from '../data/products.json';
export const onRequest=({request,env,next})=>catalogPage(request,env,next,guides,products);
