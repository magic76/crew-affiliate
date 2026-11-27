import {catalogApi} from '../../src/live-catalog.mjs';
export const onRequest=({request,env})=>catalogApi(request,env);
