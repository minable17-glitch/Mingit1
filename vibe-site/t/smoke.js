const {JSDOM}=require('jsdom');const fs=require('fs');
const html='<!doctype html><html><head><meta charset=utf8></head><body>'+fs.readFileSync('../site.html','utf8')+'</body></html>';
let published=null;
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/#cases',beforeParse(w){
  w.claude={use:async n=>n==='user'?{canEdit:()=>true,isOwner:()=>true}:{publish:async d=>{published=d;}}};
  w.scrollTo=()=>{};
}});
const w=dom.window;
setTimeout(()=>{
  const d=w.document;
  console.log('title h1:',d.querySelector('.banner h1').textContent);
  console.log('nav items:',d.querySelectorAll('.nav a').length);
  console.log('edit btn:',!!d.querySelector('.top-edit'));
  d.querySelector('.top-edit').click();
  console.log('editbar visible:',!d.querySelector('.editbar').hidden);
  // add a page
  d.getElementById('np-title').value='새 실습';
  [...d.querySelectorAll('.addpage button')][0].click();
  console.log('after add h1:',d.querySelector('.banner h1').textContent,'hash',w.location.hash);
  [...d.querySelectorAll('.editbar button')].pop().click();
  setTimeout(()=>{
    console.log('published?',!!published, published&&published.length);
    const m=published.match(/<script type="application\/json" id="site-data">([\s\S]*?)<\/script>/);
    const j=JSON.parse(m[1]);console.log('pages in doc:',j.pages.length, j.pages.some(p=>p.title==='새 실습'));
    console.log('starts ok:',published.startsWith('<!doctype html><html><head><meta charset=utf8>'));
    console.log('iframes',d.querySelectorAll('iframe').length);
  },50);
},100);
