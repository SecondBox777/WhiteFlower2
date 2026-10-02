# 문항 분석 태그와 보고서 지표

Q01~Q30 원본 PNG를 직접 검토하여 작성한 내부 분류입니다. 난이도는 배점에서 자동 환산하지 않고 규칙 수·소거/대입 단계·전개도 형태를 고려한 1~5 편집 추정입니다. 정답과 점수/IQ 계산은 기존 답지 및 scoring.js를 유지합니다. 실제 응시자 중앙값과 난이도 보정 자료는 없습니다.

| 문항 | 영역 | 세부유형 | 난이도 | 주/부 작업 능력 | 검토한 문제 내용 |
|---|---|---|---|---|---|
| Q01 | pattern | position_translation | 1 | position_tracking, rule_induction | 두 기호의 열 이동과 행별 순환 위치를 추적한다. |
| Q02 | pattern | opposed_translation | 1 | position_tracking, parallel_tracking | 빈 별과 채운 별이 서로 반대 방향으로 열을 이동한다. |
| Q03 | pattern | axis_switch | 1 | position_tracking, axis_switching | 행에 따라 이동 축이 세로/가로로 바뀌며 두 기호가 반대 방향으로 이동한다. |
| Q04 | pattern | nonsequential_translation | 2 | rule_induction, position_tracking | 두 원의 열 순서가 좌→우→중앙으로 바뀌고 행 위치는 순환한다. |
| Q05 | pattern | position_fill_integration | 2 | attribute_integration, position_tracking | 사각형과 원의 위치 이동 및 중앙 열의 채움 변화를 함께 추적한다. |
| Q06 | pattern | three_symbol_integration | 3 | attribute_integration, parallel_tracking | 원·별·사각형의 고정/이동 위치와 마지막 열의 채움 변화를 결합한다. |
| Q07 | pattern | opposed_position_fill | 2 | attribute_integration, position_tracking | 원과 사각형의 반대 이동, 행별 위치 순환, 채움 교대를 함께 비교한다. |
| Q08 | pattern | perimeter_multirule | 3 | parallel_tracking, attribute_integration | 원과 사각형의 테두리 위치 변화와 채움 교대를 여러 행에 걸쳐 추적한다. |
| Q09 | pattern | exclusive_overlay | 4 | set_operations, rule_abstraction | 첫 두 칸의 기호를 겹쳤을 때 공통 위치 기호가 소거되고 나머지가 남는 관계를 찾는다. |
| Q10 | pattern | exclusive_overlay | 4 | set_operations, attribute_integration | 원과 사각형을 각각 위치별로 비교해 공통 요소 소거 규칙을 적용한다. |
| Q11 | logic | inequality_cancellation | 2 | constraint_reasoning, symbolic_cancellation | O+T>S>T+별의 연결에서 공통 T를 소거해 O와 별을 비교한다. |
| Q12 | logic | transitive_comparison | 1 | relational_ordering, constraint_reasoning | O>S>별의 두 부등식을 연결한다. |
| Q13 | logic | equality_substitution | 1 | symbolic_substitution, relational_ordering | O=S와 S>T를 결합해 O와 T를 비교한다. |
| Q14 | logic | positive_ratio | 1 | proportional_reasoning, constraint_reasoning | 2O=S 및 양의 무게 조건으로 O와 S를 비교한다. |
| Q15 | logic | common_term_cancellation | 1 | symbolic_cancellation, constraint_reasoning | O+T=S+T에서 양쪽의 공통 T를 소거한다. |
| Q16 | logic | multistep_inequality | 4 | multistep_reasoning, symbolic_substitution | O+T=S, S+별=T+마름모, 마름모>2별을 대입/소거해 비교한다. |
| Q17 | logic | multistep_equality | 5 | multistep_reasoning, proportional_reasoning | O+T=S, S+별=2O, T=2별을 연쇄 대입해 O와 3별을 비교한다. |
| Q18 | logic | multistep_inequality | 5 | multistep_reasoning, symbolic_cancellation | 합의 부등식, S=T+마름모, 마름모>별을 결합해 O와 2별을 비교한다. |
| Q19 | logic | multistep_equality | 5 | multistep_reasoning, symbolic_cancellation | 세 등식 O+T=S, S+별=마름모, 마름모=2O를 소거해 T와 별을 비교한다. |
| Q20 | logic | multistep_equality | 5 | multistep_reasoning, symbolic_substitution | O+T=S, S+T=마름모, 마름모+별=3O를 결합해 O와 T를 비교한다. |
| Q21 | spatial | cube_cross_net | 2 | opposite_face_reasoning, spatial_folding | 십자 전개도에서 마주 보는 면을 배제하고 세 기호의 면 배치를 확인한다. |
| Q22 | spatial | cube_opposite_faces | 2 | opposite_face_reasoning, spatial_folding | 십자 전개도의 O와 사각형이 반대 면이라는 관계를 확인한다. |
| Q23 | spatial | cube_cross_net | 2 | opposite_face_reasoning, spatial_folding | 세로로 긴 십자 전개도에서 두 원의 반대 면 관계와 X의 인접 면을 확인한다. |
| Q24 | spatial | cube_cross_net | 3 | opposite_face_reasoning, attribute_discrimination | 채운/빈 원·사각형을 구분하며 인접 면과 반대 면 관계를 확인한다. |
| Q25 | spatial | cube_offset_net | 3 | spatial_folding, face_orientation | 옆으로 뻗은 전개도를 접고 원·사각형·X의 세 면 배치를 비교한다. |
| Q26 | spatial | cube_strip_net | 4 | spatial_folding, face_orientation | 네 칸 띠 양 끝에 붙은 면을 접어 원·사각형·X의 배치를 비교한다. |
| Q27 | spatial | cube_zigzag_net | 4 | spatial_folding, face_orientation | 계단형 전개도의 면 연결을 연속 추적하며 사각형·원·마름모 배치를 비교한다. |
| Q28 | spatial | cube_long_cross_net | 4 | spatial_folding, face_orientation | 긴 세로 띠와 상단 날개를 접어 마름모·원·사각형의 배치를 비교한다. |
| Q29 | spatial | cube_long_cross_net | 4 | face_orientation, attribute_discrimination | 여섯 기호가 있는 긴 십자 전개도의 반대 면과 세 면 배치를 비교한다. |
| Q30 | spatial | cube_zigzag_net | 3 | spatial_folding, attribute_discrimination | 계단형 전개도의 채운/빈 도형을 구분해 세 면의 배치를 비교한다. |

