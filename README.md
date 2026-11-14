# 소방공무원 합격노트

소방공무원 필기시험(소방학개론·소방관계법규·행정법총론) 학습 웹앱. 빌드 없이 동작하는 정적 사이트(HTML/CSS/JS)입니다.

## 실행
```
cd C:\AI\fire-exam
python -m http.server 8765
```
브라우저에서 http://localhost:8765 접속. `index.html` 더블클릭(file://)로도 동작합니다.
단위 테스트: http://localhost:8765/tests.html (제목이 ALL PASS면 통과)

## 구조
- `js/seed.js` 과목·단원·시험연도·용어집·샘플 문제(30개, 전부 자체 제작 샘플). 코드와 분리된 데이터
- `js/store.js` 데이터 계층(문제 CRUD, 중복 방지, 학습기록, 오답/숙련도, 통계). 저장소는 localStorage → Supabase로 교체 시 이 파일만 수정
- `js/app.js` 화면·라우팅(홈/문제풀이/모의고사/오답노트/통계/마이페이지/문제관리)
- `js/ai.js`, `api/ai.js` AI 해설(미연결 시 저장된 해설로 동작)

## 데이터 규칙
- 문제 유형: 샘플 / 기출(출처확인) / AI 생성 / 출처 미확인. `past`는 출처명+확인 완료일 때만 기출로 표시.
- 법령 조문은 `verified:false`로 표시, 국가법령정보센터에서 확인 후 `true`로 변경.
- CSV 헤더: `subject,chapter,year,difficulty,type,source,verified,text,choice1..choice5,answer,explanation,law` (관리자 화면에서 양식 다운로드)

## 공유·앱 설치 (PWA)
https 주소로 올리면 Android(Chrome)·Windows(Chrome/Edge)에서 앱으로 설치됩니다(오프라인 동작). 서버 없이 정적 호스팅이면 충분합니다.
- Vercel: `fire-exam` 폴더를 프로젝트 루트로 배포 (`vercel --prod`) — vercel.json 포함
- GitHub Pages / Netlify / Cloudflare Pages: 폴더 내용을 그대로 업로드
- 앱 파일을 수정하면 `sw.js`의 `VERSION`을 올려야 사용자에게 갱신됩니다.
- 학습 기록은 각자의 기기(브라우저)에 저장되어 친구와 섞이지 않습니다.

## AI 해설 연결 (Claude)
GitHub Pages는 서버가 없어 API 키를 안전하게 둘 수 없으므로, `api/ai.js`를 Vercel에 별도 배포합니다.
1. vercel.com에서 이 저장소를 Import (Framework: Other) → Environment Variables에 `ANTHROPIC_API_KEY` 추가
2. 배포된 주소 + `/api/ai` 를 `js/config.js`의 `aiEndpoint`에 입력 후 push
3. Anthropic 콘솔에서 월 사용 한도를 설정하세요 (공개 앱이므로 필수)
