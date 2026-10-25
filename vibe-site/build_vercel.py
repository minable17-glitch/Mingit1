import json, pathlib, re, runpy, shutil, zipfile
here = pathlib.Path(__file__).parent
ns = runpy.run_path(str(here/'build2.py'))   # builds site.html too (artifact version); reuse pages
pages = ns['pages']

def embed(title, url, height=760): return {"t":"embed","title":title,"url":url,"height":height}
by = {p['id']:p for p in pages}
def swap(pid, title, url, height=760):
    b = by[pid]['blocks']
    # remove the "OPEN" note and the link-only block that pointed to this url
    b[:] = [x for x in b if not (x.get('t')=='p' and x.get('text','').startswith('원본 페이지에서는')) and not (x.get('t')=='links' and any(i['url']==url for i in x['items']))]
    b.append(embed(title, url, height))
swap('terms','코딩 용어 카드','https://coding-term-cards.minable17.chatgpt.site/',800)
swap('run','달리기 수업 웹앱','https://running-journal-wine.vercel.app/',820)
swap('ex-game','게임형 과제 웹앱','https://script.google.com/macros/s/AKfycbydwS2Y_sXrTbaVie_0W0L4wm0MUqhRJu70mlmQgj7IqW60GLZTiBC1gY2VDJUvr7D-1g/exec',700)
swap('ex-apply','연수신청 웹앱','https://script.google.com/macros/s/AKfycbzRlgGkFfQGskNQsHOc7pdtO-RolUt14G74M9GkuRC--VVAZtNwBdM6KdiHoe8BK4eI/exec',760)

tpl = (here/'template.html').read_text(encoding='utf8')
# 1) embed block
tpl = tpl.replace("    case 'html': return labView(b);",
"""    case 'embed': {
      var eu=safeUrl(b.url); if(!eu) return el('p',null,'(잘못된 주소)');
      return el('div',{class:'embedbox'},
        el('div',{class:'hd'},el('b',null,b.title||'웹앱'),el('a',{class:'btn small',href:eu,target:'_blank',rel:'noopener noreferrer'},'새 창에서 열기 ↗')),
        el('iframe',{class:'embed-frame',src:eu,title:b.title||'웹앱',loading:'lazy',allow:'fullscreen',style:'height:'+(b.height||760)+'px'}));
    }
    case 'html': return labView(b);""",1)
tpl = tpl.replace(".links{display:flex;",
".embedbox{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface)}\n.embedbox .hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;background:var(--soft)}\n.embed-frame{display:block;width:100%;border:0;background:#fff}\n.links{display:flex;",1)
# 2) allow alert/confirm in experience boxes
tpl = tpl.replace("sandbox:'allow-scripts'","sandbox:'allow-scripts allow-modals allow-popups'",1)
# 3) tag the editor 'embed' type so the editor does not choke
blob = json.dumps({"v":1,"pages":pages},ensure_ascii=False).replace("<","\\u003c")
assert "__DATA__" in tpl
body = tpl.replace("__DATA__",blob)
doc = ('<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
       '<style>html{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n'
       '</head>\n<body>\n' + body + '\n</body>\n</html>\n')
out = here/'vercel-site'
if out.exists(): shutil.rmtree(out)
(out/'public').mkdir(parents=True)
(out/'public'/'index.html').write_text(doc,encoding='utf8')
(out/'vercel.json').write_text(json.dumps({"cleanUrls":True,"headers":[{"source":"/(.*)","headers":[{"key":"X-Content-Type-Options","value":"nosniff"}]}]},indent=2),encoding='utf8')
(out/'README.md').write_text("""# 바이브 코딩 연수(체육) 사이트

정적 사이트 한 장(`public/index.html`)입니다. 빌드 과정이 없어요.

## 배포 (Vercel)
1. 이 폴더를 GitHub 저장소로 올리거나, 터미널에서 이 폴더로 이동해 `npx vercel` 실행
2. Framework Preset: **Other**, Output Directory: **public**
3. 배포 후 나오는 `*.vercel.app` 주소를 공유

## 수정하기
- 모든 페이지 내용은 `public/index.html` 안의 `<script type="application/json" id="site-data">` 블록에 들어 있어요.
- 페이지 추가·수정은 Claude Code에게 "○○ 페이지 추가해 줘"라고 요청하세요.
""",encoding='utf8')
print('ok', len(doc.encode()))
