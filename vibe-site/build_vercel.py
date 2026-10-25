import json, pathlib, runpy, sys
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
assert "__DATA__" in tpl
# Pages live in public/site-data.json (edited from the admin screen); the page itself embeds null.
body = tpl.replace("__DATA__","null")
doc = ('<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
       '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
       '<style>html{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n'
       '</head>\n<body>\n' + body + '\n</body>\n</html>\n')
out = here/'vercel-site'
(out/'public'/'images').mkdir(parents=True, exist_ok=True)
(out/'public'/'images'/'.gitkeep').touch()
(out/'public'/'index.html').write_text(doc,encoding='utf8')
# /admin opens the same page (cleanUrls serves admin.html there); the script then shows the login.
(out/'public'/'admin.html').write_text(doc,encoding='utf8')
# Site icon (dark tile + red bar, like the banner) so the Vercel project does not show another app's icon.
(out/'public'/'favicon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#121418"/>'
  '<text x="32" y="38" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="26" fill="#fff">VC</text>'
  '<rect x="14" y="46" width="36" height="6" fill="#e5393a"/></svg>\n',encoding='utf8')
data_file = out/'public'/'site-data.json'
if '--reset' in sys.argv or not data_file.exists():
    # Only on first build (or --reset): after that the admin screen owns this file.
    data_file.write_text(json.dumps({"v":1,"rev":0,"pages":pages},ensure_ascii=False,indent=1)+"\n",encoding='utf8')
# Own package.json so api/*.js stay CommonJS (the repo root package.json says "type": "module").
(out/'package.json').write_text(json.dumps({"private":True,"type":"commonjs"},indent=2)+"\n",encoding='utf8')
(out/'vercel.json').write_text(json.dumps({"framework":None,"buildCommand":"","outputDirectory":"public","cleanUrls":True,
  "headers":[{"source":"/(.*)","headers":[{"key":"X-Content-Type-Options","value":"nosniff"}]}]},indent=2),encoding='utf8')
(out/'README.md').write_text("""# 바이브 코딩 연수(체육) 사이트

- `public/index.html` : 화면 틀 (template.html에서 만들어짐)
- `public/site-data.json` : 모든 페이지 내용. **관리자 화면에서 저장하면 이 파일이 GitHub에 커밋**되고 Vercel이 다시 배포해요.
- `public/images/` : 관리자 화면에서 올린 사진
- `api/admin.js` : 관리자 로그인·저장·버전 기록·사진 올리기

## 배포 (Vercel)
Root Directory `vibe-site/vercel-site`, Framework Other. 출력 폴더는 vercel.json에 들어 있어요.

## 관리자 화면 켜기
Vercel 프로젝트 Settings → Environment Variables 에 두 개를 넣고 다시 배포:
- `ADMIN_PASSWORD` : 관리자 비밀번호
- `GITHUB_TOKEN` : GitHub fine-grained token (저장소 Mingit1, Contents: Read and write)

관리자 화면 주소: `https://<사이트 주소>/admin`
""",encoding='utf8')
print('ok', len(doc.encode()))
