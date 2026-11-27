import {privateIngest} from '../../src/private-ingest.mjs';
export const onRequest=({request,env})=>privateIngest(request,env,'draft');
