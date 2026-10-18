/* ===== 낱말 풀이 (개별 페이지의 '📝 낱말 풀이' 칸) =====
 *
 * 에피소드 줄거리에 나오는 사람 이름과 고유 명사를 각주로 풀어 준다.
 * 줄거리에서 처음 나오는 자리에 번호를 달고, 에피소드와 관계 사이에 풀이를 모은다
 * (tools/build-pages.mjs). 풀이는 나무위키 각 문서를 바탕으로 아이에게 말하는 말씨로 적었다.
 *
 *   id      그림 파일 이름이자 각주 앵커 — images/glossary/<id>.webp, #note-<id>
 *   term    풀이 칸에 적는 이름
 *   match   줄거리에서 찾을 말들 (없으면 term 하나). 티니핑 이름과 한데 모아 긴 것부터 맞춘다 —
 *           「레나 3인방」이 「레나」보다, 「로열핑 후보생」이 「로열핑」보다 먼저 걸린다
 *   strict  뒤에 조사(은·는·이·가…)나 쉼표가 붙어야만 이름으로 본다.
 *           「준」은 「준비」·「도와준」 속에도 있어서다
 *   not     바로 뒤에 이 말이 오면 이름이 아니다. 「사라」는 「사라지다」 속에도 있다
 *   season  이 기수 페이지에서만 찾는다. 「블랙홀」은 5기 악당이지만, 3기 행운핑 이야기의
 *           블랙홀은 행운과자 때문에 열린 구멍이다
 *   img     원본 그림 (python3 tools/make-glossary-images.py 가 받아 잘라 둔다)
 *   crop    (선택) 그림에서 쓸 정사각형 [왼쪽, 위, 한 변] — 원본 가로·세로에 대한 비율.
 *           없으면 얼굴을 찾아(Apple Vision) 그 둘레를 자르고, 못 찾으면 눈길이 가는 곳이나
 *           가운데를 자른다. 변신 장면처럼 인물이 작게 들어간 캡처는 얼굴을 못 찾아 손으로 적었다
 *
 * 풀이 글에서는 이름을 링크로 걸지 않는다 — 각주 안의 각주가 되어 끝이 나지 않는다.
 * 로미의 변신은 짝 티니핑·주제·주문을 「로미(캐치! 티니핑 시리즈)/프린세스」 문서에서 옮겼다.
 * 줄거리에 나오는 주문(「피리피리 미러크링」)은 그 변신의 풀이로 잇는다.
 */
