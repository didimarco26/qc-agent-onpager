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
      <div class="t1-col spend"><div class="ch">🏆 消耗 Top 10</div>${t1List(t&&t.spend,'spend')}</div>
      <div class="t1-col gain"><div class="ch">🔥 增量 Top 10</div>${t1List(t&&t.gain,'gain')}</div>
      <div class="t1-col loss"><div class="ch">❄️ 掉量 Top 10</div>${t1List(t&&t.loss,'gain')}</div>
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
    <div class="sec-t"><span class="bar" style="background:#d97706"></span>转户情况（千川）<span class="hint">近30天 09.09–10.08</span></div>
    <div class="tf-grid">
      <div class="tf-mini" style="border:1px solid #f0d6a8;background:#fffdf7"><div class="l">外部转出</div><div class="v" style="color:#b45309">${m30.outExt.adv}</div></div>
      <div class="tf-mini" style="border:1px solid #bbf0d2;background:#f7fffb"><div class="l">外部转入</div><div class="v" style="color:#059669">${m30.inExt.adv}</div></div>
      <div class="tf-mini" style="border-style:solid;background:#fff"><div class="l">外部净增</div><div class="v" style="color:${netColor}">${net>0?'+':''}${net}</div></div>
      <div class="tf-mini" style="border-style:solid;background:#fff"><div class="l">转出累计消耗</div><div class="v">${f1(m30.outExt.costWan)}<small> 万</small></div></div>
    </div>
    <div class="tf-sub">
      <b>YTD 外部</b>：转出 ${ytd.outExt.adv} ｜ 转入 ${ytd.inExt.adv} ｜ 净 <b style="color:${ytdColor}">${ytd.netExtAdv>0?'+':''}${ytd.netExtAdv}</b><br/>
      <b>近30天内部（8家之间）</b>：转出 ${m30.outInt.adv} ｜ 转入 ${m30.inInt.adv}
    </div>
    ${lost?`<table class="minitable"><thead><tr><th>近30天外部转出 Top</th><th class="r">广告主</th><th class="r">消耗(万)</th></tr></thead><tbody>${lost}</tbody></table>`:''}
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
        <div class="wt">① 7月有、10月后不在的客户</div>
        <div class="ws">7月窗口 07.01–07.31；10月在该代理无闭环千川消耗（已剔除8家内部流转）</div>
        <div class="wl-big">
          <div><div class="l">外部流失客户</div><div class="v">${w.lostExtCount}<small> 个</small></div></div>
          <div><div class="l">可增长日耗</div><div class="v">${f1(w.lostExtDayWan)}<small> 万</small></div></div>
        </div>
        <table class="minitable"><thead><tr><th>Top 客户(按7月闭环千川日耗)</th><th class="r">日耗(万)</th></tr></thead><tbody>${lost}</tbody></table>
        ${moreLost>0?`<div class="ws" style="margin-top:8px">其余 ${moreLost} 个客户未列示</div>`:''}
      </div>
      <div class="wl-card">
        <div class="wt">② 最新 Top10 客户份额</div>
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

    <div class="foot">
      <b>数据来源</b>：渠道业绩看板（${DATA.dataDate} 快照）、D11跟踪表、《陈日晖代理Q4品星目标》、转户看板（report 15668836）、钱包份额数据集（dataset 4898252，闭环千川口径）。<br/>
      <b>口径</b>：金额单位万元；参考期日耗与双十一目标取自 D11 跟踪表，膨胀率 = 最近一天 ÷ 参考期日耗 − 1。<b>转户</b>按（广告主+转出+转入+成功时间+类型）去重，外部＝与8家之外。<br/>
      <b>钱包份额</b>：严格筛选投放模式＝闭环千川；份额＝本代理千川 ÷ 客户跨代理千川总耗；流失＝7月有、10月在该代理无消耗。<b>T-1 客户榜</b>：客户级闭环千川消耗及环比。生成时间 2026-10-09。
    </div>
   </div>
  </div>`;
  drawChart(a);
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
