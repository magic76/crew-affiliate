import {adminPage} from '../../src/admin.mjs';
import guides from '../../data/guides.json';
export const onRequest=({request,env})=>adminPage(request,env,guides);
