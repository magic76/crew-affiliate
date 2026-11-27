// Explicit editorial allowlist. New pages remain noindex until reviewed.
export const APPROVED_GUIDES=Object.freeze(['usb-c-phone-charger','usb-c-cable-60w-100w','travel-multiport-charger']);
export function indexable(path){return ['index.html','tools/index.html','unit-price/index.html','about/index.html',...APPROVED_GUIDES.map(slug=>'guides/'+slug+'/index.html')].includes(path);}
export function canonicalPath(path){return '/'+path.replace(/index\.html$/,'');}