window.GLOSSARY = [
  /* ── 사람 ── */
  {
    id: "romi", term: "로미", match: ["프린세스 로미", "로미"],
    text: "이모션 왕국의 공주예요. 티니핑들을 지구로 풀어놓는 실수를 하는 바람에, 프린세스로 변신해 티니핑을 캐치하러 하모니 마을에 왔지요. 짝꿍 티니핑은 하츄핑이에요.",
    img: "https://i.namu.wiki/i/9rMKhXPtvUxFWLtuakBcAHuWQqUAkQG5n0exKdy2dMVA8ev1_ITLqpA8CCM7UCrhSfvl6ZPKN0NYqcT-knvH32OVeZ-Z5gOm6TXkcOlewtGu0A3BhL1gcWh5ALPPgKbGU21m-aAZDtam81VQ4jxC0A.webp",
  },
  {
    id: "maya", term: "마야",
    text: "로미의 단짝 친구예요. 메리루와 함께 로미가 공주라는 비밀을 알고 도와주지요. 집은 꽃집이랍니다.",
    img: "https://i.namu.wiki/i/Z4xsbk9PeFX5FWGATvZ51ybYQ9wMQ6HKnZZeM2Kmh6k2N-mb9Qqixp74wzqoZvXrfBOerpfKiKhKfwXFXLSh_BLq5jH6YrpbkCjDZgWh81aJwJ-6vRkP0xxjLAC91fVF5fD4HfSr5vY4HPHoljQhdQ.webp",
  },
  {
    id: "merilu", term: "메리루",
    text: "로미네 반 친구예요. 마야와 함께 로미가 공주라는 비밀을 알고 도와주지요. 루카의 언니랍니다.",
    img: "https://i.namu.wiki/i/h86gbNcGeK14jfsaGeZvZgYphL302tj2r9PdThYcOpVt0X60PP1cQzTiKcEj3EJVvBszHHYi_hvliNgYuO-5k2dOQh1iVyUIymfLpSFFA6FYDQDd4KxQ7qah-lAmESG9ALzpdlaj7tXBkpeHvkbdHw.webp",
  },
  {
    id: "luka", term: "루카",
    text: "메리루의 여동생이에요. 상냥하고 부드러운 성격이랍니다.",
    img: "https://i.namu.wiki/i/Ovn6EJvMVEqpn2ulK8Gq_Hj99oQ8PRi-acHtGGU4JATNe-ZFQFIVpR3ry-DO-B1x2Y7Kd8LeijrdjAOEdM7eDogWLstCMJZlPARF060A-AjLP02A2_ce7ekGNbKegV-eed643BSk8SLMuA8ZQrID7w.webp",
  },
  {
    id: "lena", term: "레나", match: ["레나 3인방", "레나"],
    text: "로미네 반 친구예요. 신디·하니와 셋이 몰려다니며 로미를 골탕 먹이려 하지만, 번번이 자기가 당하고 말지요.",
    img: "https://i.namu.wiki/i/ZfOS8otBLkktDmPl933VXVWSF1Jy7F4q-ywdbdnPz9n63hxpwtXnHiyi6rhB92a_avhiOs9KQdwUEEqJhXBoPxepAfpA2-tPJ7CkC-dJ2a68zDF2GabOgWGklEiZJSZqPg3w0nz9DVYCE7tKRG6AmA.webp",
  },
  {
    id: "cindy", term: "신디",
    text: "레나와 늘 붙어 다니는 친구예요. 겉으로는 사이좋게 지내도 속으로는 레나를 샘낸대요.",
    img: "https://i.namu.wiki/i/aGB4iUK4xnTRW4hYfPeMUafY48q7bPji0u9OVe70GJ811_UVP31r33hBn746VPSjkLFLa8uTWm1QQJKJigQOeNpgvSKLZC1YyZlIJYgyM_H-qhHyWjqJweRLT0TGfdGKsrCHcx6WxXg4r35tOVuf5g.webp",
  },
  {
    id: "dylan", term: "딜런",
    text: "로미네 반 친구로, 머리가 삐죽삐죽한 남자아이예요. 이든과 단짝이랍니다.",
    img: "https://i.namu.wiki/i/ZFkTfwJYCrQMAd-uxqwLZY7ENX7J9h_8AMdHtjEK_s1W49XMhVz5mZ04CT6PTsCzAILk4wdHM_qvFShCUC4raH6aXZos0ZJ0VNoOvgc-PQSHntmYhbegbLfbc9TJPfCx58FAaU9oTdiDWlCXzzdD2A.webp",
  },
  {
    id: "eden", term: "이든",
    text: "로미네 반 친구로, 금발 남자아이예요. 딜런과 단짝이고, 자기 모습을 무척 좋아하지요.",
    img: "https://i.namu.wiki/i/sJliLZHT5vn4Vta7rCQ7IZsKb60n0ImXc48Cdw5uzARmAvvXyIbPkrM_IhSaE46RSAIBKzV7xf-tahaRQC1s6G3mimC3hZM-BMUadtI95g_qA_gocAmSP1O1PzhsNLjVlRWhSzspNyfF1cZ5KlO4XA.webp",
  },
  {
    id: "dua", term: "두아",
    text: "로미네 반 친구예요. 남들 앞에서 노래하기를 무척 겁냈지요.",
    img: "https://i.namu.wiki/i/h9euuhEtkHtcGRa-PzpcHP0FKAxDxZL2mZzhONNPdHZe29lt-hq03dVDNShNgtWc4KWiQa4oO2hwgbILTq7TAkOTK-tdBHww-1k6yzB9Wvkr3kIHO4yREYqqRk3ivvmwB3gD3lc22lMvE353c8CfvQ.webp",
  },
  {
    id: "ellie", term: "엘리",
    text: "로미네 반 반장이에요. 꼼꼼한 성격이고, 집은 치킨집이랍니다.",
    img: "https://i.namu.wiki/i/Hlie9PRQQFufaDJ68dK18bsF1TrBin67Q95KOI0B2D6A0Yc53AZFFykRZ6Dr3BD8OYBugX73uCKALXz2xFym3wg5yChhU-vFaVq81Pvq2F_ENT5sx-p5pXkk46b01JVIFDryDi4BRuwAfIZILR0HsQ.webp",
  },
  {
    id: "raymon", term: "레이먼",
    text: "로미네 반 부반장이에요. 덩치가 크고 느긋한 성격이며, 집은 분식집이랍니다.",
    img: "https://i.namu.wiki/i/zHnPCPQ_UyDhOo-rEjka_dd9Qrer23QF70TSYsQeKEmbwiD5zTGVknqfBGALu8LwcmRlwYbs8qZKGz8tZ84HTBoDxKNw1if83yp_5KDv7nGhbu9o4XgUlSZCZOD6XruASkaavgWX_HYvdPvLk6h8yg.webp",
  },
  {
    id: "nile", term: "나일",
    text: "로미네 반 친구예요. 게임을 무척 좋아하지요.",
    img: "https://i.namu.wiki/i/rp0E8NKwcepT9gLv0--LFZ2jRQmYVoUsmn3xy0IRY8qsXGoFcPLcxlu78dMVN-dnxZsdKiBCzkM8tkzCq7CM6UTuRuCVROSJ2O3Get7DYGs6ns7XV9nXqLVe9tSPIYTODhMI_ghX9VMALTClL2AS2w.webp",
  },
  {
    id: "dane", term: "데인 선생님", match: ["데인 선생님", "데인"],
    text: "로미네 반 담임 선생님이에요.",
    img: "https://i.namu.wiki/i/IB6jhCsDL15fgHikf2kHugypOV3eEDleXq3J-cCMaYNplC9cb8t2xnMNNUsBO00KzvosAnWrTcbFVtDyJldR8uBqwM9Z9QQIpABLwjSsTmmrNznaCkzBqTV7OsGJTNy9Awh9j7MIINeDB5OQufH0-A.webp",
  },
  {
    id: "olivia", term: "올리비아 교장 선생님", match: ["올리비아 교장 선생님", "올리비아 교장", "교장 선생님", "교장선생님"],
    text: "하모니 초등학교의 교장 선생님이에요. 규칙을 아주 깐깐하게 따지지요.",
    img: "https://i.namu.wiki/i/7K-vvW1sHurc5EuVU2NgEzR7Nknpsjl-YOZSy3yuFTowRhzsI_39JnNpTYa5arP4nMhAwNi3IBD9vONRM8bp4rbcPz90NEYS2nvJowSxEbjjGYEaaQYzPoeWfmEJJlmxA9f1AGrhtLOb9LjgiYsh4g.webp",
  },
  {
    id: "sara", term: "사라", not: ["지", "져", "졌", "진", "질"],
    text: "로미의 사촌 언니예요. 이모션 왕국의 왕족이면서, 하모니 마을에서는 하트로즈 베이커리의 사장이랍니다.",
    img: "https://i.namu.wiki/i/ekhgnqwPYCU9rF4rK2BpxZD6w27ijNjbn3XNmwK5ZIfgZZg6G2vZsDi6XLGKItGxz_tTfZlvGDZllu-H7XOXaF9lbHwgVH-lhH-5cRp2Lk-LaCwYSQaRxGe854wbrrDuf-PRIC3rdSNZ3N9sChyOIQ.webp",
  },
  {
    id: "ian", term: "이안",
    text: "하트로즈 베이커리의 파티시에예요. 다정하고 잘생겨서 레나 3인방에게 인기가 많지요. 카일과는 어릴 적부터 친구랍니다.",
    img: "https://i.namu.wiki/i/w1IDBLRYScwlCbhg54aqP_o4KC8_nJZdxld0vPLDr9aJ1kMvPCZ4-WFFcjn_qu6D_5w-zu-dsxFHCZ4E12NolNGOQ6RU8IlI0jg2eQ8PQypROidaEHSAmgG-6BuqvWmTHJIlfNUI0zaOGoTXgjiCmQ.webp",
  },
  {
    id: "kyle", term: "카일",
    text: "하트로즈 베이커리의 파티시에예요. 무뚝뚝해 보여도 꿈을 이루려고 열심히 노력하지요. 이안과는 어릴 적부터 친구랍니다.",
    img: "https://i.namu.wiki/i/xk689D_34w-nb_imijzWUaUr7zHhIs-QSemayELcH4VwceSD0eEK7shHAzqbB-8KQe50sXZo3h_uAIEzSJEFcoxCMWHt_DXoflAFHcXIyPBD1KP7ghCDGPbaynEmtMwBtF-LAZADH33mF0T9dSuJ_A.webp",
  },
  {
    id: "jun", term: "준", strict: true,
    text: "하트로즈 베이커리의 막내 직원이에요. 늘 씩씩하고 활기차지요.",
    img: "https://i.namu.wiki/i/FkzgXQZQEkdeVhkpnF4MUiBfjlYsEDnHaOb1WUvNGoAHZqxcTiG5qr-HPSrmun8IsGkO0eojjkSqxcy6KGP9bXf47p4xe0d0QHsQfnOiSSG8ikaeNTGORl--7zP7M7eDNITy9kVoFhbCDUy0T7y8HA.webp",
  },
  {
    id: "heyju", term: "헤이쥬",
    text: "인기 많은 아이돌 가수예요. 따라핑이 열렬한 팬이지요.",
    img: "https://i.namu.wiki/i/5cQ-Pj2rWYsPGr9KWjs0DFepwXVavaA9R0Y6baopFTrRwrQogN0KvN9mFbgZ50loBZiDtGWmNYWBn70BjfQgOxTTVOUeNGALizT57xx5If0CdimYQoJM8cXZOxRzsZ08-YjsPnytISrM2bzMZHPGHQ.webp",
  },
  {
    id: "charles-joseph", term: "찰스와 조셉", match: ["찰스와 조셉", "찰스", "조셉"],
    text: "보석을 노리는 도둑 2인조예요. 나올 때마다 티니핑의 마법에 걸려 혼쭐이 나지요.",
    img: "https://i.namu.wiki/i/FPWr22qNqmSPSOusiYpwoL95kqPmbV8dnI5YEMiMMCeJp_GyStWM5lu6UssdO8TGYTfGsbgabS6EBLJP18BNKzTFtcubDdYV2eXKsUgVTqjttfOwVWKRkw1QZHp_lizuRbCFJTw51waKSDX-yvoXPQ.webp",
  },
  {
    id: "heartking", term: "하트킹",
    text: "이모션 왕국의 왕이자 로미의 아빠예요.",
    img: "https://i.namu.wiki/i/cfFziT18R2yW2PpELYufwlKGAr86e7ALrhgs9DD3P5taeulnKE4JnM6sZSM7BF3rUtv64qqXkvpnvIKkVFRC_hGlNlP7XVhZ56Cb7sRJzT-tnBXKycmss_xyfyCd64-niKkcwst4Gg0I5ThEyL3wBA.webp",
  },
  {
    id: "stella", term: "퀸 스텔라",
    text: "이모션 왕국의 전 여왕이자 로미의 할머니예요. 다정하고 씩씩하지요.",
    img: "https://i.namu.wiki/i/ZZL3hlvkNjcRWn-ss31m5Ee6oc9KOHamIvlULSzQQGFlptEscbZrMPKpcWrzzW4d9hNmGAUF0DBLNeki3ophTLy9IYl9fOpMeYM6zvOg3VlcZqTa3f6Q6CEI9TpldLq7UaAiNhjT23C1rDcgOz2Jpw.webp",
  },
  {
    id: "monju", term: "몬쥬 박사",
    text: "고양이 모습을 한 이모션 왕국의 마법사예요. 왕립 티니핑 스쿨의 교장으로, 로미에게 마법 도구나 티니핑들이 지낼 집을 보내 주지요.",
    img: "https://i.namu.wiki/i/F9Dfdcdh4BHCaRqYgcXD5PaCg3YXsKHOwgPvOoOpAWa8voeMzTncRKC5qRJid5ik8XDkp9ieeAzaDgz9Hb-QFTFxBd1Cyix9n4xkG84XqdRVuZR9m5S-5ws8sSns2YsPWn3a_eN7WIZ9JdmgypL_FQ.webp",
  },
  {
    id: "jenny", term: "제니",
    text: "로미와 동갑인 사촌이에요. 3기에서 마스터키를 빼앗아 로미와 맞섰지만, 나중에 잘못을 깨닫고 화해했지요. 짝꿍 티니핑은 다해핑이에요.",
    img: "https://i.namu.wiki/i/fc1sXtlUZ8ZkZ1zwu5ElV35mi9naRsTu5mTbZciMHCwJjIINhZOlRqjDB_sZzJS8CRbjjRkmdLb5yudFcfSI0bdGDue5iJ0zmybt3zjxt6ZTZvjYlRWD8_zg29dnMo73IZQVf1LaOOZJadReB7yr5Q.webp",
  },
  {
    id: "noah", term: "노아",
    text: "5기에 로미네 반으로 전학 온 남자아이예요. 우주별 마을 왕족의 후손이고, 짝꿍 티니핑은 왕자핑이랍니다.",
    img: "https://i.namu.wiki/i/ygfEmIYnpf3U8Pfpykqemlmz_Y7bR0cOOrUS8SzINUlbt0KWzLgM7Kd3bx7fzDwDJ_YQZTnoh9U6nfL2NR0EXJAMWAjAwO4WEXQdYqonKZdPgvA9b_2ZboW9Nl0HJmKfbcGlRFyh3gVB3sk8VEm0jA.webp",
  },
  {
    id: "blackhole", term: "블랙홀", season: ["star"],
    text: "우주별 마을을 덮쳐 스타티니핑들을 지구로 흩어 놓은 5기의 악당이에요.",
    img: "https://i.namu.wiki/i/zEmwk5MxKLGS5FOpPFLSW90oj9nbJEluEZiasf3pziR7ZoqXzia19Ut06KIvJwJxwn0lvneknWZ-AAgr2OYYUk16flsU5OQw9yhmLmtyyUl_s_U8d-QYNNpuuiHQ0nzGi6P15U6rU9R8Oy9AJKTmXQ.webp",
  },
  {
    id: "miroir", term: "미루아르",
    text: "6기 뒤에 숨어 있던 진짜 악당이에요. 이클립스핑의 마음을 어둠으로 물들여 다이아나핑 자매 사이를 갈라놓았지요.",
    img: "https://i.namu.wiki/i/ljVZnysQtSEtCFsQq56tpefqpsosj-Ut6797utyAu3FL3N4TMiRV8HBH_WQtHIWSt7Ix_hFENMN8tL8cHiJnJoKOR470_8ZNemc_Z9pDsW8R2egWRmculdgvaDwId_PcSG72WsbE_vpq3WxPG8SHcQ.webp",
  },
  {
    id: "liam", term: "리암", match: ["리암 왕자", "리암"],
    text: "극장판 「사랑의 하츄핑」에 나오는 라미엔느 왕국의 왕자예요. 짝꿍 티니핑은 트러핑이지요.",
    img: "https://i.namu.wiki/i/5r0e__fMwJVK2qVA4lDN2H0y6nNCqHQzYimEF9CoxFgq9Ht3A199xun6JlUFcPTB03qbqX_xyxovfn4oJBLEfYlO5pe0ZWa9cYouCcNwmtRV5sS3-rv9JkVpYIFvlmB_dU52iWXfMDKyNo68XxAK4A.webp",
  },
  {
    id: "kite", term: "카이트",
    text: "극장판 「사랑의 하츄핑: 고래보석의 전설」에 나오는 바다 소년이에요. 레비어스 때문에 고향 마을을 잃었지요.",
    img: "https://i.namu.wiki/i/MYBatwt3E_dYIAT2PFzypnpNw9xDm0_usFX-XARwMLU9KuYHngLeEsTz4vQUxyLZU3dsVwjS_b4zRDcHRlU80eQPbgTyfPLj7YosMRYvRgJBSZGlM2Vvzz5TzW1Wsk7035HoKt3n2x1oIYOkz5nhZg.webp",
  },
  {
    id: "levias", term: "레비어스",
    text: "극장판 「사랑의 하츄핑: 고래보석의 전설」의 악당이에요. 세상을 손에 넣으려는, 거대한 푸른 용 모습의 바닷속 괴물이지요.",
    img: "https://i.namu.wiki/i/t3Xp0cQEZQSCOTV-n3T2tl3unZf1WJ3Wj84N5NUavZmod3MYjsb3ZwQWG8HLM4ON-u1qCuLZOclmXfk0DVAbQWhJF7KnYZRVih9Ttl4q9wMxgARD7tNkefOIsak4YeK5SYsykwrUS7hZcajwzCxqjA.webp",
  },
  /* ── 장소 ── */
  {
    id: "emotion-kingdom", term: "이모션 왕국",
    text: "로미가 태어난 마법 왕국이에요. 온 세상 아이들의 상상과 꿈이 모여 생긴 곳으로, 티니핑들도 이 왕국과 함께 태어났대요.",
    img: "https://i.namu.wiki/i/HqCsfnPhBZX2cKKxNKSKQgc1r8HGwaQz7OJ_ddRmvn1FG8oL1nKQIPBKCgu-8GNffXLSCP4LJOEEIk15KEkt1ehgOq1S71Idr9H3V_Ud5exzeN4pLBH4XZa-KlaqjSaB3NBQCX3hZgOT34NOWdHnwA.webp",
  },
  {
    id: "harmony-town", term: "하모니 마을",
    text: "로미가 지내는 지구의 마을이에요. 지구로 넘어온 티니핑들이 마을 곳곳에서 소동을 일으키지요.",
    img: "https://i.namu.wiki/i/DcNG4Uf8krlJYr1zJBYBbEIBdnvixcbRX5JXST0a0ObJ7-8H8mElRrhkMmGCGWeZ3Re-ZpfeSmeVJlgLowJNS4qxT8KkQQ1Bax-Nb7sO_cWSfS0cMSUsFMB33iMFvCx8wunM8-qcaF6MXmoDX1Vq2g.webp",
  },
  {
    id: "heartrose", term: "하트로즈 베이커리", match: ["하트로즈 베이커리", "하트로즈"],
    text: "로미가 사는 빵집이에요. 사라가 사장이고, 진열대에는 캐치한 티니핑들이 지내는 집이 놓여 있지요.",
    img: "https://i.namu.wiki/i/7xdsSC_vjPusi3XyU87PI68Se38TQjBxUUoDCoubpKvg4ZzzYj06aSEwdDTrf7doAfoRPQF49w0HID5p7GMfj5W9-1g0Z0-rMlPr7PHK5zVZZRw9lp4GthCoFW7DEVXNuKwPZQjhWoATbUBdnk3IRQ.webp",
  },
  {
    id: "harmony-school", term: "하모니 초등학교",
    text: "로미와 친구들이 다니는 초등학교예요.",
    img: "https://i.namu.wiki/i/mK4FA_t07Z1u1E167adTlnLqy2G-gFCnsVvs6yx9XXXVKQqFafDuAMLf2a6qyJ94O2CwofLTywLM36_CQNWzBpGM3eiqBC6bohGMVZBjGRpmBdqNuiqpT-HQxbtLkOXRHgyAwrpQoJDC0BaZBcEQkg.webp",
  },
  {
    id: "teenieping-school", term: "티니핑 스쿨", match: ["왕립 티니핑 스쿨", "티니핑 스쿨"],
    text: "이모션 왕국에서 티니핑들이 다니는 학교예요. 교장 선생님은 몬쥬 박사랍니다.",
    img: "https://i.namu.wiki/i/JJrt7DnmS0_xyOrmLFb4Al7j7e8mdNgcFf9u0L6zsAf8uoNRYSa6hHszN9wPGN12DlD8nwdesIc7si9VZbo-pOIiO7e1-dUpqGFZ0jMdSEO93pNIfH5YLoqF_vehTjqmm6O4nyIfgskUgzxXTZWGdw.webp",
  },
  {
    id: "jewel-forest", term: "보석숲",
    text: "이모션 왕국에 있는 숲으로, 보석티니핑들이 살아요. 2기의 무대랍니다.",
  },
  {
    id: "mystic-town", term: "미스틱마을", match: ["미스틱마을", "미스틱 마을"],
    text: "이모션 왕국에 있는 마을로, 열쇠티니핑들이 살아요. 행운핑이 마스터키로 마을을 지키지요. 3기의 무대랍니다.",
    img: "https://i.namu.wiki/i/lOaHQTZOxQ0629GnEM1kfds3lUCrS7_SxgeHo5poWqWUtuqUlRMY8grWW4EfAl99rdrSSfv0XWohGEvlTD2H2qZE99jSNI_zD5ClP-Y3PHSepXLP7OohuvzZUW-4PbVEv28wsjcX2UVDrzP6rBl6FQ.webp",
  },
  {
    id: "dessert-town", term: "디저트 마을",
    text: "이모션 왕국에 있는 마을로, 디저트티니핑들이 살아요. 매직슈가볼이 마을을 지켜 주지요. 4기의 무대랍니다.",
    img: "https://i.namu.wiki/i/EY9ak_GQcNP_KmAplD9NLK_oaHWD4rBNC3Phw18u7Z7uNYlL4Cvuf74HClhiGxW1exqeqpNLbPQrQuuhVljUdcGDoYWT87PBL6lt4ZlUVkpgqzyT6OUEMMOUCIk-TyaGdy7FNBOjF4d0iXkMPkr10A.webp",
  },
  {
    id: "star-town", term: "우주별 마을",
    text: "마법 우주에 있는 스타티니핑들의 고향이에요. 한가운데 셀레스티얼을 여러 별이 고리처럼 둘러싸고 있지요. 5기의 무대랍니다.",
    img: "https://i.namu.wiki/i/ci_T59XYxNLXQSPzxVGbyIVJe3dbEiTk843RBGfli-bqbxKJF5HNP6-6OBE6KnaIEVGuhnM_BSYcckYBO45ti_SzIGzN7yTr_QRhR0tXaSfFviBWY_63oRJVA5vkDZfwoqcKHywGWex-X9A4A_5u9w.webp",
  },
  {
    id: "celestial", term: "셀레스티얼",
    text: "우주별 마을의 한가운데예요. 오로라핑이 사는 셀레스티얼 캐슬이 있지요.",
    img: "https://i.namu.wiki/i/xdJlMGMWKeVEA8YRqTH33oBmEnX03DQGGx0V0LG0HrZC2U7ChjJUumnuOLtrWoqYq7rMhemE_jssUJnuK_R9GGBFTFPibTu_m2z5Qgd083Jv9-EnOolvqrnzQi2jHmas_Rb7Jyt4uIIYhY-w_-q4nA.webp",
  },
  {
    id: "star-station", term: "우주별 정거장",
    text: "스타티니핑들이 지내는 집이에요. 몬쥬 박사가 선물해 주었지요.",
    img: "https://i.namu.wiki/i/Dj-slkEg6IqWzZTXkRuj4iBeQ_E1QAv5KqqcHl5hBdD-jyHYRTStglaIhYjrPHTQcFuDQTf0dall-tMZoiKh42q4TTKjxcDteQn5rPDq_bOpkoM5I0SDN5ie-wvDPHUok22PeoqWIzbLRM_W1wBs6Q.webp",
  },
  {
    id: "teenieping-house", term: "티니핑 하우스",
    text: "1기에서 캐치된 티니핑들이 지내는 3층짜리 집이에요. 몬쥬 박사가 보내 주었지요.",
    img: "https://i.namu.wiki/i/eDhRNAvU_bqd43NCPPSed5lT6QoXWgnQvG_SYk8A5gnnSTc0Id3cEtuTST8QpbFHlz_mPisqiiJHz-OaVyjSLmBJXbqOxKKaXlMnNyJ8F6Ovb_88pzH2vfZCAdnStljoek5eKArTcDm077d6jmvYKA.webp",
  },
  {
    id: "princess-summit", term: "프린세스 회담",
    text: "여러 나라의 프린세스티니핑들이 모이는 회의예요. 의장은 다이아나핑이지요.",
  },
  /* ── 마법 도구와 물건 ── */
  {
    id: "tiny-heartwing", term: "티니하트윙",
    text: "로미가 1기에서 쓰는 마법 도구예요. 프린세스로 변신하고, 숨은 티니핑을 찾아 캐치할 때 쓰지요.",
  },
  {
    id: "heartwing-stick", term: "하트윙스틱",
    text: "1기 프린세스가 들고 다니는 요술봉이에요. 변신한 모습에 따라 색이 바뀐답니다.",
    img: "https://i.namu.wiki/i/dapi_kvRN0MDsM99fR2DnZJth-l64u9VCswufZZyUsObwJtM2qjPCV_CLkVcARBe2uvXdMwbwaJTc3A5E8pms6e_gSzfDa4-S9hNxPoUYpZmX1-yZjN37IzFYFd7YuK9yCY6ZjF61fDrTfySSc81wg.webp",
  },
  {
    id: "tiny-heart-shield", term: "티니하트실드",
    text: "티니핑의 팅클퍼프를 막아 내는 마법 도구예요. 몬쥬 박사가 보내 주었지요.",
    img: "https://i.namu.wiki/i/KLAzRPZPyZTflHmQz3zg2dZc9eFxjSidEQOmudxU7zU1ux-1Bg3fA3FcWiKOMBGToOCB6Z5AGH9g8n7MhU7KCuxHSgqdw2RpgIuNXIKR2CsnhZbO3YcGiJJZeSBz8zB0K1oYgku6WHkeQ3P1ogNe1Q.webp",
  },
  {
    id: "master-key", term: "마스터키",
    text: "미스틱마을을 다스리는 열쇠예요. 행운핑이 지키던 것을 제니가 빼앗는 바람에 열쇠티니핑들이 지구로 흩어졌지요.",
    img: "https://i.namu.wiki/i/rfE88jhKQW5Tyea7tVxfpIZh5apucNf0FhGWfVp2x3Ft5YKvIUQ-TFiJyisiMkeJUpnrxP85c0x18CtaIswDAQkhh2waWkD9f7Kw__WBoNEfj9CXJ5sg3Lo2WWmpHQNIDdQo4DZ75e14SvZhVY0dIQ.webp",
  },
  {
    id: "mystic-bow", term: "미스틱 하트윙 보우",
    text: "로미가 3기에서 쓰는 마법 도구 미스틱 하트윙을 활로 바꾼 모습이에요. 물건으로 변신해 숨은 열쇠티니핑을 맞혀 정체를 드러내게 하지요.",
    img: "https://i.namu.wiki/i/_6ee0fkt_8r3_tttBzMCsAdcbEtrvVTXazf914GM15M-BPoYo2Mv9NYNokK3Q6Sf32-fb-HyYAfLgoieJf49L9lpcCYACtbtPIFvMB0lM3e7uVQFvjwkugYte6whoL_9YBjTghwRhSfzHvUynldfTw.webp",
  },
  {
    id: "sugarberry-pact", term: "슈가베리팩트",
    text: "로미가 4기에서 쓰는 마법 도구예요. 디저트 마을에 보관되어 있던 것으로, 프린세스로 변신하고 디저트티니핑을 캐치할 때 쓰지요.",
    img: "https://i.namu.wiki/i/aQ9JJwFtNgv1m6T5Dzdgve-rgxLAjsgfzwhAPLFAIUTPd-dKjpi4DD15AsjqdlSzyzesWB1zc6OqEiBUs2YZKjGhCKkdVuflVsAl8fM19XYX9E1QIasHwdnqitHAfR8J2d7SNEnW2_aF7NyhX5l2RQ.webp",
  },
  {
    id: "magic-sugarball", term: "매직슈가볼",
    text: "디저트 마을의 케이크 궁전 꼭대기에 있던 마법 구슬이에요. 그 힘이 마을을 지켜 주었는데, 뿌뿌핑이 빼앗아 가는 바람에 디저트티니핑들이 지구로 떨어졌지요.",
    img: "https://i.namu.wiki/i/FB6wGoCx9XKRkDKRwpQlswK-3tKIb88B8eZLje-KDQK97mfPIvTx9mtu5sdGsg-PxdsEcUQizUYV6v1VMl6cqRvi5VHLIuwqrgKkoTnogmKmbP4zY638aIsk9Rrd8wWOsNtCzyHNykSohKE58C6XFw.webp",
  },
  {
    id: "sugar-prism-shot", term: "슈가 프리즘 샷",
    text: "슈가베리팩트를 광선총처럼 바꾼 모습이에요. 디저트티니핑이 친 슈가실드를 녹일 수 있지요.",
    img: "https://i.namu.wiki/i/nmZEqcmtZ84zQ3l2_zB6XyHzBWlAWHhOfpG1yGhJCavuACbltEYIAoRVkBc34BmxHX9Bqa2tZbyyCrmz0ju2eJejspIXCn7FXSgv9ufZctdCLLwuUA5R79AW5i5b6rPScVNqoJp3e-b-NTGQYxbg2Q.webp",
  },
  {
    id: "sugar-shield", term: "슈가실드",
    text: "디저트티니핑이 몸을 지키려고 펼치는 보호막이에요. 슈가 프리즘 샷을 맞으면 녹아 버린답니다.",
  },
  {
    id: "shooting-star-pact", term: "슈팅스타팩트",
    text: "로미가 5기에서 쓰는 마법 도구예요. 우주별 마을에 봉인되어 있던 것을 로미가 암호를 풀어 꺼냈지요.",
    img: "https://i.namu.wiki/i/_3g49JD5zGrFwPEm_aIlPKEOodUOutTXgYml-qk4BRuc8KjLiu6t25_MonfVYsVGiTZLHGTW8O-W0xJ3b0D-9D4dTgT4-c7SWuPVxrBygnPCJPJuw4VGBwkPZR_oHOz-AJaYnrLAIJ8NUoH6cxe5VA.webp",
  },
  {
    id: "star-heart-beam", term: "스타하트빔",
    text: "5기 프린세스의 요술봉이에요. 빛을 쏘아 투명해져 숨은 스타티니핑을 찾아내지요.",
    img: "https://i.namu.wiki/i/OPHL0RqwBqnWJqh-QZeeSaJWysfdkMkUa7dKwK8OAC6rmOp3nwHSGbriyIqgKpE8dZDYKdO_8WxzVCjVqOZn0IVfAbC4a6xjsMNH6kI5LL1uk2-V6K0VSdJVYAmhwuDW2sF1--76Mc8R211LOmTYxw.webp",
  },
  {
    id: "princess-pact", term: "프린세스팩트",
    text: "로미가 6기에서 쓰는 마법 도구예요. 몬쥬 박사가 만일을 위해 준비해 둔 것으로, 프린세스로 변신하고 프린세스티니핑을 캐치할 때 쓰지요.",
    img: "https://i.namu.wiki/i/shZANgchGbrphdXRZcg6QYsdfwknCN-yVxYLF5AgwmTxz3pLSGuq_GU_U0xxohltvyjTtO-twWKow-44diOPzUQ3yGRFXTPbowMNWw8je5ACew3cJj7ATi-6_47pSYbMEBfws9kl10sblyowVGrYRA.webp",
  },
  {
    id: "magic-mirror", term: "프린세스 매직미러", match: ["프린세스 매직미러", "매직미러"],
    text: "다이아나핑이 아끼던 마법 손거울이에요. 저주에 걸린 다이아나핑이 이 거울 속에 갇혀 있었지요.",
    img: "https://i.namu.wiki/i/vUtURO1v6mAj_TKjg-z3aqU0r-g5mLpciuZKspViq8t-q_0xKr1M_3zfIIAyD_ev3S1sPtGtGACMMEbv4BECgQjIlOP8SqLmdrd2itvNlt98NZJZSiWYD7W2_gYD1RO4t6AeqmOta4qPGXh28YRLlQ.webp",
    crop: [0.15, 0.53, 0.3],
  },
  {
    id: "cube", term: "큐브", match: ["스타 큐브", "큐브"],
    text: "캐치된 티니핑이 들어가 지내는 작은 마법 공간이에요. 기수마다 모양이 다르고, 5기의 스타 큐브는 타고 다닐 수도 있지요.",
    img: "https://i.namu.wiki/i/m6qAaw1X1yMvwDfWrHHRuUy-63VOwTCZOqTO7YnulNJ-kMJtQ3Yfw_3TjLYLlZ731ibh9gDVZOKdDG2-R3cT4d0wvgljYReQt0qFd1fWSJxwoVbmeTlDD9SfDJLXkKpMdeq5mcjBvfqTzmH_O3nR2A.webp",
    crop: [0.29, 0.12, 0.42],
  },
  {
    id: "medal", term: "티니핑 메달", match: ["하트 메달", "스타 메달", "티니핑 메달"],
    text: "티니핑을 캐치하면 생기는 메달이에요. 앞면에 그 티니핑의 얼굴이 새겨지지요.",
  },
  {
    id: "twinkle-puff", term: "팅클퍼프",
    text: "티니핑이 마법을 부릴 때 뿌리는 반짝이는 가루예요. 사람들은 땅에 떨어진 팅클퍼프를 보지 못한대요.",
  },
  {
    id: "manna-fruit", term: "맛나과일", match: ["맛나과일", "맛나꽃"],
    text: "먹으면 마음이 나쁘게 물드는 독이 든 과일이에요. 해핑이 이 과일 때문에 악동핑이 되었고, 맛나꽃의 꽃가루는 다툼을 일으키지요.",
  },
  /* ── 티니핑 무리 ── */
  {
    id: "royal", term: "로열핑", match: ["로열핑 후보생", "보석 로열핑", "로열 티니핑", "로열핑"],
    text: "로미와 함께 프린세스로 변신해 캐치를 돕는 특별한 티니핑이에요. 2기에서는 조아핑·방글핑·믿어핑이 후보생으로 지내다 티니핑 스쿨을 졸업하며 정식 로열핑이 되었지요.",
  },
  {
    id: "legend", term: "레전드 티니핑", match: ["레전드 티니핑", "레전드핑"],
    text: "로열핑보다 더 강한 마법을 지닌 전설의 티니핑이에요.",
  },
  {
    id: "normal", term: "일반핑", match: ["일반 티니핑", "일반핑"],
    text: "로열핑도 레전드 티니핑도 아닌 보통 티니핑이에요.",
  },
  {
    id: "jewel-pings", term: "보석티니핑", match: ["보석티니핑", "보석핑"],
    text: "보석숲에 사는 2기 티니핑들이에요.",
  },
  {
    id: "key-pings", term: "열쇠티니핑", match: ["열쇠티니핑", "열쇠핑"],
    text: "미스틱마을에 사는 3기 티니핑들이에요. 열쇠로 주변 물건으로 변신해 숨을 수 있지요.",
  },
  {
    id: "dessert-pings", term: "디저트티니핑", match: ["디저트티니핑", "디저트핑"],
    text: "디저트 마을에 사는 4기 티니핑들이에요.",
  },
  {
    id: "star-pings", term: "스타티니핑",
    text: "별에서 태어난, 우주별 마을의 5기 티니핑들이에요. 투명해져 숨을 수 있지요.",
  },
  {
    id: "princess-pings", term: "프린세스티니핑", match: ["프린세스티니핑", "프린세스핑"],
    text: "여러 나라의 공주인 6기 티니핑들이에요.",
  },
  {
    id: "prince-pings", term: "프린스티니핑",
    text: "여러 나라의 왕자인 6기 티니핑들이에요. 샤를핑·트롯핑·깨굴핑은 함께 노래하는 그룹이기도 하지요.",
  },
  /* ── 로미의 변신 ── */
  {
    id: "p-heart", term: "프린세스 하트", match: ["프린세스 하트", "피리피리 미러크링"],
    text: "로미가 하츄핑의 힘을 빌려 변신한 사랑의 프린세스예요. 「피리피리 미러크링!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/xTaBB4FHjGwhKx2Wm_Y-yVBA9f1aM2uHVr4Wrm0nXj8LxLskne4GlL_j74riqMSR-HTKJkdVVFA_yOpLFai5RR88grdjPf6UiXS-x-Ge0j6Uafd0IKkbPMr7fvI0KA0A5BbkoKLvf9mtuE8OpikTPg.webp",
  },
  {
    id: "p-claudia", term: "프린세스 클라우디아", match: ["프린세스 클라우디아", "피리피리 리디크링"],
    text: "로미가 바로핑의 힘을 빌려 변신한 성실의 프린세스예요. 「피리피리 리디크링!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/DYF8CYDvopkTkvY5pkNwkCdYA5V_yqXUIdRu7IZylOW6bqLyywR4ivchlmrvnrpe3FVVZPwgMbmO4FZGkXN-o71VSbGgDXl5QH0U2wJcv844YtMHziRtNzsMTxPh3bl_ed8KM05ZfRJ-cSBeUiKCUw.webp",
  },
  {
    id: "p-clover", term: "프린세스 클로버",
    text: "로미가 차차핑의 힘을 빌려 변신한 희망의 프린세스예요. 「피리피리 레니크링!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/a7fe7RS20qMtEyU3UguELQQOUFstW_tFpx2Wrui1BWbT_yzs91FYQUXWLjjdOcL2uqQ83kPpoFmd5f5O7I02-ZLiDYjZJS9ZEzJV3HozOMDSOo3rIUIgesgb2sbKCZ7O7Y2-YDQQYRurnmyv064EDQ.webp",
    crop: [0.4, 0.05, 0.2],
  },
  {
    id: "p-star", term: "프린세스 스타", match: ["프린세스 스타", "피리피리 버즈크링"],
    text: "로미가 아자핑의 힘을 빌려 변신한 용기의 프린세스예요. 「피리피리 버즈크링!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/7caff9O9z5G43dRPR8oQXRGxwfJTF5UVkybZyKUdUoRKbWDh758Kmr2qvswjyNBnDf0m65gWPWaP5didfhEhrIF96GchSXCeKdzwOv8_7P1bS3zk1hx-ETfy-FBoJcmEd2zT2dbU4PN8sPEvEgMsNw.webp",
    crop: [0.4, 0.06, 0.2],
  },
  {
    id: "p-melody", term: "프린세스 멜로디",
    text: "로미가 라라핑의 힘을 빌려 변신한 즐거움의 프린세스예요. 「피리피리 뮤직크링!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/gJ3IdWBAftRJX6qBM2BVQ4JR7MZA7smQDaLydAp7xwyiPnPUlhGBPuw4BNiGIVNT6qO77b2KvaaWivKscXOlm-UAHCwyahbjKyH1Ca1AqH93KAeLQsF7YxhM1Vus1eS8AYYPLgfAjy4HjFBCAhCWcw.webp",
    crop: [0.47, 0.04, 0.2],
  },
  {
    id: "p-sunshine", term: "프린세스 선샤인",
    text: "로미가 해핑의 힘을 빌려 변신한 행복의 프린세스예요. 「피리피리 버브크링!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/T60VJDEt2hPWGHieo3vVVGKutMeG-hpod8jhbMp4rlN5BQOvyDjQD-1x2PvZrj2tqPcITHgOQFMI2lBwBCVKSXSBMOnGw_9ppA9SWppRZWZg0bn4pd4VJyWe36IpTHysWF_AtC9yIC2XfDTWE4S2cA.webp",
    crop: [0.4, 0.09, 0.2],
  },
  {
    id: "p-veronica", term: "프린세스 베로니카", match: ["프린세스 베로니카", "피리피리 레인보우"],
    text: "로미가 1기 로열핑 모두의 힘을 모아 변신한 프린세스예요. 「피리피리 레인보우!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/VO64hJtE9sGoKJCi1US8XRCtRT2o_6ZxsBdw-_liuAZzeUBsvxKfttNJ72v_l_FPveaXSkvuq86h0MD77VfB0tUMiTs6Lo2STD0lm9_iaI8a-yApLeVrV_rXs9-BZ0q-SJ8wE8DO1lA5Kuf1njqD2Q.webp",
  },
  {
    id: "p-diaheart", term: "프린세스 다이아하트",
    text: "로미가 다이아 하츄핑의 힘을 빌려 변신한 사랑의 프린세스예요. 「피리피리 매지컬 다이아!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/m9X3GIAOH1fm29LYZasABliSdt7VuLbVOBzA5rO0PsIDtKAQUZ2u1dxgh9wsQVj5F-_v7ReO0kPEmJlX48Lzr_MzP0claZ-smN14AbexwwNyRv1uqyd7unPk0oT1zjVqSWcRjJmEo3tGZ_83sU7okA.webp",
  },
  {
    id: "p-ruby", term: "프린세스 루비",
    text: "로미가 방글핑의 힘을 빌려 변신한 웃음의 프린세스예요. 「피리피리 매지컬 루비!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/Ae0aap6i7cl1Uir8u5TT4ddwOt0gCpwX_nwQlSOKTFKrLf0w_0qsZNn0P5q6MliAwB086Kmo__7akHDMAqrNOQu4g23FJBtpOnj5cO4sRNYBa0V9cG9ANBheIrEwIER2GPREkVWKi1e_3RjDF8Y2qg.webp",
    crop: [0.38, 0.13, 0.24],
  },
  {
    id: "p-sapphire", term: "프린세스 사파이어",
    text: "로미가 믿어핑의 힘을 빌려 변신한 믿음의 프린세스예요. 「피리피리 매지컬 사파이어!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/X2uIJSztZNhdyYrlRWOHNoEFt8L7AIvvNL8Sy8oe89oYAqxLXt-aVpCvVdtrn7U_zoTHS5kVPnrx41op5iV05QAwbH4g3Ps3it_6AqT0AzbMOCxqm30rOLd9jE_7-rjQDsrZlh4E7rs6ywDo7QMjXg.webp",
  },
  {
    id: "p-emerald", term: "프린세스 에메랄드",
    text: "로미가 조아핑의 힘을 빌려 변신한 친절의 프린세스예요. 「피리피리 매지컬 에메랄드!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/BiJ_sM6qBvrGjLMDoGXxSY1LiFapwAfgAi9GZw3Uo7twOooA7XXT98ncKRGyWqnPt1lEShlTzFVkRukUt9KNzrx3IT-Ned8LHcCTymV8N872GrGm9r8KQoovKVlxxUKhVS84CdlSqlN5wde9DRz3pw.webp",
  },
  {
    id: "p-floraheart", term: "프린세스 플로라하트",
    text: "로미가 플로라 하츄핑의 힘을 빌려 변신한 사랑의 프린세스예요. 「피리피리 매지컬 플로라!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/Htok9ij-oWpqykCqyQLFMnP_-5Lh2rRgrOFiSguW1Sf_mW41twPx_QGtO7jDydRGLukugu7HyQdDJYR2CddUk6xjmPMk6WJprUj-ZMRfeYHFd_b7ZNh1VkBbNO2WbrqTD5fADlkrwDhmqNSLEk0fVQ.webp",
    crop: [0.4, 0.08, 0.2],
  },
  {
    id: "p-solaris", term: "프린세스 솔라리스",
    text: "로미가 나나핑의 힘을 빌려 변신한 열정의 프린세스예요. 「피리피리 매지컬 솔라리스!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/E-LHQYydMCEfCM5p4XSSe6hjI4CyHR6p0NaF8DhI3kRHMdvnGdA5ZP3QWjPjtXrg2fVFdAOX72JyNVcuW1lVhXBMIn66h4xt6s1Qo_qKU4CYygIdJ8SOgWgZre12RgZjqcuaClEtXsFvgUdT3R2qyw.webp",
    crop: [0.4, 0.12, 0.2],
  },
  {
    id: "p-gloria", term: "프린세스 글로리아",
    text: "로미가 솔찌핑의 힘을 빌려 변신한 솔직함의 프린세스예요. 「피리피리 매지컬 글로리아!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/SUZceQ6xHsDv7-rDLAtismbGj285q6hCAs6SHsS3ajCVq-o1sVCL_CijnFaXaF5LsnEEZbEvMbUp1E1GcxT9g4Q7g9wx02wnnOtLwurV_QEywKvegMZsi21-LlGxYavj50tNtMFKX7l1kbZ7ID14iA.webp",
  },
  {
    id: "p-crystal", term: "프린세스 크리스탈",
    text: "로미가 꾸래핑의 힘을 빌려 변신한 평화의 프린세스예요. 「피리피리 매지컬 크리스탈!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/snMAeBZGodk1pwNa6RFNoCEcfP4CpouEp_vztmKFIIV4nGjJ_m4mQ-hsjfHHyrxBi5nH5edKhahxVJzU7xKjMK8l8LcYiO3bjbuGghHK8mEyHTshx_7hjnhjdM2Iip1H5ApOcOyLWSinZzBrOTEz8w.webp",
  },
  {
    id: "p-berryheart", term: "프린세스 베리하트",
    text: "로미가 베리 하츄핑의 힘을 빌려 변신한 사랑의 프린세스예요. 「피리피리 매지컬 베리하트!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/eIzXvRR2tWdZengenZNGcGa4rH61snZ8tFSks5XCP8xhMohF5luoTbya5gn0u7rO-5BXOSfC0R0WuR0S8fHXu8klxkKaDLwZCKh0mHWI-kij6xxG012il__M2eMMhwB9zNfmif0lcm6lvcNYIAWFPA.webp",
    crop: [0.42, 0.1, 0.2],
  },
  {
    id: "p-sweetfloss", term: "프린세스 스윗플로스",
    text: "로미가 포실핑의 힘을 빌려 변신한 순수의 프린세스예요. 「피리피리 매지컬 스윗플로스!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/IoXG2m3tu1YkRmA_8dz0t_qvFqqXm1TkNabWzqyfjIAvZHKnk56fKfvqmXFrttItBb-hvuGHVcIX_SIChN1aaAITQsQUotl8hGjPwgmgtJ8h-bkzgQO0tsRNLwEkK7JZh_-A5ffX9jcdjj46RrjOYg.webp",
  },
  {
    id: "p-sherbetina", term: "프린세스 샤베티나",
    text: "로미가 샤샤핑의 힘을 빌려 변신한 긍정의 프린세스예요. 「피리피리 매지컬 샤베티나!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/x3jE1VITZybRfCBSn4eF-PZIefN9xPKCW1JxH966iJe5ALW4yu-XR3w5PT23PnVn-O7qmvfk3Q1tzzmMSc92oV0l5BN8PNSsYEx-E0uVy61IJ_TyFElNQlPR_gRLGbN7G7RtPcEoAUhbAsa7Bz1dZQ.webp",
  },
  {
    id: "p-jellystine", term: "프린세스 젤리스틴",
    text: "로미가 말랑핑의 힘을 빌려 변신한 재미의 프린세스예요. 「피리피리 매지컬 젤리스틴!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/QWEhe6GllbNZB3QMCTcaY2SbJ3x4Xhxmzwak5iDgr0z1lMuUWT0hgK05vh92KtWUjedT16QbCqNCp1bpLHPzdbHznKHeFz78QYKLXy4cQ86q5_sCfBr8MvPi3tGIRgT0v0YUGfOE_bN7xBNiBNLGdA.webp",
    crop: [0.37, 0.11, 0.22],
  },
  {
    id: "p-brightheart", term: "프린세스 브라잇하트",
    text: "로미가 스타 하츄핑의 힘을 빌려 변신한 사랑의 프린세스예요. 「피리피리 매지컬 브라잇하트!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/7e0AGH5YT3CpkzIWEGXT8Ikf2dALhRxxa9co0jwpNP529JxHKYXCASHsFazB2ENpLZXpklyzoYMJZ11pu5WJ8MnkuoiDXh7Ig-56hjOHivohtdwOoexjuD5kRHuquzx5E9CA5OueQm5cF3mGwItokg.webp",
  },
  {
    id: "p-starlight", term: "프린세스 스타라이트",
    text: "로미가 빛나핑의 힘을 빌려 변신한 치유의 프린세스예요. 「피리피리 매지컬 스타라이트!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/bjS9hptZo5WU3Y9O1lHHPQuKcagsfLssmTo-EfaLmW24iSJlJtYnvQB3vOC8W86hKdiNxI4VQE4qzkJVB0a_wyvezpp5kzbyXF_QTbOxSWT9UJpATxkdANKnszc1BLKMZwc9LH-aaPtfoxW_zxvFgA.webp",
  },
  {
    id: "p-glamstar", term: "프린세스 글램 스타",
    text: "로미가 초롱핑의 힘을 빌려 변신한 소망의 프린세스예요. 「피리피리 매지컬 글램 스타!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/jM40pgOjCNP4Mkg_fztfuwZDCGL_04VFsuEVPfO7euEH69V6iAtPO-tg59vp_rSm06jjUMVbna3wwEA8odKxdrtFTfTJ-CIYlKbt_o6u_8y63mIxbCj8tMcSH13v0Tw4B0uZyjlW6-tLO8QCiJa6ng.webp",
  },
  {
    id: "p-lunashine", term: "프린세스 루나 샤인",
    text: "로미가 빤짝핑의 힘을 빌려 변신한 밝음의 프린세스예요. 「피리피리 매지컬 루나 샤인!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/szPLh_CLwwyVHv7OpUN_4zP_NVWewastPb7fjZR_NE-wSIx9TYSr7Zx8dZlw6ENe2SOCKoJXsp3bTTobJ2LTvymQRLf49VAZN1Y1fE1E2FSRk4RBomrGGtYOwhWH-LDtgpW8Z-cvsBF4CX8X80YFXA.webp",
    crop: [0.375, 0.12, 0.2],
  },
  {
    id: "p-aurora", term: "프린세스 오로라",
    text: "로미가 오로라핑의 힘을 빌려 변신한 약속의 프린세스예요. 「피리피리 매지컬 오로라!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/fnAYLHCDjtEdftF5f4F4HyZcQ2dJ2WBLLuPacnvVxfUwGlvTUcqBp1IRUaP_nWpEHPG6fxm_twNgTmIYP6ybL2HG0R3ZRE_w6Zy-h3y78DJjmlv6FwkTUHDlZCQ0td6WiIO_Gb5MmGdvWvPcg_gj5Q.webp",
  },
  {
    id: "p-fancyheart", term: "프린세스 팬시하트",
    text: "로미가 프린세스 하츄핑의 힘을 빌려 변신한 사랑의 프린세스예요. 「피리피리 매지컬 팬시하트!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/1TeNBE6szVZTiEQ_4T-0aNFn8_p-y3NUO4j7wuXeNRfug3ABOqaa4jNWeZyTjpHM5JysIMElf6nocWF7kFvwALRk0vzYnEW2run-WMHHcWqsBMOfg9tA9kpdPP1ZNymWRRX6JlrmnW-DhR_zDlP9ZA.webp",
  },
  {
    id: "p-plie", term: "프린세스 쁠리에",
    text: "로미가 사뿐핑의 힘을 빌려 변신한 기품의 프린세스예요. 「피리피리 매지컬 쁠리에!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/cOBUgoI6h1x2h-wkWRDKErXChaY4-ZSXnLNkPZ0cTIrHy_4JJZo8Gq1qi5T-kYD2MVCzSS10t2rt5fPYv_c-ZNjb-2QZDNceGeswt-HsBDbjwjPzaY8JIgYmAFFIshKo0F1LB85KUHmoizDWwlQAxQ.webp",
  },
  {
    id: "p-bonita", term: "프린세스 보니타",
    text: "로미가 뽀니핑의 힘을 빌려 변신한 자신감의 프린세스예요. 「피리피리 매지컬 보니타!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/XvxLnMCXeQtxnEqpeK6fnM9hEBCfGY6vV1XLpIJyHIg7p7rQfblDaIr0mv5zeBmaZ3YgNkOkVT5cSx3u5rGh3zrICNlCEaxhouASjAs5aLW4wramvEU82P9qC5wFikzb82LRDKl49O44mQzbDnHbuA.webp",
  },
  {
    id: "p-fantana", term: "프린세스 판타나",
    text: "로미가 아름핑의 힘을 빌려 변신한 고움의 프린세스예요. 「피리피리 매지컬 판타나!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/veohED6vRMMCbKjQWM2fwjfMLqMFVh1mHyt-ZXMh7qURrMSp_0NoPecLLtdV8I1ZTW1LwqWrN-CV42rEzaY_qsjpz5YiWNMLXiDdkYV8xhZs5ZDu1DdgO0vO9kaUnXaNeNg8ekFmZm8pf8yGxm7gNQ.webp",
  },
  {
    id: "p-luminous", term: "프린세스 루미너스",
    text: "로미가 다이아나핑의 힘을 빌려 변신한 영광의 프린세스예요. 「피리피리 매지컬 루미너스!」 하고 마법 주문을 외우지요.",
    img: "https://i.namu.wiki/i/5KsoTe6gVm8zpnyUB2_Nww02-w3t7t2TkSw4tt4_J1rWMXqp6agyfBmyCbYApgUTYYUGk7TRiPm2Nc-ASWhSVDhI-ZN5x9aD5ivSWeCl-zHmtwK3cZJW-yVpoy0dCj6sRInvSKKqkl6k-CDq5ivLQA.webp",
  },
];
