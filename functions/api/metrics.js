import {recordMetric} from '../../src/metrics.mjs';
import guides from '../../data/guides.json';
export const onRequest=({request,env})=>recordMetric(request,env,guides);
