// Generate only the utilities used by this legacy page, scoped to its root.
// Run: node scripts/build-terceiros-styles.cjs (from frontend).
const fs = require('node:fs');
const path = require('node:path');
const page = path.join(__dirname, '../src/pages/TerceirosPage');
const classes = [...new Set([...fs.readFileSync(page + '.tsx', 'utf8').matchAll(/className="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)))];
const colors = { white:'#fff', black:'#000', transparent:'transparent', 'slate-200':'#e2e8f0', 'slate-300':'#cbd5e1', 'slate-400':'#94a3b8', 'slate-500':'#64748b', 'slate-700':'#334155', 'slate-800':'#1e293b', 'slate-900':'#0f172a', 'cyan-300':'#67e8f9', 'cyan-400':'#22d3ee', 'cyan-500':'#06b6d4', 'cyan-800':'#155e75', 'cyan-950':'#083344', 'blue-500':'#3b82f6', 'blue-600':'#2563eb', 'emerald-400':'#34d399', 'emerald-500':'#10b981', 'emerald-900':'#064e3b', 'emerald-950':'#022c22', 'amber-400':'#fbbf24', 'amber-500':'#f59e0b', 'indigo-400':'#818cf8', 'indigo-500':'#6366f1', 'red-400':'#f87171', 'red-500':'#ef4444' };
function color(value) {
  const [name, opacity] = value.split('/');
  if (!colors[name]) return;
  return opacity ? `color-mix(in srgb, ${colors[name]} ${opacity}%, transparent)` : colors[name];
}
const fixed = {
  flex:'display:flex', grid:'display:grid', block:'display:block', hidden:'display:none', inline:'display:inline', 'inline-flex':'display:inline-flex', 'inline-block':'display:inline-block',
  'flex-col':'flex-direction:column', 'flex-row':'flex-direction:row', 'flex-wrap':'flex-wrap:wrap', 'flex-1':'flex:1 1 0%', 'flex-initial':'flex:0 1 auto', 'shrink-0':'flex-shrink:0',
  'items-center':'align-items:center', 'justify-between':'justify-content:space-between', 'justify-center':'justify-content:center', 'justify-end':'justify-content:flex-end',
  relative:'position:relative', absolute:'position:absolute', fixed:'position:fixed', 'inset-0':'inset:0', 'z-50':'z-index:50',
  'overflow-hidden':'overflow:hidden', 'overflow-x-auto':'overflow-x:auto', 'overflow-y-auto':'overflow-y:auto', 'pointer-events-none':'pointer-events:none', 'cursor-pointer':'cursor:pointer',
  'w-full':'width:100%', 'max-w-lg':'max-width:32rem', 'max-w-md':'max-width:28rem',
  border:'border:1px solid', 'border-b':'border-bottom:1px solid', 'border-t':'border-top:1px solid',
  'rounded-sm':'border-radius:2px', 'rounded-lg':'border-radius:8px', 'rounded-xl':'border-radius:12px', 'rounded-2xl':'border-radius:16px', 'rounded-full':'border-radius:9999px',
  'font-medium':'font-weight:500', 'font-semibold':'font-weight:600', 'font-bold':'font-weight:700',
  'text-xs':'font-size:12px;line-height:1.5', 'text-sm':'font-size:14px;line-height:1.5', 'text-base':'font-size:16px;line-height:1.5', 'text-xl':'font-size:20px;line-height:1.4', 'text-2xl':'font-size:24px;line-height:1.35',
  'text-left':'text-align:left', 'text-right':'text-align:right', 'text-center':'text-align:center', uppercase:'text-transform:uppercase', 'tracking-tight':'letter-spacing:-.025em', 'tracking-wider':'letter-spacing:.05em',
  truncate:'overflow:hidden;text-overflow:ellipsis;white-space:nowrap', 'whitespace-nowrap':'white-space:nowrap',
  'outline-none':'outline:none', 'top-1/2':'top:50%', '-translate-y-1/2':'transform:translateY(-50%)',
  'transition-all':'transition:all .2s ease', 'transition-colors':'transition:color .2s, background-color .2s, border-color .2s', 'duration-300':'animation-duration:.3s',
  'backdrop-blur-md':'backdrop-filter:blur(12px)', 'backdrop-blur-sm':'backdrop-filter:blur(4px)', 'blur-xl':'filter:blur(24px)',
  'shadow-inner':'box-shadow:inset 0 2px 4px #0001', 'shadow-md':'box-shadow:0 4px 6px #0002', 'shadow-lg':'box-shadow:0 10px 15px #0002', 'shadow-xl':'box-shadow:0 20px 25px #0003', 'shadow-2xl':'box-shadow:0 25px 50px #0004',
  'bg-gradient-to-r':'background-image:linear-gradient(to right,var(--tp-from),var(--tp-via,var(--tp-to)),var(--tp-to))',
  'animate-spin':'animation:terceiros-spin 1s linear infinite', 'animate-pulse':'animation:terceiros-pulse 2s ease-in-out infinite', 'fade-in':'animation:terceiros-fade .3s ease-out',
};
function declaration(token) {
  if (fixed[token]) return fixed[token];
  let m;
  if ((m=token.match(/^(bg|text|border|from|via|to|placeholder|divide|shadow)-(.+)$/))) {
    const c=color(m[2]);
    if(c) return ({bg:'background-color',text:'color',border:'border-color',from:'--tp-from',via:'--tp-via',to:'--tp-to',placeholder:'color',divide:'border-color',shadow:'--tp-shadow'})[m[1]]+':'+c;
  }
  if ((m=token.match(/^grid-cols-(\d)$/))) return `grid-template-columns:repeat(${m[1]},minmax(0,1fr))`;
  if (token==='col-span-2') return 'grid-column:span 2 / span 2';
  if ((m=token.match(/^scale-\[(.+)\]$/))) return `transform:scale(${m[1]})`;
  if ((m=token.match(/^(w|h|min-w|max-w|min-h|max-h|text)-\[(.+)\]$/))) return ({w:'width',h:'height','min-w':'min-width','max-w':'max-width','min-h':'min-height','max-h':'max-height',text:'font-size'})[m[1]]+':'+m[2];
  if ((m=token.match(/^(-?)(p[xytrbl]?|m[trbl]?|gap|w|h|right|bottom|left)-(\d+(?:\.\d+)?)$/))) {
    const props={p:['padding'],px:['padding-left','padding-right'],py:['padding-top','padding-bottom'],pt:['padding-top'],pb:['padding-bottom'],pl:['padding-left'],pr:['padding-right'],mt:['margin-top'],mb:['margin-bottom'],gap:['gap'],w:['width'],h:['height'],right:['right'],bottom:['bottom'],left:['left']};
    return props[m[2]].map(p=>`${p}:${m[1]}${Number(m[3])*.25}rem`).join(';');
  }
  if ((m=token.match(/^space-y-(\d+)$/))) return `margin-top:${Number(m[1])*.25}rem`;
  if(token==='divide-y') return 'border-top-width:1px;border-top-style:solid';
}
const ignored=new Set(['terceiros-page','group','animate-in']);
const rules=[];
for(const cls of classes) {
  if(ignored.has(cls)) continue;
  const parts=cls.split(':'); const token=parts.pop(); const variant=parts.pop();
  const decl=declaration(token);
  if(!decl) throw new Error(`Missing style: ${cls}`);
  const escaped=cls.replace(/([^a-zA-Z0-9_-])/g,'\\$1');
  let selector=`.terceiros-page.${escaped}, .terceiros-page .${escaped}`;
  if(['hover','focus','active'].includes(variant)) selector=selector.split(', ').map(s=>s+':'+variant).join(', ');
  if(variant==='group-hover') selector=`.terceiros-page .group:hover .${escaped}`;
  if(token.startsWith('space-y-')||token.startsWith('divide-')) selector=selector.split(', ').map(s=>s+' > * + *').join(', ');
  if(token.startsWith('placeholder-')) selector=selector.split(', ').map(s=>s+'::placeholder').join(', ');
  const rule=`${selector} { ${decl}; }`;
  rules.push(variant && {sm:640,md:768,lg:1024}[variant] ? `@media (min-width:${{sm:640,md:768,lg:1024}[variant]}px) { ${rule} }` : rule);
}
fs.writeFileSync(page+'.css',`/* Local styles for TerceirosPage. Generated by scripts/build-terceiros-styles.cjs. */
.terceiros-page { min-width:0; font-size:14px; }
.terceiros-page *, .terceiros-page *::before, .terceiros-page *::after { box-sizing:border-box; }
.terceiros-page svg { flex-shrink:0; }
.terceiros-page table { border-collapse:collapse; }
.terceiros-page th { font-weight:600; }
.terceiros-page select { width:auto; min-width:0; }
.terceiros-page button:disabled { opacity:.6; cursor:not-allowed; }
.terceiros-page button:focus-visible { outline:2px solid #22d3ee; outline-offset:3px; }
${rules.join('\n')}
/* Keep long forms accessible within shorter windows and mobile viewports. */
.terceiros-page .fixed { overflow-y:auto; }
.terceiros-page .fixed > div { max-height:calc(100dvh - 2rem); overflow-y:auto; margin:auto; }
.terceiros-page .grid > * { min-width:0; }
@media (max-width:767px) {
  .terceiros-page h1 { flex-wrap:wrap; }
  .terceiros-page .justify-between { flex-wrap:wrap; gap:12px; }
  .terceiros-page .min-w-\\[240px\\] { min-width:0; width:100%; }
  .terceiros-page table { min-width:960px; }
}
@keyframes terceiros-spin { to { transform:rotate(360deg); } }
@keyframes terceiros-pulse { 50% { opacity:.5; } }
@keyframes terceiros-fade { from { opacity:0; } to { opacity:1; } }
`);
console.log(`Generated ${rules.length} scoped styles.`);
