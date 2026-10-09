/* 代理商每日消耗跟踪一页纸 */
let DATA=null, cur=0, chart=null;
function curFromHash(){const i=parseInt(location.hash.slice(1));return isNaN(i)?0:Math.max(0,Math.min(7,i));}
cur=curFromHash();
const $=s=>document.querySelector(s);
const wan=v=>v/10000;
const f0=v=>Number(v).toLocaleString('zh-CN');
const f1=v=>Number(v).toLocaleString('zh-CN',{maximumFractionDigits:1,minimumFractionDigits:1});
const f2=v=>Number(v).toLocaleString('zh-CN',{maximumFractionDigits:2,minimumFractionDigits:2});
const pct=(v,d=1)=>(v*100).toFixed(d)+'%';
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');

/* ---------- CSV 导出全名单 ---------- */
function csvCell(v){v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function downloadCSV(name,headers,rows){
  const lines=[headers.map(csvCell).join(',')].concat(rows.map(r=>r.map(csvCell).join(',')));
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
const rank=(arr,i)=>arr.map((x,n)=>[n+1].concat(x));

/* ---------- 使用情况埋点 ---------- */
const EXPORT_LABEL={t1spend:'T1消耗',t1gain:'T1增量',t1loss:'T1掉量',
  wlost:'钱包流失',wtop:'钱包Top客户',tflow:'转户流失'};
function xcSession(){
  try{
    let s=localStorage.getItem('xc-sid');
    if(!s){s='s_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);localStorage.setItem('xc-sid',s);}
    return s;
  }catch(e){return 's_nostore';}
}
function xcKey(){
  const seg=location.pathname.split('/').filter(Boolean);
  return seg.length?seg[seg.length-1]:'';
}
function xcBeacon(payload){
  const cfg=DATA.usageCfg;
  if(!cfg||!cfg.url) return;
  try{
    const data=Object.assign({sessionId:xcSession(),key:xcKey(),ua:navigator.userAgent},payload);
    fetch(cfg.url,{method:'POST',mode:'cors',keepalive:true,
      headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).catch(()=>{});
  }catch(e){}
}

window.xcExport=function(kind){
  const a=DATA.agents[cur]; const date=DATA.dataDate;
  xcBeacon({event:'导出名单',exportType:EXPORT_LABEL[kind]||kind,agent:a.name});
  let name,headers,rows,t;
  if(kind==='t1spend'){
    t=a.t1.spendAll||[]; headers=['排名','客户名称','千川消耗(万元)'];
    rows=t.map(x=>[x.name,f2(x.cost)]); name=`${a.short}_T1消耗全名单_${date}.csv`;
  }else if(kind==='t1gain'){
    t=a.t1.gainAll||[]; headers=['排名','客户名称','消耗增量(万元)'];
    rows=t.map(x=>[x.name,(x.delta>0?'+':'')+f2(x.delta)]); name=`${a.short}_T1增量全名单_${date}.csv`;
  }else if(kind==='t1loss'){
    t=a.t1.lossAll||[]; headers=['排名','客户名称','消耗掉量(万元)'];
    rows=t.map(x=>[x.name,f2(x.delta)]); name=`${a.short}_T1掉量全名单_${date}.csv`;
  }else if(kind==='wlost'){
    t=a.wallet.lostFull||[]; headers=['排名','客户名称','7月闭环千川日耗(万元)'];
    rows=t.map(x=>[x.name,f2(x.julDayWan)]); name=`${a.short}_钱包流失全名单_${date}.csv`;
  }else if(kind==='wtop'){
    t=a.wallet.topFull||[]; headers=['排名','客户名称','千川日耗(万元)','我的份额','+5pp增量(万元)'];
    rows=t.map(x=>[x.name,f2(x.custDayWan),(x.pen*100).toFixed(1)+'%',f2(x.pp5DayWan)]); name=`${a.short}_钱包Top客户全名单_${date}.csv`;
  }else if(kind==='tflow'){
    t=(a.transfer&&a.transfer.lostFull30d)||[]; headers=['排名','客户名称','转户事件数','年度累计消耗(万元)'];
    rows=t.map(x=>[x.name,x.events,f2(x.costWan)]); name=`${a.short}_转户流失全名单_${date}.csv`;
  }
  rows=rank(rows);
  downloadCSV(name,headers,rows);
};

function ratioTag(r){
  if(r===null||r===undefined) return '<span class="flat">环比 —</span>';
  const cls=r>0?'up':(r<0?'down':'flat');
  const arrow=r>0?'▲':(r<0?'▼':'·');
  return `<span class="${cls}">环比 ${arrow} ${pct(Math.abs(r))}</span>`;
}

function buildTabs(){
  const t=$('#tabs');
  if(DATA.agents.length===1){t.style.display='none';return;}
  t.innerHTML=DATA.agents.map((a,i)=>
    `<div class="tab ${i===cur?'active':''}" data-i="${i}">${a.short}</div>`).join('')
    +`<div class="tools"><button class="btn" id="printBtn">🖨 打印/导出本页</button></div>`;
  t.querySelectorAll('.tab').forEach(el=>el.onclick=()=>{location.hash=el.dataset.i;});
  $('#printBtn').onclick=()=>window.print();
}

/* ---------- KPI ---------- */
function kpiBlock(a,y){
  return `
  <div class="sec span-12">
    <div class="sec-t"><span class="bar"></span>业绩概览（${DATA.dataDate} 当日）</div>
    <div class="kpis">
      <div class="kpi"><div class="l">整体业绩消耗</div><div class="v">${f1(wan(y.performance))}<small>万</small></div></div>
      <div class="kpi"><div class="l">千川消耗</div><div class="v">${f1(a.qcYesterdayWan)}<small>万</small></div><div class="d">${ratioTag(y.qcRatio)}</div></div>
      <div class="kpi"><div class="l">品牌消耗</div><div class="v">${a.brandYesterdayWan<10?f2(a.brandYesterdayWan):f1(a.brandYesterdayWan)}<small>万</small></div></div>
      <div class="kpi"><div class="l">星图消耗</div><div class="v">${f1(wan(y.star))}<small>万</small></div></div>
      <div class="kpi"><div class="l">AD 消耗</div><div class="v">${f1(wan(y.ad))}<small>万</small></div></div>
      <div class="kpi"><div class="l">Q4 千川累计</div><div class="v">${f1(a.qcQ4Wan)}<small>万</small></div></div>
    </div>
  </div>`;
}

/* ---------- Double11 ---------- */
function d11Block(a){
  const inf=a.qcInflate, pos=inf>=0;
  const badge=`<span class="badge ${pos?'pos':'neg'}">${pos?'膨胀':'负膨胀'} ${pos?'▲':'▼'} ${pct(Math.abs(inf))}</span>`;
  const gap=a.d11GapWan;
  const note=`千川昨日 <b>${f1(a.qcYesterdayWan)} 万</b>，较参考期日耗 ${f1(a.refQcWan)} 万 ${pos?'膨胀':'负膨胀'} ${pct(Math.abs(inf))}（${pos?'+':''}${f1(a.qcYesterdayWan-a.refQcWan)} 万）；`
    +`距双十一目标 <b>${f0(a.d11GoalWan)} 万</b> 还差 <b style="color:var(--red)">${f1(gap)} 万</b>，当前达成 ${pct(a.d11GoalAch)}。`;
  return `
  <div class="sec d11 span-12">
    <div class="sec-t"><span class="bar"></span>双十一千川冲刺 · 参考期膨胀与目标 Gap<span class="hint">核心看千川</span></div>
    <div class="d11-grid">
      <div class="d11-card">
        <div class="l">最近一天千川消耗（${DATA.dataDate.slice(5)}）</div>
        <div class="v">${f1(a.qcYesterdayWan)}<small> 万</small></div>
        <div class="s">${ratioTag(a.yesterday.qcRatio)}</div>
      </div>
      <div class="d11-card">
        <div class="l">参考期千川日耗</div>
        <div class="v">${f1(a.refQcWan)}<small> 万</small></div>
        ${badge}
      </div>
      <div class="d11-card" style="border-color:#f3c9c2;background:linear-gradient(180deg,#fff8f6,#fff)">
        <div class="l">双十一千川目标</div>
        <div class="v" style="color:${gap>0?'#b91c1c':'#059669'}">${f0(a.d11GoalWan)}<small> 万</small></div>
        <div class="s" style="font-weight:700;color:var(--red)">Gap ${f1(gap)} 万 · 达成 ${pct(a.d11GoalAch)}</div>
      </div>
    </div>
    <div class="d11-note">${note}</div>
  </div>`;
}

/* ---------- Chart ---------- */
function chartBlock(a,y){
  return `
  <div class="sec span-12">
    <div class="sec-t"><span class="bar"></span>千川日耗明细（10.02–10.08）<span class="hint">单位：万元</span></div>
    <div class="chart-sum">
      <span>本期合计 <b>${f1(wan(a.qcTotal7))} 万</b></span>
      <span>官方参考期日耗 <b>${f1(a.refQcWan)} 万</b></span>
      <span>${ratioTag(y.qcRatio)}</span>
    </div>
    <div class="chart-box" id="qcChart"></div>
  </div>`;
}

/* ---------- T-1 customer board ---------- */
function t1List(items, kind){
  if(!items||!items.length) return `<div class="t1-empty">暂无数据</div>`;
  return '<ul class="t1-list">'+items.slice(0,10).map((x,i)=>{
    let v;
    if(kind==='spend') v=`<span class="vl">${f1(x.cost)} 万</span>`;
    else{
      const d=x.delta;
      const cls=d>0?'up':'down';
      v=`<span class="vl ${cls}">${d>0?'+':''}${f1(d)} 万</span>`;
    }
    return `<li><span class="rk">${i+1}</span><span class="nm" title="${esc(x.name)}">${esc(x.name)}</span>${v}</li>`;
  }).join('')+'</ul>';
}
function t1Block(a){
  const t=a.t1;
  const dlabel=t&&t.date?`T-1 · ${t.date}`:'T-1 客户榜';
  return `
  <div class="sec t1 span-12">
    <div class="sec-t"><span class="bar"></span>T-1 日千川客户风云榜<span class="hint">${dlabel}｜客户级闭环千川消耗</span></div>
    <div class="t1-cols">
      <div class="t1-col spend"><div class="ch">🏆 消耗 Top 10<button class="xbtn" onclick="xcExport('t1spend')">导出全名单 (${(t.spendAll||[]).length})</button></div>${t1List(t&&t.spend,'spend')}</div>
      <div class="t1-col gain"><div class="ch">🔥 增量 Top 10<button class="xbtn" onclick="xcExport('t1gain')">导出全名单 (${(t.gainAll||[]).length})</button></div>${t1List(t&&t.gain,'gain')}</div>
      <div class="t1-col loss"><div class="ch">❄️ 掉量 Top 10<button class="xbtn" onclick="xcExport('t1loss')">导出全名单 (${(t.lossAll||[]).length})</button></div>${t1List(t&&t.loss,'gain')}</div>
    </div>
  </div>`;
}

/* ---------- Goals ---------- */
function goalRow(label,curV,goalV,star){
  const r=goalV?curV/goalV:0;
  const w=Math.min(100,r*100);
  return `<div class="goal">
    <div class="goal-row"><span>${label}｜Q4累计 <b>${f1(curV)}</b> 万</span><span class="g">目标 ${f0(goalV)} 万 · 完成 ${pct(r)}</span></div>
    <div class="track"><div class="fill ${star?'star':''}" style="width:${w}%"></div></div>
  </div>`;
}
function goalsBlock(a){
  const timeR=DATA.q4DaysElapsed/DATA.q4DaysTotal;
  return `
  <div class="sec span-6">
    <div class="sec-t"><span class="bar"></span>Q4 品星目标进度<span class="hint">Q4 已过 ${DATA.q4DaysElapsed}/${DATA.q4DaysTotal} 天（${pct(timeR)}）</span></div>
    ${goalRow('品牌',a.brandQ4Wan,a.brandGoalWan,false)}
    ${goalRow('星图',a.starQ4Wan,a.starGoalWan,true)}
    <div class="goal-meta">Q4 千川累计 <b>${f1(a.qcQ4Wan)}</b> 万｜整体业绩累计 <b>${f1(a.perfQ4Wan)}</b> 万（10.01–${DATA.dataDate}）</div>
  </div>`;
}

/* ---------- Transfer ---------- */
function transferBlock(a){
  const t=a.transfer;
  if(!t) return '<div class="sec span-6"></div>';
  const m30=t['近30天'], ytd=t['YTD'];
  const net=m30.netExtAdv;
  const netColor=net>0?'#059669':(net<0?'#b45309':'#94a3b8');
  const ytdColor=ytd.netExtAdv>0?'#059669':'#dc2626';
  const lost=(t.topLost30d||[]).slice(0,5).map(x=>
    `<tr><td class="nm" title="${esc(x.cust)}">${esc(x.cust)}</td><td class="r">${x.adv}</td><td class="r">${f1(x.costWan)}</td></tr>`).join('');
  return `
  <div class="sec span-6">
    <div class="sec-t"><span class="bar" style="background:#d97706"></span>转户情况（千川）<span class="hint">转户窗口 近30天｜消耗为年度累计</span><button class="xbtn dark" onclick="xcExport('tflow')">导出全名单 (${(t.lostFull30d||[]).length})</button></div>
    <div class="tf-grid">
      <div class="tf-mini" style="border:1px solid #f0d6a8;background:#fffdf7"><div class="l">外部转出</div><div class="v" style="color:#b45309">${m30.outExt.adv}</div></div>
      <div class="tf-mini" style="border:1px solid #bbf0d2;background:#f7fffb"><div class="l">外部转入</div><div class="v" style="color:#059669">${m30.inExt.adv}</div></div>
      <div class="tf-mini" style="border-style:solid;background:#fff"><div class="l">外部净增</div><div class="v" style="color:${netColor}">${net>0?'+':''}${net}</div></div>
      <div class="tf-mini" style="border-style:solid;background:#fff"><div class="l">转出客户年度累计消耗</div><div class="v">${f1(m30.outExt.costWan)}<small> 万</small></div></div>
    </div>
    <div class="tf-sub">
      <b>YTD 外部</b>：转出 ${ytd.outExt.adv} ｜ 转入 ${ytd.inExt.adv} ｜ 净 <b style="color:${ytdColor}">${ytd.netExtAdv>0?'+':''}${ytd.netExtAdv}</b><br/>
      <b>近30天内部（8家之间）</b>：转出 ${m30.outInt.adv} ｜ 转入 ${m30.inInt.adv}
    </div>
    ${lost?`<table class="minitable"><thead><tr><th>近30天转出客户</th><th class="r">广告主</th><th class="r">年度累计消耗(万)</th></tr></thead><tbody>${lost}</tbody></table>`:''}
  </div>`;
}

/* ---------- Wallet ---------- */
function walletBlock(a){
  const w=a.wallet;
  if(!w) return '';
  const lost=(w.lostTop10||[]).slice(0,8).map(x=>
    `<tr><td class="nm" title="${esc(x.name)}">${esc(x.name)}</td><td class="r">${f1(x.julDayWan)}</td></tr>`).join('');
  const moreLost=Math.max(0,w.lostExtCount-(w.lostTop10||[]).length);
  const top=(w.top10||[]).slice(0,8).map(c=>{
    const p=c.pen||0;
    return `<tr><td class="nm" title="${esc(c.name)}">${esc(c.name)}</td>
      <td class="r">${f1(c.custDayWan)}</td>
      <td class="r"><span class="penbar"><i style="width:${Math.min(100,p*100)}%"></i></span>${(p*100).toFixed(1)}%</td>
      <td class="r">${f1(c.pp5DayWan)}</td></tr>`;
  }).join('');
  return `
  <div class="sec wallet span-12">
    <div class="sec-t"><span class="bar"></span>钱包份额（闭环千川）<span class="hint">投放模式＝闭环千川（product_tag_slice=3）｜份额＝本代理千川 ÷ 客户千川总耗</span></div>
    <div class="wallet-grid">
      <div class="wl-card">
        <div class="wt">① 7月有、10月后不在的客户<button class="xbtn" onclick="xcExport('wlost')">导出全名单 (${(w.lostFull||[]).length})</button></div>
        <div class="ws">7月窗口 07.01–07.31；10月在该代理无闭环千川消耗（已剔除8家内部流转）</div>
        <div class="wl-big">
          <div><div class="l">外部流失客户</div><div class="v">${w.lostExtCount}<small> 个</small></div></div>
          <div><div class="l">可增长日耗</div><div class="v">${f1(w.lostExtDayWan)}<small> 万</small></div></div>
        </div>
        <table class="minitable"><thead><tr><th>Top 客户(按7月闭环千川日耗)</th><th class="r">日耗(万)</th></tr></thead><tbody>${lost}</tbody></table>
        ${moreLost>0?`<div class="ws" style="margin-top:8px">其余 ${moreLost} 个客户未列示</div>`:''}
      </div>
      <div class="wl-card">
        <div class="wt">② 最新 Top10 客户份额<button class="xbtn" onclick="xcExport('wtop')">导出全名单 (${(w.topFull||[]).length})</button></div>
        <div class="ws">近14天 09.25–10.08，按客户闭环千川日耗排序</div>
        <div class="wl-big">
          <div><div class="l">Top10 客户日耗</div><div class="v">${f1(w.top10CustDayWan)}<small> 万</small></div></div>
          <div><div class="l">份额 +5pp 增量</div><div class="v" style="color:#4338ca">${f1(w.pp5DayWan)}<small> 万/日</small></div></div>
        </div>
        <table class="minitable"><thead><tr><th>客户</th><th class="r">千川日耗(万)</th><th class="r">我的份额</th><th class="r">+5pp(万)</th></tr></thead><tbody>${top}</tbody></table>
        <div class="ws" style="margin-top:9px">受剩余份额空间约束的<b>可实现增量约 <span style="color:#4338ca">${f1(w.pp5AchDayWan)} 万/日</span></b></div>
      </div>
    </div>
  </div>`;
}

/* ---------- render ---------- */
function render(){
  buildTabs();
  const a=DATA.agents[cur], y=a.yesterday;
  $('#pageRoot').innerHTML=`
  <div class="page">
   <div class="grid">
    <div class="hdr">
      <div>
        <h1>${esc(a.name)}</h1>
        <div class="tagline">Q4 双十一冲刺 · 每日消耗跟踪一页纸 <span class="pill">${a.short}</span></div>
      </div>
      <div class="meta">
        数据日期 <b>${DATA.dataDate}</b><br/>
        渠道经理 <b>陈日晖</b> · 第 ${cur+1}/${DATA.agents.length} 家<br/>
        口径 整体业绩 / 千川 / 品牌 / 星图
      </div>
    </div>

    ${kpiBlock(a,y)}
    ${d11Block(a)}
    ${chartBlock(a,y)}
    ${t1Block(a)}
    ${goalsBlock(a)}
    ${transferBlock(a)}
    ${walletBlock(a)}
    ${(DATA.usageCfg&&DATA.usageCfg.token)?usageBlock():''}

    <div class="foot">
      <b>数据来源</b>：渠道业绩看板（${DATA.dataDate} 快照）、D11跟踪表、《陈日晖代理Q4品星目标》、转户看板（report 15668836）、钱包份额数据集（dataset 4898252，闭环千川口径）。<br/>
      <b>口径</b>：金额单位万元；参考期日耗与双十一目标取自 D11 跟踪表，膨胀率 = 最近一天 ÷ 参考期日耗 − 1。<b>转户</b>按（广告主+转出+转入+成功时间+类型）去重，外部＝与8家之外；转户窗口为近30天，所列“消耗”为该广告主2026年度(01.01–10.08)累计消耗。<br/>
      <b>钱包份额</b>：严格筛选投放模式＝闭环千川；份额＝本代理千川 ÷ 客户跨代理千川总耗；流失＝7月有、10月在该代理无消耗。<b>T-1 客户榜</b>：客户级闭环千川消耗及环比。生成时间 2026-10-09。
    </div>
   </div>
  </div>`;
  drawChart(a);
  if(DATA.usageCfg&&DATA.usageCfg.token){loadUsage();}
  else{xcBeacon({event:'访问',agent:a.name});}
}

/* ---------- 总览：代理使用情况看板 ---------- */
function usageBlock(){
  return `
  <div class="card usage-card" style="grid-column:1/-1;margin-top:4px">
    <div class="wt" style="display:flex;align-items:center">
      <h3 style="margin:0">📊 代理商使用情况跟踪</h3>
      <span style="margin-left:10px;font-size:11px;color:#94a3b8">访问 / 导出实时埋点 · 仅管理员可见</span>
      <button class="xbtn dark" style="margin-left:auto" onclick="loadUsage()">刷新</button>
    </div>
    <div id="usagePanel" style="margin-top:10px;font-size:12px;color:#64748b">正在加载使用数据…</div>
  </div>`;
}
async function loadUsage(){
  const box=$('#usagePanel'); if(!box) return;
  const cfg=DATA.usageCfg;
  try{
    const r=await fetch(cfg.url,{headers:{'x-admin-token':cfg.token}});
    const d=await r.json();
    const summary=d.summary||{};
    const rows=(summary.agents||[]).slice().sort((x,y)=>y.visits-x.visits);
    if(!rows.length){box.innerHTML='暂无使用数据。';return;}
    const maxV=Math.max(...rows.map(x=>x.visits),1);
    const daily=summary.daily||[];
    const dmax=Math.max(...daily.map(x=>x.count),1);
    box.innerHTML=`
    ${daily.length?`<div style="display:flex;align-items:flex-end;gap:6px;margin:2px 0 12px">
      <span style="font-size:11px;color:#94a3b8;margin-right:4px">近7天</span>
      ${daily.map(x=>`<div title="${new Date(x.date).toISOString().slice(0,10)}：${x.count}次"
        style="width:26px;height:${Math.max(4,Math.round(x.count/dmax*34))}px;border-radius:4px 4px 0 0;
        background:linear-gradient(180deg,#60a5fa,#2563eb)"></div>`).join('')}
    </div>`:''}
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="color:#64748b;text-align:left">
        <th style="padding:6px 8px">代理商</th><th>访问</th><th>独立会话</th><th>导出次数</th>
        <th>最近访问</th><th>最近 IP</th><th style="width:200px">导出类型</th><th style="width:160px">访问热度</th>
      </tr></thead>
      <tbody>
      ${rows.map(x=>`<tr style="border-top:1px solid #eef1f6">
        <td style="padding:7px 8px;font-weight:700;color:#1e293b">${esc(x.agent||'-')}</td>
        <td><b>${x.visits||0}</b></td>
        <td>${x.uniqueSessions||0}</td>
        <td>${x.exports||0}</td>
        <td style="color:#64748b">${x.lastSeen?esc(new Date(x.lastSeen).toLocaleString('zh-CN',{hour12:false}).slice(5,16)):'-'}</td>
        <td style="color:#94a3b8">${esc(x.lastIP||'-')}</td>
        <td style="font-size:11px;color:#926a1c">${esc(Object.entries(x.exportKinds||{}).map(([k,v])=>k+'×'+v).join('，')||'—')}</td>
        <td><div style="height:8px;border-radius:4px;width:${Math.round((x.visits/maxV)*100)}%;background:linear-gradient(90deg,#2563eb,#60a5fa)"></div></td>
      </tr>`).join('')}
      </tbody>
    </table>`;
  }catch(e){box.innerHTML='使用数据加载失败：'+esc(e.message);}
}

function drawChart(a){
  const el=$('#qcChart');
  if(chart){chart.dispose();chart=null;}
  chart=echarts.init(el);
  const data=a.qcSeries.map(v=>+wan(v).toFixed(1));
  const ref=+a.refQcWan.toFixed(1);
  const yMax=Math.ceil(Math.max(...data,ref)*1.12/10)*10;
  chart.setOption({
    grid:{left:56,right:44,top:40,bottom:36},
    tooltip:{trigger:'axis',valueFormatter:v=>v+' 万'},
    xAxis:{type:'category',boundaryGap:false,data:a.dates,
      axisLine:{lineStyle:{color:'#cbd5e1'}},axisLabel:{color:'#64748b'}},
    yAxis:{type:'value',name:'万元',max:yMax,nameTextStyle:{color:'#94a3b8'},
      splitLine:{lineStyle:{color:'#eef1f6'}},axisLabel:{color:'#94a3b8'}},
    series:[{
      type:'line',data,smooth:true,symbol:'circle',symbolSize:8,
      lineStyle:{width:3,color:'#1d4ed8'},
      itemStyle:{color:'#1d4ed8',borderColor:'#fff',borderWidth:2},
      label:{show:true,position:'top',color:'#1e3a8a',fontWeight:700,formatter:'{c}'},
      areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[
        {offset:0,color:'rgba(29,78,216,.22)'},{offset:1,color:'rgba(29,78,216,.01)'}])},
      markLine:{symbol:'none',data:[{yAxis:ref,name:'参考期日耗',
        lineStyle:{color:'#d97706',type:'dashed',width:1.5},
        label:{formatter:'参考期日耗 '+ref,color:'#d97706',position:'insideEndTop'}}]}
    }]
  });
}

fetch('data.json').then(r=>r.json()).then(d=>{DATA=d;render();});
window.addEventListener('hashchange',()=>{cur=curFromHash();if(DATA)render();});
window.addEventListener('resize',()=>{if(chart)chart.resize();});
