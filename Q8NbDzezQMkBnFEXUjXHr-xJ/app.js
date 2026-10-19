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
  wlost:'钱包流失',wtop:'钱包Top客户',tflow:'转户流失',
  wshrink:'客户缩量'};
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
    if(new URLSearchParams(location.search).get('nobeacon')==='1') return;
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
  }else if(kind==='wshrink'){
    t=a.wallet.shrinkFull||[]; headers=['排名','客户名称','7月份额','10月份额','7月日耗(万元)','10月日耗(万元)','缩量幅度'];
    rows=t.map(x=>[x.name,(x.penJul*100).toFixed(0)+'%',(x.penOct*100).toFixed(0)+'%',
      f2(x.julDayWan),f2(x.octDayWan),(x.downPct*100).toFixed(0)+'%']);
    name=`${a.short}_客户缩量全名单_${date}.csv`;
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
  const note=`千川昨日 <b>${f1(a.qcYesterdayWan)} 万</b>，较参考期日耗（7.14–7.20）${f1(a.refQcWan)} 万 ${pos?'膨胀':'负膨胀'} ${pct(Math.abs(inf))}（${pos?'+':''}${f1(a.qcYesterdayWan-a.refQcWan)} 万）；`
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
        <div class="l">参考期千川日耗（7.14–7.20）</div>
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
    <div class="sec-t"><span class="bar"></span>千川日耗明细（${a.dates[0]}–${a.dates[a.dates.length-1]}）<span class="hint">单位：万元</span></div>
    <div class="chart-sum">
      <span>本期合计 <b>${f1(wan(a.qcTotal7))} 万</b></span>
      <span>官方参考期日耗（7.14–7.20）<b>${f1(a.refQcWan)} 万</b></span>
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
  const netColor=net>0?'#059669':(net<0?'#dc2626':'#94a3b8');
  const ytdColor=ytd.netExtAdv>0?'#059669':'#dc2626';
  const lost=(t.topLost30d||[]).slice(0,5).map(x=>
    `<tr><td class="nm" title="${esc(x.cust)}">${esc(x.cust)}</td><td class="r">${x.adv}</td><td class="r">${f1(x.costWan)}</td></tr>`).join('');
  return `
  <div class="sec span-6">
    <div class="sec-t"><span class="bar" style="background:#d97706"></span>转户情况（千川）<span class="hint">转户窗口 近30天｜消耗为年度累计</span><button class="xbtn dark" onclick="xcExport('tflow')">导出全名单 (${(t.lostFull30d||[]).length})</button></div>
    <div class="tf-grid">
      <div class="tf-mini" style="border:1px solid #f3c9c2;background:#fff8f6"><div class="l">外部转出</div><div class="v" style="color:#dc2626">${m30.outExt.adv}</div></div>
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
  const shrink=(w.shrinkTop10||[]).slice(0,6).map(x=>
    `<tr><td class="nm" title="${esc(x.name)}">${esc(x.name)}</td>
      <td class="r">${f1(x.julDayWan)}</td>
      <td class="r" style="color:#dc2626">${f1(x.octDayWan)}</td>
      <td class="r" style="color:#dc2626">${(x.downPct*100).toFixed(0)}%</td></tr>`).join('');
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
      <div class="wl-card">
        <div class="wt">③ 客户缩量（份额仍稳）<button class="xbtn" onclick="xcExport('wshrink')">导出全名单 (${(w.shrinkFull||[]).length})</button></div>
        <div class="ws">客户整体暂停/收缩千川、本代理份额仍≥80%｜属客户经营健康度风险，需唤醒而非抢份额</div>
        <div class="wl-big">
          <div><div class="l">缩量客户</div><div class="v">${w.shrinkCount||0}<small> 个</small></div></div>
          <div><div class="l">较7月蒸发日耗</div><div class="v" style="color:#dc2626">${f1(w.shrinkLossDayWan)}<small> 万/日</small></div></div>
        </div>
        ${(w.shrinkFull||[]).length?`<table class="minitable"><thead><tr><th>客户</th><th class="r">7月日耗(万)</th><th class="r">10月日耗(万)</th><th class="r">降幅</th></tr></thead><tbody>${shrink}</tbody></table>`
          :`<div class="ws" style="margin-top:10px">✓ 无明显客户缩量</div>`}
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
    ${(DATA.feedbackCfg&&DATA.feedbackCfg.url)?feedbackBlock(a):''}
    ${(DATA.usageCfg&&DATA.usageCfg.token)?usageBlock():''}
    ${(DATA.feedbackCfg&&DATA.feedbackCfg.token)?fbAdminBlock():''}

    <div class="foot">
      <b>数据来源</b>：渠道业绩看板（${DATA.dataDate} 快照）、D11跟踪表、《陈日晖代理Q4品星目标》、转户看板（report 15668836）、钱包份额数据集（dataset 4898252，闭环千川口径）。<br/>
      <b>口径</b>：金额单位万元；参考期＝26D11 官方基期（2026.07.14–07.20）业绩消耗日均，取官方《E组-千川-26D11基期数据》始终最新集团口径，双十一目标为老板下发的大促日均目标，膨胀率 = 最近一天 ÷ 参考期日耗 − 1。<b>转户</b>按（广告主+转出+转入+成功时间+类型）去重，外部＝与8家之外；转户窗口为近30天，所列“消耗”为该广告主2026年度(01.01–${DATA.dataDate.slice(5).replace('-','.')})累计消耗。<br/>
      <b>钱包份额</b>：严格筛选投放模式＝闭环千川；份额＝本代理千川 ÷ 客户跨代理千川总耗；流失＝7月有、10月在该代理无消耗。<b>T-1 客户榜</b>：客户级闭环千川消耗及环比。生成时间 ${DATA.dataDate}。
    </div>
   </div>
  </div>`;
  drawChart(a);
  initFeedback(a);
  if(DATA.usageCfg&&DATA.usageCfg.token){loadUsage();}
  else{xcBeacon({event:'访问',agent:a.name});}
  if(DATA.feedbackCfg&&DATA.feedbackCfg.token){loadFbAdmin();}
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

/* ====================================================================== */
/* ---------- 代理商每日跟踪反馈（云端保存，渠道经理总览可见） ---------- */
/* ====================================================================== */
const FB_BIG_TYPES=['','品牌大场','达人专场','店播冲榜','新品首发','平台节点大促'];
const FB_TR_TYPES=['','新开户转入','竞对转入','内部代理转入','转往竞对','客户暂停/流失','内部代理转出'];
const fbStore={};   // key -> state（本次会话内）
const fbMeta={};    // key -> {reporter,status,updatedAt,loaded}
let fbCur=null, fbTimer=null, fbSaving=false, fbPending=false, fbNoNet=new URLSearchParams(location.search).get('nobeacon')==='1';

function fbDefaultState(a){
  const cands=((a.t1&&a.t1.newCandidates)||[]).slice(0,15);
  return {
    reporter:'',
    newRows:cands.map(c=>({name:c.name,yest:c.costWan,plan:c.costWan,date:'',cat:'',owner:'',checked:true,manual:false})),
    trRows:[],
    bigRows:(a.t1&&a.t1.spend||[]).slice(0,10).map(c=>({
      name:c.name,yest:c.cost,has:'无',date:'',type:'',gmv:'',qc:'',prep:'',support:'',risk:''}))
  };
}
function fbNum(v){const n=parseFloat(v);return isFinite(n)?n:0;}
function fbSummary(st){
  let nc=0,nw=0;
  st.newRows.forEach(r=>{if(r.checked){nc++;nw+=fbNum(r.plan);}});
  let inW=0,outW=0;
  st.trRows.forEach(r=>{if(r.dir==='in')inW+=fbNum(r.wan);else outW+=fbNum(r.wan);});
  let bc=0,bw=0;
  st.bigRows.forEach(r=>{if(r.has==='有'){bc++;bw+=fbNum(r.qc);}});
  return {newCount:nc,newWan:+nw.toFixed(2),trInWan:+inW.toFixed(2),trOutWan:+outW.toFixed(2),
    trNet:+(inW-outW).toFixed(2),bigCount:bc,bigWan:+bw.toFixed(2),allWan:+(nw+inW-outW).toFixed(2)};
}
function feedbackBlock(a){
  const total=(a.t1&&a.t1.newCandidates||[]).length;
  return `
  <div class="sec fb span-12" id="fbSec">
    <div class="sec-t"><span class="bar"></span>✍️ 每日跟踪反馈（请代理侧填写）
      <span class="hint">填写后云端自动保存草稿，点「提交反馈」渠道经理即可见</span></div>
    <div class="fb-ctrl">
      <div class="fld"><label>填报日期</label><input type="date" id="fbDate" value="${DATA.dataDate}"></div>
      <div class="fld"><label>填报人（对接人姓名）</label><input type="text" id="fbReporter" placeholder="如：张三" style="min-width:160px"></div>
      <div class="fld"><label>数据日期（看板）</label><input type="text" value="${DATA.dataDate}" disabled style="background:#f8fafc"></div>
      <div class="fb-status" id="fbStatus"></div>
    </div>

    <div class="fb-sub">
      <div class="fb-sub-h">① 最新一天新开客户与预计消耗
        <span class="fhint">系统已预识别「昨日有耗、前日无耗」客户（共 ${total} 户，下表展示消耗 Top15），请勾选确认为新开并补全预计消耗；老客复投请取消勾选</span></div>
      <div class="fb-sub-b"><div class="fb-scroll"><table>
        <thead><tr>
          <th style="width:40px">新开<br>确认</th><th>客户名称</th><th style="width:90px">昨日耗(万)</th>
          <th style="width:104px">预计日耗(万)</th><th style="width:130px">预计起量日期</th>
          <th style="width:110px">行业/品类</th><th style="width:88px">跟进人</th><th style="width:34px"></th>
        </tr></thead><tbody id="fbNewBody"></tbody>
      </table></div>
      <button class="fb-add" id="fbAddNew">＋ 添加新开客户（系统未识别到的）</button>
      <div class="fb-chips">
        <span class="fb-chip">确认新开 <b id="fbNewCount">0</b> 户</span>
        <span class="fb-chip pos">预计日耗合计 <b id="fbNewWan">0</b> 万/天</span>
      </div></div>
    </div>

    <div class="fb-sub">
      <div class="fb-sub-h">② 最新一天转入 / 转出客户
        <span class="fhint">转入填消耗增量，转出填消耗损失；右侧为近30天转户台账（只读参考）</span></div>
      <div class="fb-sub-b"><div class="fb-twocol">
        <div class="fb-scroll"><table>
          <thead><tr>
            <th style="width:84px">方向</th><th>客户名称</th><th style="width:116px">类型</th>
            <th style="width:110px">增量/损失(万)</th><th style="width:120px">来源/去向</th><th>备注</th><th style="width:34px"></th>
          </tr></thead><tbody id="fbTrBody"></tbody>
        </table>
        <button class="fb-add" id="fbAddTr">＋ 添加转户客户</button>
        <div class="fb-chips">
          <span class="fb-chip pos">转入 <b id="fbTrIn">0</b> 万/天</span>
          <span class="fb-chip neg">转出 <b id="fbTrOut">0</b> 万/天</span>
          <span class="fb-chip">净影响 <b id="fbTrNet">0</b> 万/天</span>
        </div></div>
        <div class="fb-ref" id="fbTrRef"></div>
      </div></div>
    </div>

    <div class="fb-sub">
      <div class="fb-sub-h">③ 未来 7 天 Top10 客户大场安排
        <span class="fhint">名单按昨日千川消耗 Top10 预填；无大场也请选「无」，方便渠道侧盘点大促节奏</span></div>
      <div class="fb-sub-b"><div class="fb-scroll"><table>
        <thead><tr>
          <th>客户（昨日耗）</th><th style="width:78px">有大场?</th><th style="width:128px">大场日期</th>
          <th style="width:104px">类型</th><th style="width:88px">预计GMV(万)</th><th style="width:96px">预计千川(万)</th>
          <th style="width:140px">素材/直播准备</th><th style="width:126px">需要渠道支持</th><th style="width:104px">风险提示</th>
        </tr></thead><tbody id="fbBigBody"></tbody>
      </table></div>
      <div class="fb-chips">
        <span class="fb-chip">有大场 <b id="fbBigCount">0</b> 场</span>
        <span class="fb-chip pos">预计千川消耗合计 <b id="fbBigWan">0</b> 万</span>
        <span class="fb-chip" style="margin-left:auto">明日预计新增弹药 <b id="fbAll">0</b> 万/天</span>
      </div></div>
    </div>

    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="fb-submit" id="fbSubmit">✅ 提交反馈</button>
      <button class="fb-ghost" id="fbExport">导出填报 CSV</button>
      <span style="font-size:11.5px;color:var(--sub-2)">系统每 3 秒自动保存草稿；提交后渠道经理可在总览看到填报状态。明细仅该代理商与渠道经理可见。</span>
    </div>
  </div>`;
}

function fbInit(a){
  fbCur=a;
  const date=$('#fbDate').value||DATA.dataDate;
  $('#fbDate').value=date;
  const keyOf=()=>a.name+'|'+$('#fbDate').value;   // 始终按当前填报日期取暂存区，避免切换日期后写错 key
  $('#fbReporter').oninput=e=>{fbStore[keyOf()].reporter=e.target.value;fbScheduleSave();};
  $('#fbDate').onchange=()=>fbLoadFor(a,$('#fbDate').value);
  $('#fbAddNew').onclick=()=>{fbStore[keyOf()].newRows.push({name:'',yest:'',plan:0,date:'',cat:'',owner:'',checked:true,manual:true});fbRenderNew();fbScheduleSave();};
  $('#fbAddTr').onclick=()=>{fbStore[keyOf()].trRows.push({dir:'in',name:'',type:FB_TR_TYPES[1],wan:0,src:'',note:''});fbRenderTr();fbScheduleSave();};
  $('#fbSubmit').onclick=()=>fbSave(keyOf(),'已提交',true);
  $('#fbExport').onclick=()=>fbExportCsv(a,$('#fbDate').value);
  fbLoadFor(a,date);
}
function fbLsKey(key){return 'xc-fb-v1|'+key;}
function fbPersistLocal(key){
  try{
    const st=fbStore[key];
    localStorage.setItem(fbLsKey(key),JSON.stringify({reporter:st.reporter,state:st,_t:Date.now()}));
  }catch(e){}
}
function fbReadLocal(key){
  try{
    const raw=localStorage.getItem(fbLsKey(key));
    if(!raw)return null;
    const o=JSON.parse(raw);
    if(o&&o.state)return o;
  }catch(e){}
  return null;
}
async function fbLoadFor(a,date){
  const key=a.name+'|'+date;
  fbCur=a;
  if(!fbStore[key]){
    fbStore[key]=fbDefaultState(a);
    fbMeta[key]={reporter:'',status:'',updatedAt:0,loaded:false};
    // 本机草稿兜底：云端没回来前先用本地内容，防止刷新/提交失败丢内容
    const loc=fbReadLocal(key);
    if(loc){
      if(loc.reporter)fbStore[key].reporter=loc.reporter;
      ['newRows','trRows','bigRows'].forEach(k=>{if(Array.isArray(loc.state[k]))fbStore[key][k]=loc.state[k];});
      fbMeta[key].reporter=loc.reporter||'';
    }
  }
  const st=fbStore[key], meta=fbMeta[key];
  $('#fbDate').value=date;
  $('#fbReporter').value=st.reporter||meta.reporter||'';
  fbRenderAll();
  fbSetStatus(meta.loaded?(meta.status==='已提交'?'已提交 ✓ '+fbTime(meta.updatedAt):(meta.updatedAt?'云端草稿 '+fbTime(meta.updatedAt):'未填写')):'正在载入云端草稿…','');
  if(!meta.loaded && !fbNoNet){
    const cfg=DATA.feedbackCfg||{};
    if(cfg.url){
      let d=null,lastErr='';
      for(let attempt=0;attempt<3&&!d;attempt++){
        try{
          const r=await fetch(cfg.url+'?key='+encodeURIComponent(xcKey())+'&date='+date);
          d=await r.json();
        }catch(e){lastErr=e.message;await new Promise(res=>setTimeout(res,800*(attempt+1)));}
      }
      try{
        if(!d){meta.loaded=true;fbSetStatus('云端草稿载入失败，可离线填写后刷新重试','err');return;}
        if(d&&d.ok&&d.state){
          const cloud=d.state;
          ['newRows','trRows','bigRows'].forEach(k=>{if(Array.isArray(cloud[k]))st[k]=cloud[k];});
          st.reporter=d.reporter||st.reporter||'';
          meta.reporter=st.reporter;meta.status=d.status;meta.updatedAt=d.updatedAt;
          fbPersistLocal(key);   // 云端为准，回写本机备份
        }
        meta.loaded=true;
        if(fbCur===a && $('#fbDate').value===date){
          $('#fbReporter').value=st.reporter||'';
          fbRenderAll();
          fbSetStatus(d&&d.state?(d.status==='已提交'?'已提交 ✓ '+fbTime(d.updatedAt):'云端草稿 '+fbTime(d.updatedAt)):'今日尚无填报，开始填写后自动保存','');
        }
      }catch(e){meta.loaded=true;fbSetStatus('云端草稿载入失败：'+e.message,'err');}
    }else{meta.loaded=true;}
  }
}
function fbTime(ms){return ms?new Date(ms).toLocaleString('zh-CN',{hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'';}
function fbSetStatus(t,cls){const el=$('#fbStatus');if(!el)return;el.textContent=t;el.className='fb-status '+(cls||'');}

function fbBindRow(tr,arr,rerender,hasKey){
  tr.querySelectorAll('[data-k]').forEach(el=>{
    el.addEventListener('input',()=>{
      const i=+tr.dataset.i,k=el.dataset.k;
      if(el.type==='checkbox')arr[i][k]=el.checked;
      else if(el.type==='number')arr[i][k]=el.value===''?'':+el.value;
      else arr[i][k]=el.value;
      if(hasKey&&k==='has'){fbRenderBig();}else{fbRecalc();}
      fbScheduleSave();
    });
  });
  const del=tr.querySelector('[data-del]');
  if(del)del.onclick=()=>{arr.splice(+tr.dataset.i,1);rerender();fbScheduleSave();};
}
function fbEsc(s){return esc(s==null?'':s).replace(/"/g,'&quot;');}
function fbRenderNew(){
  const st=fbStore[fbCur.name+'|'+$('#fbDate').value], tb=$('#fbNewBody');
  tb.innerHTML='';
  st.newRows.forEach((r,i)=>{
    const tr=document.createElement('tr');tr.dataset.i=i;
    tr.innerHTML=`
      <td style="text-align:center"><input type="checkbox" data-k="checked" ${r.checked?'checked':''}></td>
      <td class="cname"><input value="${fbEsc(r.name)}" data-k="name" placeholder="客户全称">
        ${r.manual?'':'<small>系统预识别 · 老客复投请取消勾选</small>'}</td>
      <td>${r.yest!==''&&r.yest!=null?f1(r.yest):'-'}</td>
      <td class="num"><input type="number" step="0.1" min="0" value="${r.plan}" data-k="plan"></td>
      <td><input type="date" value="${r.date||''}" data-k="date"></td>
      <td><input value="${fbEsc(r.cat)}" data-k="cat" placeholder="如：美妆/食品"></td>
      <td><input value="${fbEsc(r.owner)}" data-k="owner"></td>
      <td><button class="del" data-del>✕</button></td>`;
    fbBindRow(tr,st.newRows,fbRenderNew,false);tb.appendChild(tr);
  });
  fbRecalc();
}
function fbRenderTr(){
  const st=fbStore[fbCur.name+'|'+$('#fbDate').value], tb=$('#fbTrBody');
  tb.innerHTML='';
  st.trRows.forEach((r,i)=>{
    const color=r.dir==='in'?'var(--green)':'var(--red)';
    const tr=document.createElement('tr');tr.dataset.i=i;
    tr.innerHTML=`
      <td><select data-k="dir">
        <option value="in" ${r.dir==='in'?'selected':''}>转入</option>
        <option value="out" ${r.dir==='out'?'selected':''}>转出</option></select></td>
      <td><input value="${fbEsc(r.name)}" data-k="name" placeholder="客户全称"></td>
      <td><select data-k="type">${FB_TR_TYPES.map(t=>`<option ${r.type===t?'selected':''}>${t}</option>`).join('')}</select></td>
      <td class="num"><input type="number" step="0.1" min="0" value="${r.wan}" data-k="wan" style="color:${color}"></td>
      <td><input value="${fbEsc(r.src)}" data-k="src" placeholder="来源/去向代理商"></td>
      <td><input value="${fbEsc(r.note)}" data-k="note" placeholder="原因/挽回动作"></td>
      <td><button class="del" data-del>✕</button></td>`;
    fbBindRow(tr,st.trRows,fbRenderTr,false);tb.appendChild(tr);
  });
  fbRenderTrRef();fbRecalc();
}
function fbRenderTrRef(){
  const el=$('#fbTrRef');if(!el)return;
  const t=fbCur.transfer,m30=t&&t['近30天'];
  if(!m30){el.innerHTML='<h4>近30天转户台账（只读）</h4><div style="color:var(--sub-2)">暂无数据</div>';return;}
  const top=(t.topLost30d||[]).slice(0,5)
    .map(x=>`<li>${esc(x.cust)}｜${f1(x.costWan)} 万｜${x.adv} 个广告主</li>`).join('')||'<li>-</li>';
  el.innerHTML=`<h4>近30天转户台账（只读）</h4>
    <div class="rr"><span style="color:var(--green)">外部转入</span><b>${m30.inExt.adv} 户 / ${f1(m30.inExt.costWan)} 万</b></div>
    <div class="rr"><span style="color:var(--red)">外部转出</span><b>${m30.outExt.adv} 户 / ${f1(m30.outExt.costWan)} 万</b></div>
    <div class="rr"><span>外部净增</span><b style="color:${m30.netExtAdv>=0?'var(--green)':'var(--red)'}">${m30.netExtAdv>=0?'+':''}${m30.netExtAdv}</b></div>
    <div style="margin-top:6px"><b>转出 Top</b><ul>${top}</ul></div>`;
}
function fbRenderBig(){
  const st=fbStore[fbCur.name+'|'+$('#fbDate').value], tb=$('#fbBigBody');
  tb.innerHTML='';
  const base=$('#fbDate').value, maxd=new Date(+new Date(base)+7*864e5).toISOString().slice(0,10);
  st.bigRows.forEach((r,i)=>{
    const dim=r.has==='有'?'':'disabled style="background:#f9fafb;color:#9ca3af"';
    const tr=document.createElement('tr');tr.dataset.i=i;
    tr.innerHTML=`
      <td class="cname">${esc(r.name)}<small>昨日耗 ${f1(r.yest)} 万</small></td>
      <td><select data-k="has">
        <option ${r.has==='有'?'selected':''}>有</option>
        <option ${r.has==='筹备中'?'selected':''}>筹备中</option>
        <option ${r.has==='无'?'selected':''}>无</option></select></td>
      <td><input type="date" value="${r.date||''}" data-k="date" min="${base}" max="${maxd}" ${dim}></td>
      <td><select data-k="type" ${dim}>${FB_BIG_TYPES.map(t=>`<option ${r.type===t?'selected':''}>${t}</option>`).join('')}</select></td>
      <td class="num"><input type="number" step="1" min="0" value="${r.gmv}" data-k="gmv" ${dim}></td>
      <td class="num"><input type="number" step="0.1" min="0" value="${r.qc}" data-k="qc" ${dim}></td>
      <td><input value="${fbEsc(r.prep)}" data-k="prep" placeholder="素材条数/直播时长" ${dim}></td>
      <td><input value="${fbEsc(r.support)}" data-k="support" placeholder="政策/资源/审核" ${dim}></td>
      <td><input value="${fbEsc(r.risk)}" data-k="risk" placeholder="如库存/ROI" ${dim}></td>`;
    fbBindRow(tr,st.bigRows,fbRenderBig,true);tb.appendChild(tr);
  });
  fbRecalc();
}
function fbRenderAll(){fbRenderNew();fbRenderTr();fbRenderBig();fbRecalc();}
function fbRecalc(){
  const st=fbStore[fbCur.name+'|'+$('#fbDate').value];if(!st)return;
  const s=fbSummary(st);
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  set('#fbNewCount',s.newCount);set('#fbNewWan',f1(s.newWan));
  set('#fbTrIn',f1(s.trInWan));set('#fbTrOut',f1(s.trOutWan));
  const net=$('#fbTrNet');if(net){net.textContent=(s.trNet>=0?'+':'')+f1(s.trNet);net.style.color=s.trNet>=0?'var(--green)':'var(--red)';}
  set('#fbBigCount',s.bigCount);set('#fbBigWan',f1(s.bigWan));
  set('#fbAll',(s.allWan>=0?'+':'')+f1(s.allWan));
  return s;
}
function fbScheduleSave(){clearTimeout(fbTimer);const key=fbCur.name+'|'+$('#fbDate').value;fbPersistLocal(key);fbTimer=setTimeout(()=>{fbSave(key,'草稿',false);},3000);}
async function fbPostOnce(cfg,key,date,st,status){
  const r=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({key:xcKey(),agent:fbCur.name,date,reporter:st.reporter||'',status,
      summary:fbSummary(st),state:st})});
  let d=null;
  try{d=await r.json();}catch(e){d=null;}
  if(d&&d.ok)return d;
  const msg=(d&&d.error)||('HTTP '+r.status);
  const retryable=!d||/reached_max_replica_limit|timeout|5\d\d|429|Failed to fetch|NetworkError/i.test(String(msg))||r.status>=500;
  const err=new Error(msg);err.retryable=retryable;throw err;
}
async function fbSave(key,status,explicit){
  if(fbNoNet){fbPersistLocal(key);fbSetStatus('离线模式：内容已保存在本机，联网后请点「提交反馈」','');return;}
  const cfg=DATA.feedbackCfg;if(!cfg||!cfg.url){fbPersistLocal(key);return;}
  if(fbSaving){fbPending=true;return;}
  const st=fbStore[key];if(!st)return;
  if(explicit&&!String(st.reporter||'').trim()){alert('提交前请填写「填报人」姓名');$('#fbReporter').focus();return;}
  const date=key.split('|')[1];
  fbPersistLocal(key);   // 先落本机，任何网络失败都不丢内容
  fbSaving=true;
  let d=null,lastErr='';
  for(let attempt=1;attempt<=3&&!d;attempt++){
    fbSetStatus(explicit?`正在提交…（第${attempt}次）`:`正在自动保存草稿…（第${attempt}次）`,'busy');
    try{d=await fbPostOnce(cfg,key,date,st,status);}
    catch(e){
      lastErr=e.message;
      if(attempt<3&&e.retryable){await new Promise(res=>setTimeout(res,1200*attempt));continue;}
      break;
    }
  }
  if(d){
    fbMeta[key]={reporter:st.reporter,status,updatedAt:d.savedAt||Date.now(),loaded:true};
    fbPersistLocal(key);
    fbSetStatus(status==='已提交'?'✅ 已提交，渠道经理可见 '+fbTime(d.savedAt):'☁️ 草稿已自动保存 '+fbTime(d.savedAt),'ok');
    if(status==='已提交'){xcBeacon({event:'提交反馈',agent:fbCur.name});if(DATA.feedbackCfg.token)loadFbAdmin();}
  }else{
    fbSetStatus((explicit?'提交失败':'自动保存失败')+'：'+lastErr+'。内容已保存在本机，请稍后再点「提交反馈」','err');
  }
  fbSaving=false;
  if(fbPending){fbPending=false;fbSave(key,'草稿',false);}
}
function fbExportCsv(a,date){
  const st=fbStore[a.name+'|'+date];
  const L=[];
  L.push(['代理商',a.name,'填报日期',date,'填报人',st.reporter||'']);L.push([]);
  L.push(['① 最新一天新开客户与预计消耗']);
  L.push(['新开确认','客户名称','昨日消耗(万)','预计日耗(万)','预计起量日期','行业/品类','跟进人']);
  st.newRows.forEach(r=>L.push([r.checked?'是':'否',r.name,r.yest,r.plan,r.date,r.cat,r.owner]));
  L.push([]);L.push(['② 最新一天转入/转出客户']);
  L.push(['方向','客户名称','类型','日耗增量/损失(万)','来源/去向','备注']);
  st.trRows.forEach(r=>L.push([r.dir==='in'?'转入':'转出',r.name,r.type,r.wan,r.src,r.note]));
  L.push([]);L.push(['③ 未来7天 Top10 客户大场安排']);
  L.push(['客户','昨日耗(万)','有大场','大场日期','类型','预计GMV(万)','预计千川消耗(万)','素材/直播准备','需要渠道支持','风险提示']);
  st.bigRows.forEach(r=>L.push([r.name,r.yest,r.has,r.date,r.type,r.gmv,r.qc,r.prep,r.support,r.risk]));
  const s=fbSummary(st);
  L.push([]);L.push(['汇总','确认新开(户)',s.newCount,'新开预计日耗(万/天)',s.newWan,'转户净影响(万/天)',s.trNet,'大场数',s.bigCount,'大场预计消耗(万)',s.bigWan]);
  downloadCSV(`${a.short}_每日反馈_${date}.csv`,L[0],L.slice(1));
}
function initFeedback(a){if(DATA.feedbackCfg&&DATA.feedbackCfg.url&&$('#fbSec'))fbInit(a);}

/* ---------- 总览：代理商每日反馈填报跟踪（仅管理员） ---------- */
let fbAdminRows=null;
function fbAdminBlock(){
  return `
  <div class="card usage-card" id="fbAdminCard" style="grid-column:1/-1;margin-top:4px">
    <div class="wt" style="display:flex;align-items:center">
      <h3 style="margin:0">✍️ 代理商每日反馈填报跟踪</h3>
      <span style="margin-left:10px;font-size:11px;color:#94a3b8">各代理填报状态实时汇总 · 仅管理员可见</span>
      <button class="xbtn dark" style="margin-left:auto" onclick="loadFbAdmin()">刷新</button>
    </div>
    <div id="fbAdminPanel" style="margin-top:10px;font-size:12px;color:#64748b">正在加载填报数据…</div>
  </div>`;
}
async function loadFbAdmin(){
  const box=$('#fbAdminPanel');if(!box)return;
  const cfg=DATA.feedbackCfg;
  let d=null;
  for(let attempt=0;attempt<3&&!d;attempt++){
    try{
      const r=await fetch(cfg.url+'?mode=admin',{headers:{'x-admin-token':cfg.token}});
      d=await r.json();
    }catch(e){await new Promise(res=>setTimeout(res,800*(attempt+1)));}
  }
  try{
    if(!d){box.innerHTML='填报数据加载失败，请点「刷新」重试';return;}
    if(!d||!d.ok){box.innerHTML='填报数据加载失败：'+esc(d&&d.error||'未知错误');return;}
    fbAdminRows=d.rows||[];
    const dates=[...new Set(fbAdminRows.map(x=>x.date))].sort().reverse();
    const sel=`<select id="fbAdmDate" style="border:1px solid #d1d5db;border-radius:6px;padding:3px 8px;font-size:12px">
      ${dates.map(dt=>`<option ${dt===DATA.dataDate?'selected':''}>${dt}</option>`).join('')}</select>`;
    const render=(date)=>{
      date=date||DATA.dataDate;
      const byAgent={};
      fbAdminRows.filter(x=>x.date===date).forEach(x=>{if(!byAgent[x.agent]||x.updatedAt>byAgent[x.agent].updatedAt)byAgent[x.agent]=x;});
      const trs=DATA.agents.map(a=>{
        const x=byAgent[a.name];
        const st=x?`<b style="color:${x.status==='已提交'?'#059669':'#d97706'}">${x.status}</b>`:'<span style="color:#cbd5e1">未填报</span>';
        const cell=v=>x?f1(v):'-';
        return `<tr style="border-top:1px solid #eef1f6">
          <td style="padding:7px 8px;font-weight:700">${esc(a.short)}</td>
          <td>${st}</td>
          <td>${x?esc(x.reporter||'-'):'-'}</td>
          <td>${x?x.newCount:'-'}</td>
          <td class="pos">${x&&x.newWan?f1(x.newWan):'-'}</td>
          <td style="color:${x&&x.trNet<0?'#dc2626':'#059669'}">${x?(x.trNet>=0?'+':'')+f1(x.trNet):'-'}</td>
          <td>${x?x.bigCount:'-'}</td>
          <td>${x?f1(x.bigWan):'-'}</td>
          <td style="color:#64748b">${x?fbTime(x.updatedAt):'-'}</td>
        </tr>`;
      }).join('');
      const submitted=Object.values(byAgent).filter(x=>x.status==='已提交').length;
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        填报日期 ${sel} ｜ <b>${submitted}/${DATA.agents.length}</b> 家已提交
        <button class="xbtn dark" id="fbAdmDl" style="margin-left:auto">导出当日汇总 CSV</button></div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="color:#64748b;text-align:left">
            <th style="padding:6px 8px">代理商</th><th>状态</th><th>填报人</th>
            <th>新开(户)</th><th>新开预计日耗(万)</th><th>转户净影响(万)</th>
            <th>大场(场)</th><th>大场预计消耗(万)</th><th>更新时间</th>
          </tr></thead><tbody>${trs}</tbody></table>`;
    };
    if(!fbAdminRows.length){box.innerHTML='暂无填报记录。';return;}
    box.innerHTML=render();
    $('#fbAdmDate').onchange=e=>{box.innerHTML=render(e.target.value);bindDl();};
    bindDl();
    function bindDl(){
      const b=$('#fbAdmDl');if(!b)return;
      b.onclick=()=>{
        const date=$('#fbAdmDate').value;
        const rows=fbAdminRows.filter(x=>x.date===date);
        downloadCSV(`代理每日反馈汇总_${date}.csv`,
          ['代理商','状态','填报人','新开客户数','新开预计日耗(万)','转入合计(万)','转出合计(万)','转户净影响(万)','大场数','大场预计消耗(万)','明日新增弹药(万)','更新时间'],
          rows.map(x=>[x.agent,x.status,x.reporter,x.newCount,x.newWan,x.trInWan,x.trOutWan,x.trNet,x.bigCount,x.bigWan,x.allWan,fbTime(x.updatedAt)]));
      };
    }
  }catch(e){box.innerHTML='填报数据加载失败：'+esc(e.message);}
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
        label:{formatter:'参考期 7.14-7.20  '+ref,color:'#d97706',position:'insideEndTop'}}]}
    }]
  });
}

fetch('data.json').then(r=>r.json()).then(d=>{DATA=d;render();});
window.addEventListener('hashchange',()=>{cur=curFromHash();if(DATA)render();});
window.addEventListener('resize',()=>{if(chart)chart.resize();});