## OpenAI로 전달하는 분석

- 문항별 과제 설명, 영역/유형, 내부 난이도, 주/부 작업 능력, 선택 답안, 정답 여부, 제외 사유, 기준시간, 누적시간, 상대시간 및 풀이 스타일. 태그는 작업 요구사항이며 해당 능력의 측정 점수가 아닙니다.
- 상대시간 = 누적시간 / 내부 기준시간. 0.76은 기준보다 24% 짧음입니다. 기준시간은 기존 합성 모형에서 가져오며 다른 사용자 중앙값으로 표현하지 않습니다.
- 빠름 <=0.75, 보통 >0.75~1.25, 느림 >1.25. 정답/오답과 교차하여 여섯 종류의 풀이 스타일을 묶습니다. 경계는 제품의 분석 기준입니다.
- 전체·영역·세부유형·난이도·영역×난이도·작업 능력별 유효 표본 수, 정답률, 정답/오답 상대시간 중앙값, 시간 변동, 오답에 쓴 시간. 작업 능력 그룹은 중복됩니다.
- 난이도 가중 정확도 = 정답 난이도 합 / 유효 문항 난이도 합.
- 난이도·속도 효율 = sum(정답 × 난이도 × min(1, 1/상대시간)) / 유효 문항 난이도 합. 기준보다 빠른 응답에는 추가 효율 보상을 주지 않으며, 오답은 0입니다. 이 값은 서술용 0~1 지표로 IQ/능력 점수가 아닙니다.
- 쉬운 문항 오답, 어려운 문항 정답, 빠른 오답, 느린 정답, 충분한 시간을 쓴 오답의 문항 번호. 오답은 실패한 과제 유형을 알려주지만 특정 오개념/성격을 증명하지 않습니다.
- 정답과 오답에 배분한 상대시간을 동일 난이도 안에서 비교합니다. 시간이 늘어 정답이 됐다는 인과관계는 주장하지 않습니다.
- 전반/후반은 문항 번호 기준이며 실제 방문 순서는 수집하지 않습니다. 같은 영역·같은 난이도에서 앞/뒤 각각 2개 이상 유효 표본이 있을 때만 matched_order 비교를 전달합니다. 현재 30문항 분류에는 이 조건을 충족하는 비교가 없으므로 비어 있습니다. 피로/집중력 저하를 추정할 근거로 사용하지 않습니다.
- 제외된 초고속/미응답/시간제한 문항은 정확도·오답시간·스타일 지표에서 제외됩니다. 표본이 없으면 0점 대신 null을 전달합니다.

## 보고서 작성

프롬프트는 lib/report-prompt.js, 문항 분류는 lib/item-metadata.js, 지표 계산은 lib/performance.js에 분리했습니다. 종합 분석 약 500자, 강점/보완점 각 2개, 인지적 특성 2~4개, 업무 환경 2~3개, 직업군 3~5개를 요청합니다. 각 주요 해석에 문항/통계 근거와 연결 설명을 요구하며, 시간 해석은 적어도 두 주요 항목에 사용합니다. 한계는 마지막 한 문단으로 모읍니다. 유효 응답이 없으면 개인화된 결과를 만들어내지 않습니다.

랜덤 답안은 experimental=true를 유지해 실제 사용자 분석과 구별하면서도 예시 프로필을 구체적으로 해석합니다. 프롬프트 지침은 모델 생성 목표이며 내용/분량을 완전히 보장하지 않습니다. JSON schema는 항목 수 상한을 검증합니다.
