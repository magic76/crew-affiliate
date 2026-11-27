const origin='https://hicrewapps.com';
const sql='INSERT INTO daily_metrics(day,page,event,provider,count) VALUES (?1,?2,?3,?4,1) ON CONFLICT(day,page,event,provider) DO UPDATE SET count=count+1';
const reply=(status,body=null)=>new Response(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex','Content-Type':'text/plain; charset=utf-8'}});
export function pageBucket(path,guides){
 if(typeof path!=='string'||path.length>180)return null;
 const clean=path.replace(/\/index(?:\.html)?$/,'/').replace(/\/$/,'')||'/';
 if(clean==='/index'||clean==='/index.html'||clean==='/')return '/';
 if(['/unit-price','/tools','/about','/search','/compare','/deals'].includes(clean))return clean+'/';
 if(/^\/categories\/[1-9]\d{0,15}$/.test(clean))return '/categories/';
 if(guides.some(g=>clean==='/guides/'+g.slug))return clean+'/';
 return null;
}
export async function recordMetric(request,env,guides,now=new Date()){
 if(new URL(request.url).origin!==origin)return reply(404);
 if(request.method!=='POST')return reply(405);
 if(request.headers.get('Origin')!==origin||request.headers.get('Sec-Fetch-Site')!=='same-origin')return reply(403);
 if(request.headers.get('Sec-GPC')==='1'||request.headers.get('DNT')==='1')return reply(204);
 if(env.METRICS_ENABLED!=='1'||!env.METRICS_DB)return reply(503);
 if(request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')return reply(415);
 let data;
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400);
  const chunks=[];let n=0;
  while(true){const {value,done}=await reader.read();if(done)break;n+=value.byteLength;if(n>512){await reader.cancel();return reply(413);}chunks.push(value);}
  const bytes=new Uint8Array(n);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  data=JSON.parse(new TextDecoder().decode(bytes));
 }catch{return reply(400);}
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!['page','event','provider'].includes(k)))return reply(400);
 const page=pageBucket(data.page,guides);
 const provider=data.event==='pageview'&&data.provider===''?'':data.event==='affiliate_click'&&['coupang','shopee'].includes(data.provider)?data.provider:null;
 if(!page||provider===null)return reply(400);
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 try{const result=await env.METRICS_DB.prepare(sql).bind(day,page,data.event,provider).run();if(!result.success)return reply(503);return reply(204);}catch{return reply(503);}
}
