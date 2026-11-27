import {ingestReport} from '../../src/report-ingest.mjs';
export const onRequest=({request,env})=>ingestReport(request,env);
