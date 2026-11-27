import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {collectGsc,buildReport,reportWindow} from '../src/private-report.mjs';
try{
 const [mode,output,input]=process.argv.slice(2);
 if(!['gsc','report'].includes(mode)||!output||!isAbsolute(output))throw Error('Usage: gsc ABSOLUTE_OUTPUT or report ABSOLUTE_OUTPUT INPUT_JSON');
 const root=await realpath(process.cwd()),parent=await realpath(dirname(output)),rel=relative(root,parent);
 if(!(rel==='..'||rel.startsWith('../')))throw Error('Output must be outside checkout');
 const result=mode==='gsc'?await collectGsc(process.env.GSC_ACCESS_TOKEN,reportWindow()):buildReport(JSON.parse(await readFile(input,'utf8')));
 await writeFile(resolve(output),JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log('Private report generated; no data printed or uploaded.');
}catch{console.error('Private report failed. Verify inputs, authorization and output path; no raw data printed.');process.exitCode=1;}
