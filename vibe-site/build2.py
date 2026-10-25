import json, pathlib
here = pathlib.Path(__file__).parent
E = here/'embeds'
def rd(n): return (E/n).read_text(encoding='utf8')
def h(t): return {"t":"h","text":t}
def p(t): return {"t":"p","text":t}
def prompt(label,t): return {"t":"prompt","label":label,"text":t}
def html(title,code,height=640,storage=False):
    b={"t":"html","title":title,"code":code,"height":height}
    if storage: b["storage"]=True   # code uses localStorage -> needs allow-same-origin
    return b
def links(*items): return {"t":"links","items":[{"label":a,"url":b} for a,b in items]}
def page(id,title,parent,*blocks): return {"id":id,"title":title,"parent":parent,"tag":"","desc":"","blocks":list(blocks)}

OPEN = "원본 페이지에서는 이 자리에 아래 화면이 바로 들어 있어요. 이 사이트에서는 보안 규칙상 다른 사이트를 끼워 넣을 수 없어서 새 창으로 엽니다."
pages = [
 page("home","홈",None,
   h("바이브 코딩"),
   links(("bit.ly/eduvibecode","https://bit.ly/eduvibecode"))),
 page("basics","바이브 코딩의 기초개념",None, h("바이브 코딩의 기초개념")),
 page("structure","프로그램 기본구조","basics", html("보이는 쇼핑몰 — 프론트엔드와 백엔드", rd('structure.html'), 760)),
 page("frontend","프론트엔드의 구조(html.css.javascript)","basics", html("껐다 켜보는 HTML · CSS · JavaScript", rd('frontend.html'), 760)),
 page("terms","코딩 용어","basics", p(OPEN),
   links(("코딩 용어 카드 열기","https://coding-term-cards.minable17.chatgpt.site/"))),
 page("webapp","웹앱 기초",None, h("웹앱 만들기")),
 page("cases","사례","webapp", h("사례")),
 page("run","달리기 수업 웹앱","cases", h("PARA RUN"),
   p("학생으로 로그인 누르셔서 학번 9801 이름 코드테스트 1 비밀번호 123456 입력하고 어떤 구성인지 체험해보세요!"),
   p(OPEN),
   links(("달리기 수업 웹앱 열기","https://running-journal-wine.vercel.app/"))),
 page("book","새싹책방","cases", h("새싹책방")),
 page("quiz","퀴즈형 웹앱 만들기(캔버스 구조 파악)","webapp", h("퀴즈형 웹앱 만들기(구조 파악)"),
   prompt("프롬프트","[내가 가르치는 과목-범위]의 기본 개념 학습을 위한 웹앱을 만들고 싶어 스테이지 별로 다양한 상황이 나오고, 그 상황에 따라 의사결정 및 문제를 제대로 풀었는지 평가 하고 싶어\n총 5문제를 풀게 하고 싶어 HTML 코드로 작성해줘")),
 page("make","웹앱 만들기(실습)","webapp", h("농구 타이머 만들기"),
   p("조건"),
   p("첫째, 우리 반 학생 이름 버튼들이 있을 것."),
   p("둘째, 이름 버튼을 누르면 그 학생 옆에 별(⭐)이 하나씩 늘어날 것."),
   h("완성된 프롬포트(힌트)"),
   prompt("프롬프트 예시","수업 중 교실 TV에 띄워놓을 칭찬 스티커판 웹웹을 만들어줘. 우리 반 학생 이름 버튼들이 있고, 버튼을 누를 때마다 그 학생 옆에 별(⭐)이 하나씩 늘어나게 해줘")),
 page("seat","자리배치표","webapp", h("자리배치표")),
 page("debug","디버깅",None, html("버그를 찾아 고치는 법 — 디버깅", rd('debug.html'), 700)),
 page("debug-css","디버깅 실습 (CSS)","debug", h("디버깅 실습"),
   p("칭찬 스티커판을 켰는데 화면이 허전해요. 상단 '총 수여된 스티커' 글씨가 안 보이고, 학생을 눌러도 별(⭐)이 화면에 나타나지 않습니다. 박스와 숫자 배지는 있는데 글씨와 별만 사라진 것 같아요. AI를 활용해서 왼쪽 코드를 수정--> 왼쪽에 붙여넣기 하면 오른쪽 웹앱의 오류가 수정됩니다."),
   html("코드 고치기 — 칭찬 스티커판 (CSS)", rd('debug_css.html'), 980, storage=True),
   h("힌트 - 정답 프롬포트"),
   prompt("정답 프롬프트","이 칭찬 스티커판 코드에서 상단 '총 수여된 스티커' 글씨가 안 보이고, 별 스티커도 화면에 안 나타나. 글자 색이 배경이랑 같거나 투명하게 설정된 것 같아. 안 보이는 원인을 찾아서 잘 보이게 고쳐줘. 어디를 바꿨는지 알려줘")),
 page("debug-js","디버깅 실습(Java script)","debug", h("디버깅 실습(자바스크립트)"),
   p("수업용 칭찬 스티커판을 만들었는데 이상해요. 학생 이름을 눌러도 별 개수가 0에서 안 올라갑니다. 버튼은 분명히 눌리고 반응도 있는데 숫자만 그대로예요."),
   p("AI를 활용해서 왼쪽 코드를 수정해서 붙여넣기 하면 오른쪽 웹앱의 오류가 수정됩니다."),
   html("코드 고치기 — 칭찬 스티커판 (JavaScript)", rd('debug_js.html'), 980, storage=True),
   h("힌트 - 정답 프롬포트"),
   prompt("정답 프롬프트","\"이 칭찬 스티커판 코드에서 학생 이름 버튼을 눌러도 별 개수가 안 올라가. 버튼은 눌리는데 숫자가 0 그대로야. 별을 더하는 부분을 찾아서 고쳐줘. 어디를 어떻게 바꿨는지도 알려줘.\"")),
 page("appscript","앱스크립트",None, html("앱스크립트란? — 화면과 구글 시트를 잇는 코드", rd('appscript.html'), 1100)),
 page("refine","AI 와 함께 프롬포트 다듬기","appscript", html("AI와 함께 프롬프트 다듬기", rd('prompt.html'), 1000)),
 page("ex-old","앱스크립트 실습(기존코드)","appscript", h("앱스크립트 실습"),
   p("실습 1 웹앱 만들기에서 만들었던 칭찬 도장판을 기록할 수 있는 형태로 앱스크립트로 만들어주세요!"),
   p("기존 코드 활용 할 때(힌트)"),
   prompt("프롬프트","구글 앱스크립트로 이 웹앱을 옮겨줘. 화면은 그대로 두고, 저장을 구글 시트로 바꿔서 기록이 남게 해줘.\n코드는 Code.gs와 index.html로 나눠서, 각 파일에 무엇을 넣는지 알려줘. 설치하고 배포하는 방법도 단계별로 알려줘.\n아래는 기존 코드야:\n[여기에 기존 코드 붙여넣기]")),
 page("ex-new","실습(새로, 기본)","appscript", h("앱스크립트 실습"), h("(새로만들기)"),
   p("점심시간 배드민턴 대회 참가 신청을 받는다. 정원은 20명. 복도 게시판에 종이 신청서를 붙였더니, 같은 학생이 두 번 이름을 쓰고, 학번을 안 적은 칸도 있고, 몇 명 남았는지는 매번 세어봐야 한다. 신청하면 기록이 시트에 쌓이고, 남은 자리가 바로 보이고, 중복 신청은 막아주는 신청 앱을 만들어 보자."),
   p("조건 ① 학번 필수 입력 ② 남은 자리 표시 ③ 중복 신청 막기")),
 page("ex-adv","실습(새로, 심화)","appscript", h("앱스크립트 실습(심화)"), h("(새로만들기)"),
   p("배드민턴 대회가 큰 인기를 끌어 전교생 대상 2회 대회를 열기로 했다. 정원은 30명, 금요일 오후 4시 정각 선착순 오픈. 그런데 1회 때 만든 신청 앱으로는 문제가 생겼다. 공지 전에 미리 신청한 학생이 있었고, 오픈 순간 수십 명이 몰려 정원을 넘겼고, 신청한 학생들은 \"저 된 거 맞아요?\" 하고 교무실까지 찾아왔다. 기본 실습에서 만든 앱에 기능을 더해서 이 문제들을 해결해 보자."),
   p("추가 조건 ④ 관리자 페이지에서 신청 열기/닫기 ⑤ 시작·마감 시각 예약 (시작 전 카운트다운) ⑥ 내 신청 확인 (학번+이름으로 신청 여부와 몇 번째인지 확인) ⑦ 동시 신청 안전 처리"),
   h("모범 프롬포트(힌트)"),
   prompt("모범 프롬프트","아래는 구글 앱스크립트로 만든 배드민턴 대회 신청 앱 코드야.\n기존 기능(학번 필수, 남은 자리, 중복 막기)은 유지하고, 정원을 30명으로 바꾼 뒤 다음 기능을 추가해줘.\n요구사항:\n1. 관리자 페이지: 비밀번호로 들어가고, '신청 시작'·'신청 마감' 버튼으로 신청을 열고 닫는다.\n2. 시각 예약: 관리자가 시작·마감 시각을 설정하면 자동으로 열리고 닫힌다. 시작 전엔 학생 화면에 카운트다운을 보여준다. 시각 확인은 서버에서, 시간대는 한국 시간으로.\n3. 내 신청 확인: 학번과 이름이 모두 맞으면 신청 여부와 몇 번째 신청인지 보여준다.\n4. 동시 신청: LockService로 동시에 몰려도 정원을 넘지 않게 처리하고, 처리 중·마감·재시도 안내를 보여준다.\nCode.gs와 index.html 전체 코드를 알려주고, 관리자 페이지 들어가는 방법과 다시 배포하는 방법도 알려줘.\n[기존 코드 붙여넣기]")),
 page("ex-game","게임형과제(예시)","appscript", h("앱스크립트 예시"),
   links(("앱스크립트 시트","https://docs.google.com/spreadsheets/d/1V9p8x1oNPkkhmkeItCdbe6W0XVZHQGFAUxVI9jbq0ss/edit?usp=sharing")),
   p("팀 이름 입력(아무거나) -->  과제시작 --> 1 키워드 '팀워크'--> 2 키워드 ' 스포츠맨십 '"),
   p(OPEN),
   links(("게임형 과제 웹앱 열기","https://script.google.com/macros/s/AKfycbydwS2Y_sXrTbaVie_0W0L4wm0MUqhRJu70mlmQgj7IqW60GLZTiBC1gY2VDJUvr7D-1g/exec"))),
 page("ex-apply","연수신청(예시)","appscript", h("앱스크립트예시"), h("(연수신청)"),
   p("선착순 마감 연수신청 할 때"),
   links(("연수 명단 시트","https://docs.google.com/spreadsheets/d/1pcii0JFp3MJ7e5C1_QOtON3YobRxl1mw48OGxK7qn1A/edit?usp=sharing")),
   p(OPEN),
   links(("연수신청 웹앱 열기","https://script.google.com/macros/s/AKfycbzRlgGkFfQGskNQsHOc7pdtO-RolUt14G74M9GkuRC--VVAZtNwBdM6KdiHoe8BK4eI/exec"))),
 page("dddd","dddd","appscript", h("dddd"), h("CODE GS"),
   prompt("Code.gs (칭찬팡 도장)", rd('code_gs.txt')), h("index"), prompt("index.html (칭찬팡 도장)", rd('index_html.txt'))),
 page("api","API",None, h("API")),
 page("api-prac","API 실습","api", h("API 실습")),
 page("api-concept","API 개념","api", h("API 개념")),
 page("api-ex","API활용 예시","api", h("API활용 예시")),
]
site={"v":1,"pages":pages}
blob=json.dumps(site,ensure_ascii=False).replace("<","\\u003c")
tpl=(here/'template.html').read_text(encoding='utf8')
assert "__DATA__" in tpl
out=tpl.replace("__DATA__",blob)
(here/'site.html').write_text(out,encoding='utf8')
print(len(pages),len(out.encode()))
