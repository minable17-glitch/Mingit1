# 새싹책방 — 인수인계서 (2026-11-10 기준)

> 새 세션의 첫 메시지로 이 문서 전체를 붙여넣으세요.
> 프로젝트 전체 설명(구조·DB·트러블슈팅 이력)은 저장소의 `HANDOFF.md`에 있습니다. 이 문서는 **지금 멈춰 있는 작업**만 정리합니다.

---

## 0. 현재 상태 (업데이트: 2026-11-10)

✅ **지난 숲 앨범 기능은 배포 완료.**
- 배포 브랜치 `claude/saesak-book-app-gsi00u`의 merge 커밋 `fc7ee48`(2026-11-10)에 들어가 있다.
- GitHub Actions "Deploy to GitHub Pages" 실행 결과는 `success`다.
- 배포된 코드는 앨범 커밋 `79d7486`과 동일하다(diff 없음 확인).

남은 일은 없음. 아래 §2·§3은 배포 전에 쓴 기록이라 참고용이다(§3 절차는 다시 실행할 필요 없음).
사용자에게는 §7 "배포 후 안내할 것"만 전달하면 된다.

---

## 1. 사용자 정보
- 비개발자 교사. 기술 용어 없이 쉬운 한국어로, 단계별로 설명할 것.
- 앱은 실제 학급에서 매일 사용 중(live). 배포 전후로 안전에 주의.
- SQL을 줄 때는 **대화창에 복사 가능한 코드 블록**으로 줄 것 (사용자 요청).
- Supabase SQL Editor 링크: https://supabase.com/dashboard/project/ikljkokebcqaxpctcjpy/sql/new

## 2. 저장소 / 브랜치 상태 (GitHub 기준, 확인 완료)

| 브랜치 | 커밋 | 내용 |
|---|---|---|
| `claude/saesak-book-app-gsi00u` (**배포 브랜치**, 저장소 기본 브랜치) | `0ff11cc` | push하면 GitHub Actions "Deploy to GitHub Pages"로 자동 배포. 코드 내용은 `53561bd`와 **완전히 같음** |
| `claude/sleepy-meitner-q3p7j4` (작업 브랜치) | `79d7486` | `53561bd` + 지난 숲 앨범 기능 커밋 1개 |

- 배포 브랜치의 `53561bd..0ff11cc` 5개 커밋은 다른 세션이 "온라인 학교"(3D 학교 페이지)를 넣었다가 **전부 되돌린** 기록. 온라인 학교는 별도 저장소로 옮길 예정이라 **새싹책방 배포에 다시 넣지 말 것.**
- 두 브랜치의 merge-base는 `53561bd`이고, merge하면 결과 코드가 `79d7486`과 **정확히 같음** (이전 세션에서 로컬 merge + 빌드로 확인함).
- `main` 브랜치는 없음.

## 3. 배포 절차 (그대로 실행)

```bash
git fetch origin claude/saesak-book-app-gsi00u claude/sleepy-meitner-q3p7j4
git checkout -B claude/saesak-book-app-gsi00u origin/claude/saesak-book-app-gsi00u
git merge --no-ff origin/claude/sleepy-meitner-q3p7j4 -m "지난 숲 앨범 기능 배포 (sleepy-meitner 브랜치 합치기)"
git diff --stat origin/claude/sleepy-meitner-q3p7j4 HEAD   # 아무것도 안 나와야 정상 (= 앨범 커밋과 코드 동일)
npm ci && npx vite build                                    # 빌드 성공 확인
git push origin claude/saesak-book-app-gsi00u
```
- **force push / rebase 금지** (배포 브랜치는 다른 세션도 씀).
- push 후 GitHub Actions의 "Deploy to GitHub Pages" 실행이 `success`인지 확인.
- 세션이 지정한 작업 브랜치가 따로 있으면, 거기에도 같은 커밋을 push해 둘 것.

## 4. Supabase 상태 (2026-11-10 직접 조회로 확인)
- `forest_albums` 표 있음, `start_new_challenge` / `get_forest_albums` 함수 있음, `teacher_delete_log` 새 버전 적용됨.
- 저장된 앨범 수: 0 (아직 아무 반도 "새 챌린지 시작"을 누르지 않음).
- → **SQL을 다시 실행할 필요 없음.** (실행해도 안전하긴 함: `supabase/forest_album.sql`, 여러 번 실행 가능)

## 5. 이번에 배포되는 기능: 지난 숲 앨범 + 새 챌린지 (커밋 `79d7486`)

사용자 요청: "새 챌린지마다 나무를 새싹부터 다시 키우고, 지난 숲은 앨범으로 기록하고, 학생 독후감도 꼭 저장되게."

