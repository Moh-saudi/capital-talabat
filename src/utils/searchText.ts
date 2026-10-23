/** Shared Arabic/Latin query normalization; no provider-specific code in the browser. */
export function normalizeSearch(value:unknown):string{
 return String(value??'').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[^\p{L}\p{N}@.+_-]+/gu,' ').trim().replace(/\s+/g,' ');
}
