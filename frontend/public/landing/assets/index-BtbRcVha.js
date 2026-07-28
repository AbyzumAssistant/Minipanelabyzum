function g(){const t=["port","same-origin","/launcher/download","get","location","815uhxvps","/api/backend","2976234uspdOM","trim","childList","2772165KFIspV","crossOrigin","3WEKQdS","replace","credentials","json","/modrinth/deploy/","modulepreload","&gt;","SYAiM","origin","landing","addEventListener","3739150jvHBkC","setTimeout","no-store","innerHTML","522FYNurf","server","launcherRevision","mods","/manifest","click","use-credentials","/landing/","observe","download-btn","type","writeText","supports","referrerPolicy","7sQUYSg","TNbtc","34728dthtST",`</strong><span>Minecraft</span></div>
          <div class="stat"><strong>Forge</strong><span>Mod loader</span></div>
        </div>
        <p class="note">Dirección del servidor</p>
        <p class="address">`,"fmpyN"," · Revisión launcher v","bNrCF","filter","querySelector","gameVersion","BmSoX","Falta el parámetro ?server=ID en la URL.","link","6932IRUhse","21160zggKAl","length","integrity","textContent","prompt","content","1068705NlxLoO","disabled"];return g=function(){return t},g()}(function(t,x){const n=d,e=t();for(;;)try{if(-parseInt(n(518))/1*(parseInt(n(498))/2)+-parseInt(n(504))/3+-parseInt(n(497))/4*(-parseInt(n(511))/5)+-parseInt(n(513))/6*(parseInt(n(484))/7)+parseInt(n(486))/8*(parseInt(n(470))/9)+parseInt(n(466))/10+parseInt(n(516))/11===x)break;e.push(e.shift())}catch{e.push(e.shift())}})(g,276173),(function(){const x=d,n={mZsqc:function(r,o){return r===o},SEWtJ:x(460),DXPut:function(r,o){return r(o)},YHckQ:x(476),TNbtc:x(507)},e=document.createElement(x(496)).relList;if(e&&e[x(482)]&&e.supports(n.SEWtJ))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))i(r);new MutationObserver(r=>{const o=x;for(const s of r)if(s[o(480)]===o(515))for(const u of s.addedNodes)u.tagName==="LINK"&&n.mZsqc(u.rel,n.SEWtJ)&&n.DXPut(i,u)})[x(478)](document,{childList:!0,subtree:!0});function a(r){const o=x,s={};return r.integrity&&(s.integrity=r[o(500)]),r.referrerPolicy&&(s[o(483)]=r.referrerPolicy),r[o(517)]===n.YHckQ?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s[o(520)]=n[o(485)],s}function i(r){if(r.ep)return;r.ep=!0;const o=a(r);fetch(r.href,o)}})();function _(){var r;const t=d,x={JSISC:t(464),BmSoX:function(o,s){return o>=s},lhbGT:function(o,s){return o(s)}},n=new URLSearchParams(window.location.search),e=(r=n[t(509)](t(471)))==null?void 0:r[t(514)]();if(e)return e;const a=window.location.pathname.split("/")[t(491)](Boolean),i=a.indexOf(x.JSISC);return x[t(494)](i,0)&&a[i+1]?x.lhbGT(decodeURIComponent,a[i+1]):""}function d(t,x){return t=t-460,g()[t]}function w(){var n,e;const t=d,x=(e=(n=document[t(492)]('meta[name="api-base"]'))==null?void 0:n[t(503)])==null?void 0:e[t(514)]();return x?x.replace(/\/$/,""):window[t(510)].pathname.includes(t(477))?window[t(510)][t(463)]+t(512):"/api/backend"}async function y(t){const x=d,n={dZMww:function(a,i,r){return a(i,r)},kEYiA:function(a,i){return a(i)},gUXwr:"manifest"},e=await n.dZMww(fetch,w()+x(522)+n.kEYiA(encodeURIComponent,t)+x(474),{cache:x(468)});if(!e.ok)throw new Error(n.gUXwr);return e[x(521)]()}function I(t){const x=d,n={cyuAG:function(e,a){return e(a)}};return w()+x(522)+n.cyuAG(encodeURIComponent,t)+x(508)}function M(t){const x=d;t[x(469)]='<div class="loading">Cargando servidor…</div>'}function m(t,x){const n=d;t[n(469)]='<div class="shell"><div class="card"><p class="error">'+x+"</p></div></div>"}function L(t,x,n){var b,h,v;const e=d,a={XeOiP:"Descargar MCABYZUM Launcher (.zip)",rzPcL:"Copia la IP:",bNrCF:"43.3.0",fmpyN:"1.19.2",GuLwa:function(c,f){return c(f)},MoeeO:e(479),SYAiM:e(475)},i=((b=x[e(471)])==null?void 0:b.name)??n,r=x.server?x[e(471)].host+":"+x[e(471)][e(506)]:"—",o=((h=x.mods)==null?void 0:h[e(499)])??0,s=x.forgeBuild??a[e(490)],u=x[e(493)]??a[e(488)];t.innerHTML=`
    <div class="shell">
      <div class="hero">
        <img class="logo" src="./icon.svg" alt="MCABYZUM" width="88" height="88" />
        <div>
          <h1 class="title">`+a.GuLwa(p,i)+`</h1>
          <p class="subtitle">Descarga el launcher con mods, resource pack y conexión lista para entrar al servidor.</p>
        </div>
      </div>

      <div class="card">
        <p class="note">Forge `+p(u)+" · Build "+p(s)+e(489)+(x[e(472)]??0)+`</p>
        <div class="stats">
          <div class="stat"><strong>`+o+`</strong><span>Mods incluidos</span></div>
          <div class="stat"><strong>`+a.GuLwa(p,u)+e(487)+a.GuLwa(p,r)+`</p>
        <div class="actions">
          <button class="btn btn-primary" id="download-btn">Descargar MCABYZUM Launcher (.zip)</button>
          <button class="btn btn-secondary" id="copy-btn">Copiar IP</button>
        </div>
        <p class="note" style="margin-top:16px">
          1. Descarga y extrae el ZIP.<br/>
          2. Ejecuta <strong>MCABYZUM-Launcher.exe</strong>.<br/>
          3. Se instalan los mods y se copia la IP al portapapeles.<br/>
          4. Abre Minecraft → Multijugador → Directo y conecta.
        </p>
      </div>
    </div>
  `;const l=document.getElementById(a.MoeeO);l==null||l[e(465)](a[e(462)],()=>{const c=e;l instanceof HTMLButtonElement&&(l[c(505)]=!0,l.textContent="Preparando descarga…",window[c(510)].href=I(n),window[c(467)](()=>{const f=c;l.disabled=!1,l[f(501)]=a.XeOiP},4e3))}),(v=document.getElementById("copy-btn"))==null||v[e(465)]("click",async()=>{const c=e;if(!x.server)return;const f=x[c(471)].host+":"+x.server[c(506)];try{await navigator.clipboard[c(481)](f)}catch{window[c(502)](a.rzPcL,f)}})}function p(t){const x=d;return t.replace(/&/g,"&amp;").replace(/</g,"&lt;")[x(519)](/>/g,x(461)).replace(/"/g,"&quot;")}async function S(){var a;const t=d,x={iUbwi:function(i){return i()},gZloi:function(i,r,o){return i(r,o)},rAdSP:t(495),rcggN:"Este servidor aún no tiene mods publicados en el panel.",BOarT:function(i,r,o){return i(r,o)}},n=document.getElementById("app");if(!n)return;const e=x.iUbwi(_);if(!e){x.gZloi(m,n,x.rAdSP);return}M(n);try{const i=await y(e);if(!((a=i[t(473)])!=null&&a.length)){m(n,x.rcggN);return}L(n,i,e)}catch{x.BOarT(m,n,"No se pudo cargar la información del servidor.")}}S();