- 반 관리의 예전 "챌린지 오늘부터 다시 시작" 버튼 → **"🌱 새 챌린지 시작 (지금 숲은 앨범에 저장)"**
  - RPC `start_new_challenge(p_class_id)`: 지금 숲(학생별 일수·시간·쪽수·완독·장착 악세서리, 반 진행률)과 **독후감 전체 복사본**을 `forest_albums.snapshot`(jsonb)에 저장한다. 그다음 학생 `total_days` / `communal_minutes` / `total_pages`를 오늘 기록만 남기고 다시 세고, `classes.start_date`를 오늘로 바꾼다.
  - 오늘 이미 낸 기록은 새 챌린지 첫날로 들어감. 앨범에는 어제까지 기록이 담김.
  - 첫 앨범에는 그동안의 모든 기록이 들어감. 같은 날 두 번 누르면 막힘.
- **📚 지난 숲 앨범** 화면: 숲 탭 맨 아래 버튼(앨범이 1개 이상일 때)과 반 관리 버튼으로 연다.
  - 그때 숲 모습(나무 단계·악세서리·우리 반 나무·진행률)이 보이고, 나무를 누르면 기록과 독후감이 보인다.
  - 선생님은 앨범별 독후감 엑셀 저장 가능.
- 권한: `get_forest_albums`는 선생님에게 모든 학생 독후감, 학생에게 **자기 독후감만** 준다(서버에서 `logs` 키 제거). 반 소속이 아니면 거부.
- 학생을 삭제해도 앨범 복사본은 남음. 학급 삭제 시에는 앨범도 함께 삭제됨.
- 프론트: `albums[0].next_start_date`(현재 챌린지 시작일)부터의 기록만 내 나무 단계(`myDays`)와 선생님 통계에 반영. 앨범 함수가 DB에 없으면 조용히 무시.
- `teacher_delete_log`: 앨범으로 넘어간 지난 기록을 지우면 지금 나무 일수는 줄지 않음.
- 바뀐 파일: `src/App.jsx`, `src/lib/api.js`, `supabase/forest_album.sql`(신규), `supabase/schema.sql`(끝에 같은 SQL 추가), `HANDOFF.md`(§9-1 추가).
- 검증 내역:
  - 로컬 Postgres 16에 `schema.sql` 전체를 적용해 시나리오를 테스트했다. 앨범 저장, 나무 초기화, 중복 방지, 학생/선생님/외부인 권한, 지난 기록 삭제가 모두 통과했다.
  - 가짜 데이터로 Playwright 화면 확인도 했다(앨범 목록, 앨범 숲, 나무 상세·독후감).

## 6. 이미 배포된 것 (참고)
- `53561bd` "잠깐 멈추기 후 다른 읽기 버튼으로 다시 시작하면 시간이 초기화되던 문제 수정". 2026-10-12 배포 성공.
  - 멈춘 시간을 목표/자유 구분 없이 "읽은 시간"으로 통일했다.
  - 목표를 채운 상태면 자유 읽기로 이어진다.
  - 멈춘 기록이 있으면 버튼에 "▶ 이어서 읽기 (n분 읽음)"이 표시된다.

## 7. 배포 후 사용자에게 안내할 것
1. 앱을 껐다 켜면 새 버전 적용 (열려 있던 앱은 1분 안에 자동 새로고침).
2. 반 관리에 "🌱 새 챌린지 시작" 버튼이 보이는지 확인.
3. **누르면 지금 숲이 앨범으로 넘어가고 모든 나무가 새싹이 되니, 실제로 새 챌린지를 시작할 때만 누르라고** 안내.
4. "📚 지난 숲 앨범" 버튼은 새 챌린지를 한 번 시작한 뒤부터 숲 화면에 보임.

## 8. 그 밖에 진행 중이던 이야기
- 연수용 체험 반: 별도 계정을 만들지 않고, 선생님 계정으로 **"1학년 3반 (연수 체험)"** 반을 새로 만들도록 안내함.
  - 참가자는 https://minable17-glitch.github.io/Mingit1/ → 학생으로 시작 → 반 코드 + 아무 닉네임 + PIN 0000으로 들어간다.
  - 연수 후 "학급 영구 삭제"로 정리하도록 안내함.
  - 사용자가 실제로 반을 만들었는지는 확인 안 됨. 접속 주소도 실제로 열어 보지는 못함.

## 9. 이전 세션이 멈춘 이유 (참고)
- 2026-11-10 이전 세션에서 `git push`가 계속 403으로 실패했다.
  - 오류 메시지: "Claude doesn't have GitHub access to minable17-glitch/Mingit1 for your organization."
  - fetch(읽기)는 됐다.
- 사용자가 https://claude.ai/connect-github 에서 다시 연결했지만, 기존 세션에는 반영되지 않았다.
- 새 세션에서도 403이 나면 GitHub 연결 문제다. 사용자에게 Claude GitHub 앱이 Mingit1 저장소에 설치돼 있는지 확인하도록 안내할 것.
