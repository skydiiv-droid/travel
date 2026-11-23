// 시드 데이터 생성기 (최초 1회용). 결과물 data/seed.json 이 정본이며,
// 이후 수정은 seed.json 을 직접 고치거나 앱의 import 로 반영한다.
// 사용: node tools/gen-seed.js && node tools/build.js
'use strict';
const fs = require('fs');
const path = require('path');

const SOURCE_DATE = '2026-11';

// 월별 날씨 보정(날씨 쾌적도 축에 가산), 1~12월
const WP = {
  central:  [-3,-2, 0, 2, 3, 1,-2,-3, 2, 3, 1,-2],
  east:     [-2,-1, 0, 2, 3, 1, 0,-1, 1, 3, 1,-2],
  mountain: [-3,-2,-1, 1, 3, 2, 0, 0, 2, 3, 0,-3],
  south:    [-1,-1, 1, 2, 3, 0,-2,-3, 1, 3, 2,-1],
  jeju:     [-1,-1, 1, 2, 3,-1,-2,-2, 0, 3, 1,-1],
  indoor:   [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  water:    [-4,-4,-3,-1, 0, 2, 3, 3, 0,-3,-4,-4],
  jp:       [-2,-2, 0, 3, 3,-1,-3,-3, 0, 3, 3,-1],
  hokkaido: [-2,-1,-2, 0, 2, 3, 3, 2, 2, 1,-1,-2],
  okinawa:  [ 0, 0, 2, 3, 1, 0, 1, 0,-1, 2, 2, 1],
  tw:       [ 1, 1, 2, 2, 0,-2,-3,-3,-2, 2, 3, 2],
  danang:   [ 0, 2, 3, 3, 2, 1, 1, 0,-2,-3,-3,-1],
  thai:     [ 3, 2, 0,-2,-2,-1,-1,-1,-2,-1, 2, 3],
  phil:     [ 2, 3, 3, 2, 1,-1,-2,-2,-2,-1, 0, 1],
  eq:       [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,-1,-1],
  bali:     [-2,-2,-1, 1, 2, 3, 3, 3, 2, 1,-1,-2],
};
// 월별 혼잡도 보정(혼잡도(한산함) 축에 가산, 음수 = 더 붐빔)
const CP = {
  beach:    [ 1, 1, 1, 0, 0,-1,-2,-3, 0, 0, 1, 1],
  foliage:  [ 1, 1, 0,-1,-1, 0, 0, 0,-1,-3,-2, 1],
  general:  [ 0, 0, 0,-1,-1, 0,-1,-2, 0,-1, 0, 0],
  ski:      [-2,-2, 0, 1, 0, 0,-1,-1, 0,-1, 0,-1],
  spring:   [ 0, 0,-1,-3,-1, 0, 0,-1, 0,-1, 0, 0],
  city:     [ 0, 0, 0, 0,-1, 0,-1,-1, 0,-1, 0,-1],
  jeju:     [ 0,-1, 0,-1,-1, 0,-1,-2, 0,-1, 0, 0],
  park:     [ 0, 0, 0, 0,-3, 0,-1,-2, 0,-2, 0,-2],
  jp:       [ 0,-1,-1,-2,-1, 0,-1,-2, 0, 0,-1,-1],
  hokkaido: [-1,-2, 0, 0, 0, 0,-1,-1, 0, 0, 0,-1],
  resort:   [-1,-2, 0, 0, 0, 0,-1,-2, 0, 0, 0,-2],
  twhk:     [-1,-2, 0, 0, 0, 0,-1,-1, 0,-1, 0,-1],
};

// 이동 피로(편함) 점수는 집(발산역) 기준 소요시간에서 산출
function moveScore(type, home) {
  const v = type === 'overseas' ? 10 - (home - 200) / 60 : 10 - home / 40;
  return Math.round(Math.max(1, Math.min(10, v)) * 2) / 2;
}

// [id, name, region, tags, drive, crowd, food, nature, city, walk, stay, weather, value, activity, wp, cp, home, work, cost, notes]
const DOMESTIC = [
  ['gangneung','강릉','강원',['바다','카페','KTX'],6,5,8,8,6,7,8,6,6,6,'east','beach',180,200,2,'KTX 강릉선. 경포·안목 커피거리·주문진'],
  ['sokcho','속초','강원',['바다','설악산','시장'],4,5,8,9,5,6,8,6,6,7,'east','beach',180,200,2,'동서울 버스 2시간대. 설악산·중앙시장'],
  ['yangyang','양양','강원',['서핑','바다'],3,5,6,8,3,7,7,6,6,8,'east','beach',170,190,2,'서핑·낙산사. 차량 이동 위주'],
  ['chuncheon','춘천','강원',['호수','닭갈비','ITX'],7,6,7,7,5,7,6,6,7,6,'central','general',100,120,1,'ITX-청춘·경춘선. 남이섬·소양강'],
  ['pyeongchang','평창','강원',['스키','목장','KTX'],3,6,6,9,3,6,8,6,5,8,'mountain','ski',160,175,2,'KTX 진부·평창역. 대관령 목장·리조트'],
  ['jeongseon','정선','강원',['오일장','레일바이크','하이원'],2,7,6,9,3,5,6,6,6,7,'mountain','general',200,220,1,'정선 5일장(2·7일), 하이원 리조트'],
  ['samcheok','삼척','강원',['동굴','해상케이블카','바다'],3,7,6,9,3,6,6,6,7,6,'east','beach',240,260,1,'환선굴·장호항·해상케이블카'],
  ['donghae','동해','강원',['바다','계곡'],4,7,6,8,3,7,6,6,7,5,'east','beach',220,240,1,'무릉계곡·묵호 논골담길. KTX 동해역'],
  ['hongcheon','홍천','강원',['리조트','워터파크'],2,7,5,8,2,7,7,6,6,7,'mountain','ski',110,130,2,'비발디파크·오션월드'],
  ['inje','인제','강원',['래프팅','숲'],2,7,5,9,2,5,5,6,7,8,'mountain','foliage',150,170,1,'내린천 래프팅·원대리 자작나무숲'],
  ['cheorwon','철원','강원',['협곡','트레킹'],2,8,5,8,3,7,4,5,7,5,'central','foliage',120,120,1,'한탄강 주상절리길·고석정'],
  ['gapyeong','가평','경기',['펜션','수상레저','ITX'],5,5,6,8,3,7,7,6,6,8,'central','general',85,95,2,'ITX-청춘 가평역. 쁘띠프랑스·자라섬'],
  ['yangpyeong','양평','경기',['카페','강','전철'],5,6,7,8,3,8,6,6,6,5,'central','general',75,90,2,'경의중앙선. 두물머리·세미원'],
  ['ganghwa','강화도','인천',['섬','역사','해산물'],3,7,7,7,5,7,5,6,7,5,'central','general',60,35,1,'완정에서 가까움. 전등사·조양방직·석모도'],
  ['yeongjong','영종·무의도','인천',['바다','호캉스'],6,6,6,7,4,8,8,6,6,5,'central','beach',45,35,2,'을왕리·무의도. 공항철도'],
  ['suwon','수원','경기',['성곽','행궁동','갈비'],8,5,7,4,7,6,7,6,7,4,'central','city',60,75,2,'수원화성·행궁동. 전철·버스 편리'],
  ['paju','파주','경기',['출판단지','DMZ','카페'],4,6,6,6,6,7,6,6,7,5,'central','general',45,40,1,'헤이리·출판도시·임진각'],
  ['pocheon','포천','경기',['호수','아트밸리','온천'],2,7,6,8,3,6,6,6,7,6,'central','foliage',90,95,1,'산정호수·포천아트밸리'],
  ['daebudo','대부도','경기',['갯벌','칼국수','섬'],3,6,7,6,3,8,5,6,7,5,'central','general',75,80,1,'제부도·궁평항, 바지락칼국수'],
  ['danyang','단양','충북',['패러글라이딩','강','동굴'],4,6,6,9,4,6,6,6,7,8,'mountain','foliage',160,180,1,'도담삼봉·패러글라이딩·고수동굴'],
  ['jecheon','제천','충북',['호수','케이블카','리조트'],3,7,6,8,3,7,7,6,7,6,'mountain','foliage',140,160,1,'청풍호 케이블카·의림지'],
  ['chungju','충주','충북',['호수','동굴','온천'],4,7,6,8,3,7,6,6,7,6,'central','foliage',120,140,1,'충주호·활옥동굴·수안보온천'],
  ['gongju','공주','충남',['백제','성곽'],4,8,6,6,6,7,5,6,8,4,'central','general',120,135,1,'공산성·무령왕릉'],
  ['buyeo','부여','충남',['백제','연못'],4,8,6,7,6,7,5,6,8,4,'central','general',140,155,1,'궁남지·부소산성'],
  ['taean','태안','충남',['해변','안면도','낙조'],2,6,7,8,3,7,6,6,7,6,'central','beach',140,150,1,'안면도 꽃지·신두리 해안사구. 자차 권장'],
  ['boryeong','보령','충남',['해수욕장','머드','해산물'],4,5,7,7,4,8,6,6,7,7,'central','beach',135,145,1,'대천해수욕장·머드축제(7월)'],
  ['asan','아산','충남',['온천','KTX'],7,7,6,5,4,8,6,6,7,5,'central','general',80,95,1,'온양온천·외암민속마을. 천안아산역'],
  ['cheongju','청주','충북',['산성','도심'],6,7,6,6,5,7,6,6,8,4,'central','city',110,125,1,'수암골·청남대·상당산성'],
  ['jeonju','전주','전북',['한옥마을','맛집','KTX'],7,4,9,4,7,6,7,6,8,4,'south','city',150,165,1,'KTX 전라선. 한옥마을·남부시장'],
  ['gunsan','군산','전북',['근대거리','섬','짬뽕'],6,7,8,5,6,7,6,6,8,4,'south','general',165,175,1,'근대문화거리·선유도'],
  ['yeosu','여수','전남',['밤바다','케이블카','해산물','항공'],6,5,9,8,6,6,8,6.5,6,6,'south','general',170,190,2,'김포–여수 항공 또는 KTX. 해상케이블카'],
  ['suncheon','순천','전남',['순천만','정원'],6,6,8,9,5,6,6,6.5,7,4,'south','foliage',210,225,1,'순천만 습지(갈대 10~11월)·국가정원'],
  ['damyang','담양','전남',['대나무숲','떡갈비'],3,7,8,8,4,7,5,6,7,4,'south','general',190,205,1,'죽녹원·메타세쿼이아길. 광주 경유'],
  ['mokpo','목포','전남',['케이블카','낙지','근대거리'],6,7,9,7,5,7,6,6.5,8,5,'south','general',190,205,1,'KTX 목포역. 해상케이블카'],
  ['namwon','남원','전북',['광한루','지리산'],4,8,7,8,4,7,5,6,8,4,'south','general',180,195,1,'광한루원·지리산 둘레길'],
  ['gwangju','광주','전남',['맛집','예술','KTX'],8,7,9,4,7,7,7,6.5,8,4,'south','city',150,165,1,'KTX 광주송정·김포–광주 항공'],
  ['boseong','보성','전남',['녹차밭','바다'],2,8,7,8,2,7,5,6.5,8,4,'south','general',240,255,1,'대한다원·율포해수욕장'],
  ['haenam','해남·강진','전남',['땅끝','사찰','한정식'],2,9,8,9,2,6,5,6.5,8,4,'south','foliage',270,285,1,'땅끝마을·대흥사·강진 한정식'],
  ['gochang','고창','전북',['고인돌','선운사','장어'],2,8,7,8,3,7,5,6,8,4,'south','general',180,195,1,'선운사(꽃무릇 9월)·고인돌'],
  ['gyeongju','경주','경북',['역사','황리단길','벚꽃'],5,4,7,7,8,6,8,6.5,7,6,'south','spring',180,200,1,'KTX 신경주. 대릉원·보문단지'],
  ['andong','안동','경북',['하회마을','찜닭'],4,7,8,7,6,7,6,6,8,4,'central','general',180,200,1,'KTX-이음 안동역. 하회마을·월영교'],
  ['busan_haeundae','부산 해운대·기장','부산',['바다','호텔','야경','항공'],8,4,9,8,8,7,9,6.5,6,7,'south','beach',165,185,3,'김포–김해 항공 또는 KTX. 해운대·광안리·기장'],
  ['busan_old','부산 원도심(남포·영도)','부산',['시장','영도','문화마을'],8,4,9,6,9,5,7,6.5,7,5,'south','city',160,180,2,'자갈치·국제시장·감천문화마을·흰여울'],
  ['tongyeong','통영','경남',['섬','케이블카','해산물'],4,6,9,9,5,6,6,6.5,7,6,'south','general',240,255,2,'케이블카·동피랑·욕지도'],
  ['geoje','거제','경남',['해안','섬'],3,6,8,9,4,6,7,6.5,6,6,'south','beach',220,235,2,'김해공항 경유. 바람의언덕·외도'],
  ['namhae','남해','경남',['독일마을','다랭이마을'],2,7,7,9,3,6,7,6.5,6,5,'south','general',230,245,2,'자차 필수에 가까움. 독일마을·다랭이마을'],
  ['jinju','진주','경남',['진주성','냉면'],5,8,8,6,5,7,6,6.5,8,4,'south','general',200,215,1,'김포–사천 항공 또는 KTX. 진주성'],
  ['pohang','포항','경북',['바다','스페이스워크','과메기'],5,6,8,8,5,7,7,6,7,6,'south','beach',170,190,2,'KTX 포항역. 호미곶·스페이스워크'],
  ['yeongdeok','영덕','경북',['대게','해안길'],3,7,8,8,2,7,5,6,7,4,'east','general',240,260,1,'강구항 대게(겨울~봄)·블루로드'],
  ['uljin','울진','경북',['온천','대게','숲'],2,8,7,8,2,7,6,6,7,5,'east','general',240,260,1,'덕구·백암온천·금강송숲'],
  ['daegu','대구','대구',['도심','막창','KTX'],8,6,8,4,7,7,7,5.5,8,5,'south','city',150,170,1,'KTX 동대구. 근대골목·서문시장. 여름 매우 더움'],
  ['ulsan','울산','울산',['바다','태화강'],6,7,7,8,5,7,7,6.5,7,5,'south','general',165,185,2,'김포–울산 항공. 대왕암·간절곶'],
  ['mungyeong','문경','경북',['새재','레일바이크'],3,8,6,8,4,6,6,6,7,6,'mountain','foliage',150,165,1,'문경새재·활공장'],
  ['hadong','하동','경남',['녹차','섬진강','벚꽃'],2,8,7,9,3,6,6,6.5,7,4,'south','spring',230,245,1,'쌍계사 십리벚꽃길·화개장터'],
  ['changwon','창원·진해','경남',['벚꽃','군항제'],6,6,7,6,5,7,6,6.5,7,4,'south','spring',210,225,2,'진해 군항제(4월초)'],
  ['ulleung','울릉도','경북',['섬','트레킹','독도'],2,9,7,10,2,4,5,6,5,7,'east','general',420,440,3,'포항·묵호·강릉 여객선. 결항 잦음, 공항 개항 일정 확인 필요'],
  ['jeju_city','제주시권(애월·한림)','제주',['공항','시장','해안'],3,4,8,8,6,7,8,6.5,5,6,'jeju','jeju',155,175,2,'김포–제주. 동문시장·애월·협재'],
  ['seogwipo','서귀포권(중문)','제주',['리조트','올레','폭포'],2,5,8,9,5,6,9,7,5,7,'jeju','jeju',200,220,3,'중문관광단지·올레시장·천지연'],
  ['jeju_east','제주 동부(성산·구좌)','제주',['일출봉','우도','오름'],2,6,8,10,3,6,7,6.5,6,7,'jeju','jeju',195,215,2,'성산일출봉·우도·월정리'],
  ['yeongwol','영월','강원',['동강','래프팅','천문대'],3,8,6,8,3,7,5,6,8,6,'mountain','general',160,180,1,'동강 래프팅·별마로천문대·청령포'],
];

const SPOTS = [
  ['everland','에버랜드','경기 용인',['테마파크'],6,2,5,4,9,3,5,6,5,10,'central','park',75,90,2,'평일 추천. 주말 매우 혼잡'],
  ['caribbean','캐리비안 베이','경기 용인',['워터파크'],6,2,4,3,7,4,5,6,4,9,'water','park',75,90,2,'야외 시설은 여름 위주 운영'],
  ['lotteworld','롯데월드','서울 잠실',['테마파크','실내'],9,2,5,1,8,4,5,9,5,9,'indoor','park',60,80,2,'실내 위주라 날씨 영향 적음'],
  ['seoulland','서울랜드','경기 과천',['테마파크'],8,4,5,4,6,4,5,6,7,7,'central','park',50,65,1,'4호선 대공원역'],
  ['legoland','레고랜드 코리아','강원 춘천',['테마파크'],6,5,4,5,6,5,6,6,4,7,'central','park',100,120,2,'춘천역 셔틀'],
  ['lotte_busan','롯데월드 어드벤처 부산','부산 기장',['테마파크'],5,4,5,4,7,4,6,6.5,5,9,'south','park',180,200,2,'당일로는 장거리'],
  ['gyeongjuworld','경주월드','경북 경주',['테마파크','스릴'],5,5,5,5,6,4,6,6.5,6,9,'south','park',180,200,1,'스릴 기구 강세'],
  ['eworld','이월드','대구',['테마파크','야경'],7,5,5,4,6,5,6,5.5,7,7,'south','park',150,170,1,'83타워. 지하철 2호선'],
  ['folkvillage','한국민속촌','경기 용인',['민속','체험'],6,6,6,6,6,5,5,6,7,5,'central','park',65,80,1,'야간 행사 시즌 확인'],
  ['gm_cave','광명동굴','경기 광명',['동굴','실내'],7,6,4,6,5,6,5,9,8,4,'indoor','general',35,50,1,'KTX 광명역 인근'],
  ['aqua_ilsan','아쿠아플라넷 일산','경기 고양',['아쿠아리움','실내'],8,5,5,3,5,8,5,9,6,4,'indoor','park',35,40,1,'킨텍스 인근'],
  ['cimer','파라다이스시티 씨메르','인천 영종',['스파','호캉스','실내'],7,6,6,4,5,9,8,9,5,5,'indoor','city',45,35,3,'숙박 연계 시 1박 호캉스로도 가능'],
];

// [id, name, region, tags, drive, crowd, food, nature, city, walk, stay, weather, value, activity, wp, cp, home, work, cost, min_nights, long_off, notes]
const OVERSEAS = [
  ['tokyo','도쿄','일본',['도시','쇼핑','맛집'],9,3,9,4,10,4,8,6,5,6,'jp','jp',280,300,2,2,false,'김포–하네다. 도보량 많음'],
  ['osaka','오사카','일본',['맛집','도시','USJ'],9,4,10,4,9,6,7,6,6,6,'jp','jp',250,270,2,2,false,'김포–간사이 가능'],
  ['kyoto','교토','일본',['사찰','정원','단풍'],7,3,8,8,9,3,8,6,5,4,'jp','jp',310,330,2,2,false,'간사이공항 경유. 단풍·벚꽃철 매우 혼잡'],
  ['fukuoka','후쿠오카','일본',['맛집','근거리','온천'],9,6,9,5,7,7,7,6.5,8,4,'jp','jp',275,265,1,2,false,'비행 1시간대. 유후인·다자이후 연계'],
  ['sapporo','삿포로','일본',['설경','맛집','여름피서'],6,5,9,9,6,5,7,6,5,7,'hokkaido','hokkaido',405,395,3,3,false,'2월 눈축제. 여름 선선'],
  ['okinawa','오키나와','일본',['바다','리조트','렌터카'],3,5,7,9,4,7,8,6.5,6,8,'okinawa','jp',360,350,2,3,false,'렌터카 필요. 장마 5~6월, 태풍 8~9월'],
  ['taipei','타이베이','대만',['야시장','근거리'],9,5,9,6,8,6,6,6,8,5,'tw','twhk',290,310,1,2,false,'김포–쑹산. 여름 무더위·태풍'],
  ['hongkong','홍콩·마카오','홍콩',['야경','도시','딤섬'],9,3,9,5,9,5,6,6,4,5,'tw','twhk',440,430,3,2,false,'숙박비 높음'],
  ['danang','다낭','베트남',['리조트','바다','가성비'],7,5,8,8,5,8,8,6,9,6,'danang','resort',500,490,1,3,false,'우기 9~12월'],
  ['nhatrang','나트랑','베트남',['리조트','바다','액티비티'],6,5,7,8,4,8,8,6,9,7,'danang','resort',545,535,1,3,false,'캄란공항. 우기 10~12월'],
  ['bangkok','방콕','태국',['맛집','도시','마사지'],8,3,10,3,9,5,8,5.5,9,6,'thai','resort',565,555,1,3,false,'건기 11~2월'],
  ['chiangmai','치앙마이','태국',['한달살기','카페','자연'],6,6,9,8,6,6,8,6,10,6,'thai','resort',540,530,1,4,true,'직항 있음. 3~4월 연무'],
  ['phuket','푸켓','태국',['바다','리조트','호핑'],4,5,8,9,5,7,9,6,7,9,'thai','resort',615,605,2,4,true,'우기 5~10월'],
  ['cebu','세부','필리핀',['바다','다이빙','리조트'],5,5,6,9,4,8,8,6,7,9,'phil','resort',495,485,2,3,true,'막탄 리조트. 우기 6~10월'],
  ['singapore','싱가포르','싱가포르',['도시','깔끔','야경'],10,4,9,5,9,6,9,6,3,6,'eq','resort',585,575,3,3,false,'대중교통 최상. 물가 높음'],
  ['kotakinabalu','코타키나발루','말레이시아',['석양','섬','리조트'],6,6,7,9,4,8,8,6.5,8,8,'eq','resort',495,485,2,4,true,'반딧불·섬 투어'],
  ['bali','발리','인도네시아',['리조트','자연','한달살기'],4,5,8,10,5,7,10,6,7,8,'bali','resort',660,650,2,5,true,'건기 4~10월. 지역 간 이동 시간 김'],
];


// 여행지 속성 (과거 불편 체크 항목과 맞춰 감점에 쓰임). 초안 추정치.
// [transfer_load 0~2, ticket_hard, car_needed 0~2, hilly, spread_out, content_nights, early_close, cancel_risk, waiting_heavy]
const ATTR_KEYS = ['transfer_load','ticket_hard','car_needed','hilly','spread_out','content_nights','early_close','cancel_risk','waiting_heavy'];
const ATTR_BOOL = { ticket_hard: 1, hilly: 1, spread_out: 1, early_close: 1, cancel_risk: 1, waiting_heavy: 1 };
const ATTRS = {
  gangneung:[1,1,1,0,1,2,0,0,1], sokcho:[1,1,1,0,0,2,0,0,0], yangyang:[1,0,2,0,1,2,1,0,0], chuncheon:[0,0,0,0,0,1,0,0,0],
  pyeongchang:[1,0,1,0,1,2,1,0,0], jeongseon:[2,0,2,0,1,2,1,0,0], samcheok:[2,0,2,1,1,1,1,0,0], donghae:[1,0,1,0,0,1,1,0,0],
  hongcheon:[1,0,2,0,0,2,1,0,0], inje:[2,0,2,1,1,1,1,0,0], cheorwon:[2,0,2,1,1,1,1,0,0], gapyeong:[0,0,1,0,1,2,0,0,0],
  yangpyeong:[0,0,1,0,1,1,0,0,0], ganghwa:[1,0,1,0,1,1,1,0,0], yeongjong:[0,0,1,0,0,1,0,0,0], suwon:[0,0,0,0,0,1,0,0,1],
  paju:[1,0,1,0,1,1,0,0,0], pocheon:[1,0,2,0,1,1,1,0,0], daebudo:[1,0,2,0,1,1,1,0,0], danyang:[1,0,1,0,0,1,1,0,0],
  jecheon:[1,0,1,0,1,1,1,0,0], chungju:[1,0,1,0,1,1,1,0,0], gongju:[1,0,1,0,0,1,1,0,0], buyeo:[2,0,1,0,0,1,1,0,0],
  taean:[2,0,2,0,1,2,1,0,0], boryeong:[1,0,1,0,0,1,0,0,0], asan:[1,0,1,0,1,1,0,0,0], cheongju:[1,0,1,0,1,1,0,0,0],
  jeonju:[1,1,0,0,0,1,0,0,1], gunsan:[1,0,1,0,0,1,0,0,0], yeosu:[1,1,1,0,1,2,0,0,1], suncheon:[1,0,1,0,0,1,0,0,0],
  damyang:[2,0,1,0,1,1,1,0,0], mokpo:[1,0,1,0,0,1,0,0,0], namwon:[1,0,1,0,0,1,1,0,0], gwangju:[0,0,0,0,0,1,0,0,0],
  boseong:[2,0,2,0,1,1,1,0,0], haenam:[2,0,2,0,1,2,1,0,0], gochang:[2,0,2,0,1,1,1,0,0], gyeongju:[1,1,1,0,0,2,0,0,1],
  andong:[1,0,1,0,1,1,1,0,0], busan_haeundae:[0,1,0,0,1,3,0,0,1], busan_old:[0,1,0,1,0,2,0,0,1], tongyeong:[2,0,1,1,0,2,0,0,0],
  geoje:[2,0,2,1,1,2,1,0,0], namhae:[2,0,2,1,1,2,1,0,0], jinju:[1,0,1,0,0,1,0,0,0], pohang:[1,0,1,0,1,1,0,0,0],
  yeongdeok:[2,0,2,0,1,1,1,0,0], uljin:[2,0,2,0,1,1,1,0,0], daegu:[1,0,0,0,0,1,0,0,0], ulsan:[1,0,1,0,1,1,0,0,0],
  mungyeong:[2,0,2,0,0,1,1,0,0], hadong:[2,0,2,0,1,1,1,0,0], changwon:[1,0,1,0,1,1,0,0,1], ulleung:[2,1,1,1,1,3,1,1,0],
  jeju_city:[0,1,1,0,1,3,0,1,1], seogwipo:[1,1,2,0,1,3,0,1,0], jeju_east:[1,1,2,0,1,3,1,1,0], yeongwol:[2,0,2,0,1,1,1,0,0],
  everland:[1,0,0,1,0,1,0,0,1], caribbean:[1,0,0,0,0,1,0,0,1], lotteworld:[0,0,0,0,0,1,0,0,1], seoulland:[0,0,0,1,0,1,0,0,0],
  legoland:[1,0,0,0,0,1,0,0,0], lotte_busan:[1,1,1,0,0,1,0,0,0], gyeongjuworld:[1,1,1,0,0,1,0,0,0], eworld:[1,0,0,1,0,1,0,0,0],
  folkvillage:[1,0,1,0,0,1,0,0,0], gm_cave:[1,0,1,1,0,1,0,0,0], aqua_ilsan:[1,0,0,0,0,1,0,0,0], cimer:[0,0,0,0,0,1,0,0,0],
  tokyo:[0,0,0,0,1,5,0,0,1], osaka:[0,0,0,0,0,4,0,0,1], kyoto:[1,0,0,1,1,3,1,0,1], fukuoka:[0,0,0,0,0,3,0,0,0],
  sapporo:[0,1,1,0,1,4,0,1,0], okinawa:[0,0,2,0,1,4,0,1,0], taipei:[0,0,0,0,0,4,0,0,0], hongkong:[0,0,0,1,0,3,0,0,1],
  danang:[0,0,0,0,0,5,0,0,0], nhatrang:[0,0,0,0,0,5,0,0,0], bangkok:[0,0,0,0,1,6,0,0,0], chiangmai:[0,0,0,0,0,10,0,0,0],
  phuket:[0,0,1,1,1,7,0,0,0], cebu:[0,0,1,0,1,6,0,1,0], singapore:[0,0,0,0,0,4,0,0,0], kotakinabalu:[0,0,0,0,0,5,0,0,0],
  bali:[1,0,1,0,1,10,0,0,0],
};

// 숙소·음식 선택지. [stay_variety 0~2, 숙소 유형 코드, food_variety 0~2, 음식 종류 코드]
// 숙소: H 호텔 · R 리조트 · P 펜션 · K 한옥·게하 · C 캠핑·글램핑
// 음식: S 해산물 · M 고기 · K 향토·한식 · T 시장 · C 카페·디저트 · N 면·분식 · L 현지 음식(해외)
const CHOICES = {
  gangneung:[2,'HRPK',2,'SKTCN'], sokcho:[2,'HRP',2,'STN'], yangyang:[1,'RPC',1,'SC'], chuncheon:[1,'HPC',1,'MN'],
  pyeongchang:[1,'RPC',1,'MK'], jeongseon:[1,'RP',1,'KTN'], samcheok:[1,'RPC',1,'S'], donghae:[1,'HP',1,'ST'],
  hongcheon:[1,'RPC',1,'M'], inje:[0,'PC',0,'K'], cheorwon:[0,'PC',0,'K'], gapyeong:[2,'RPC',1,'MC'],
  yangpyeong:[1,'PC',1,'CK'], ganghwa:[1,'PCK',1,'SKT'], yeongjong:[2,'HRP',1,'SN'], suwon:[2,'H',2,'MTC'],
  paju:[1,'HPC',1,'CK'], pocheon:[1,'RPC',1,'MK'], daebudo:[1,'PC',1,'SN'], danyang:[1,'RPC',1,'K'],
  jecheon:[1,'RP',1,'KT'], chungju:[1,'RH',1,'K'], gongju:[1,'HK',1,'K'], buyeo:[1,'RK',1,'K'],
  taean:[1,'PRC',1,'S'], boryeong:[1,'HRP',1,'S'], asan:[1,'H',1,'K'], cheongju:[1,'H',1,'MK'],
  jeonju:[2,'HK',2,'KTCN'], gunsan:[1,'HK',1,'NCS'], yeosu:[2,'HRP',2,'ST'], suncheon:[1,'HK',1,'KT'],
  damyang:[1,'PK',1,'MK'], mokpo:[1,'H',2,'STK'], namwon:[0,'HK',1,'K'], gwangju:[2,'H',2,'MKT'],
  boseong:[0,'PK',0,'SK'], haenam:[0,'PK',1,'KS'], gochang:[0,'PC',1,'SK'], gyeongju:[2,'HRK',2,'KCN'],
  andong:[1,'HK',1,'KM'], busan_haeundae:[2,'HR',2,'SMTC'], busan_old:[2,'H',2,'STNK'], tongyeong:[1,'HRP',2,'ST'],
  geoje:[1,'RP',1,'S'], namhae:[1,'PRK',1,'S'], jinju:[1,'H',1,'KN'], pohang:[1,'HP',2,'ST'],
  yeongdeok:[0,'P',1,'S'], uljin:[0,'RP',1,'S'], daegu:[2,'H',2,'MTN'], ulsan:[1,'H',1,'MS'],
  mungyeong:[0,'PK',1,'MK'], hadong:[0,'PK',1,'SK'], changwon:[1,'H',1,'S'], ulleung:[0,'HP',1,'SK'],
  jeju_city:[2,'HRPK',2,'SMTCN'], seogwipo:[2,'HRP',2,'SMTC'], jeju_east:[2,'PRKC',2,'SC'], yeongwol:[0,'PC',0,'K'],
  everland:[1,'HR',1,'N'], caribbean:[1,'HR',1,'N'], lotteworld:[2,'H',2,'NC'], seoulland:[1,'H',1,'N'],
  legoland:[1,'HP',1,'MN'], lotte_busan:[1,'HR',1,'S'], gyeongjuworld:[1,'HR',1,'K'], eworld:[1,'H',1,'M'],
  folkvillage:[1,'H',1,'K'], gm_cave:[1,'H',1,'N'], aqua_ilsan:[1,'H',1,'N'], cimer:[2,'HR',1,'C'],
  tokyo:[2,'HK',2,'LNCM'], osaka:[2,'HK',2,'LNTM'], kyoto:[2,'HK',2,'LC'], fukuoka:[2,'H',2,'LNT'],
  sapporo:[2,'H',2,'LSN'], okinawa:[2,'RH',1,'LS'], taipei:[2,'H',2,'LNTC'], hongkong:[1,'H',2,'LNS'],
  danang:[2,'RH',2,'LST'], nhatrang:[2,'RH',1,'LS'], bangkok:[2,'H',2,'LTNC'], chiangmai:[2,'HKR',2,'LCT'],
  phuket:[2,'RH',1,'LS'], cebu:[1,'R',1,'LS'], singapore:[2,'H',2,'LTN'], kotakinabalu:[1,'RH',1,'SLT'],
  bali:[2,'RHK',2,'LC'],
};
function attrsOf(id) {
  const row = ATTRS[id]; if (!row) throw new Error('attrs missing: ' + id);
  const o = {}; ATTR_KEYS.forEach((k, i) => { o[k] = ATTR_BOOL[k] ? !!row[i] : row[i]; });
  const ch = CHOICES[id]; if (!ch) throw new Error('choices missing: ' + id);
  o.stay_variety = ch[0]; o.stay_types = ch[1].split(''); o.food_variety = ch[2]; o.food_kinds = ch[3].split('');
  return o;
}

const AXES_ORDER = ['drive','crowd','food','nature','city','walk','stay','weather','value','activity'];

function monthly(wp, cp) {
  const out = {};
  for (let m = 1; m <= 12; m++) out[String(m)] = { weather: WP[wp][m - 1], crowd: CP[cp][m - 1] };
  return out;
}

function build(row, type) {
  const [id, name, region, tags] = row;
  const vals = row.slice(4, 14);
  const [wp, cp, home, work, cost] = row.slice(14, 19);
  let minNights, longOff, notes;
  if (type === 'overseas') { [minNights, longOff, notes] = row.slice(19, 22); }
  else { notes = row[19]; longOff = false; }
  const scores = { move: moveScore(type, home) };
  AXES_ORDER.forEach((k, i) => { scores[k] = vals[i]; });
  let dayTrip;
  if (type === 'spot') { dayTrip = true; minNights = 0; }
  else if (type === 'domestic') {
    dayTrip = home <= 120;
    minNights = dayTrip ? 0 : (home >= 360 ? 2 : 1);
  } else { dayTrip = false; }
  return {
    id, name, type, region, tags,
    scores,
    monthly: monthly(wp, cp),
    attrs: attrsOf(id),
    travel_time: { work, home },
    min_nights: minNights,
    day_trip_ok: dayTrip,
    long_off_tag: !!longOff,
    cost_level: cost,
    notes: notes + ' (점수·소요시간 초안 추정치)',
    source_date: SOURCE_DATE,
  };
}

const destinations = [
  ...DOMESTIC.map(r => build(r, 'domestic')),
  ...SPOTS.map(r => build(r, 'spot')),
  ...OVERSEAS.map(r => build(r, 'overseas')),
];
const ids = new Set();
for (const d of destinations) { if (ids.has(d.id)) throw new Error('dup ' + d.id); ids.add(d.id); }

const seed = { schema_version: 4, exported_at: new Date().toISOString(), destinations };
const out = path.join(__dirname, '..', 'data', 'seed.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(seed, null, 1) + '\n');
console.log('seed.json:', destinations.length, 'destinations',
  { domestic: DOMESTIC.length, spot: SPOTS.length, overseas: OVERSEAS.length });
