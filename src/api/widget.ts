export const WIDGET_JS = `(function(){
  var s=document.currentScript;
  if(!s)return;
  var addr=s.getAttribute("data-address");
  if(!addr){e("Missing data-address");return}
  var theme=s.getAttribute("data-theme")||"light";
  var size=s.getAttribute("data-size")||"md";
  var apiUrl=s.getAttribute("data-api-url");
  if(!apiUrl){
    try{apiUrl=new URL(s.src).origin}catch(err){apiUrl=""}
  }
  if(apiUrl&&!/^https?:\\/\\//i.test(apiUrl)){apiUrl=""}
  if(!apiUrl){e("Invalid API URL");return}
  var widths={sm:200,md:280,lg:360};
  var w=widths[size]||widths.md;
  var colors={
    light:{bg:"#f8f4eb",text:"#171512",border:"#b9ac97",subtle:"#655c52",tier:{new:"#655c52",active:"#2563eb",trusted:"#16a34a"}},
    dark:{bg:"#171512",text:"#f8f4eb",border:"#6f6454",subtle:"#b9ac97",tier:{new:"#655c52",active:"#60a5fa",trusted:"#22c55e"}}
  };
  var c=colors[theme]||colors.light;
  var host=s.parentNode;
  if(!host)return;
  var root=document.createElement("div");
  root.style.display="inline-block";
  root.style.width=w+"px";
  var shadow=root.attachShadow({mode:"closed"});
  host.insertBefore(root,s);
  fetch(apiUrl+"/badge-stats/"+encodeURIComponent(addr))
    .then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
    .then(function(d){render(d)})
    .catch(function(){e("Unable to load")});
  function e(msg){
    shadow.innerHTML='<div style="padding:8px;font-family:system-ui,sans-serif;font-size:11px;color:'+c.subtle+'">'+msg+'</div>';
  }
  function render(d){
    var tc=c.tier[d.trust_tier]||c.tier.new;
    var tn=esc(d.trust_tier.charAt(0).toUpperCase()+d.trust_tier.slice(1));
    var vol=d.total_economic_volume;
    var vn=parseFloat(vol);
    var vs="0";
    if(!isNaN(vn)&&vn>0){if(vn>=1e6)vs=(vn/1e6).toFixed(1)+"M";else if(vn>=1e3)vs=(vn/1e3).toFixed(1)+"K";else vs=Math.round(vn).toString()}
    shadow.innerHTML=
      '<style>*{box-sizing:border-box;margin:0;padding:0}</style>'+
      '<div style="background:'+c.bg+';border:1px solid '+c.border+';border-radius:6px;padding:10px 12px;font-family:system-ui,sans-serif">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'+
          '<div style="width:8px;height:8px;border-radius:50%;background:'+tc+';flex-shrink:0"></div>'+
          '<span style="font-weight:600;font-size:12px;color:'+c.text+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(d.name)+'</span>'+
          '<span style="margin-left:auto;font-weight:700;font-size:12px;color:'+tc+'">'+d.score+'</span>'+
        '</div>'+
        '<div style="font-size:10px;color:'+c.subtle+';line-height:1.6">'+
          '<div>'+tn+' · '+d.verified_interactions_count+' interactions</div>'+
          '<div>'+vs+' volume</div>'+
        '</div>'+
      '</div>';
  }
  function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}
})();`
