// Reviewed against all 30 original PNGs. Editorial task tags, not validated scales.
// Difficulty is an internal 1–5 estimate of rule/constraint complexity, not points
// or observed population difficulty. Skills describe task demands, not measured traits.
const rows = [
 ['position_translation',1,'두 기호의 열 이동과 행별 순환 위치를 추적한다.','position_tracking','rule_induction'],
 ['opposed_translation',1,'빈 별과 채운 별이 서로 반대 방향으로 열을 이동한다.','position_tracking','parallel_tracking'],
 ['axis_switch',1,'행에 따라 이동 축이 세로/가로로 바뀌며 두 기호가 반대 방향으로 이동한다.','position_tracking','axis_switching'],
 ['nonsequential_translation',2,'두 원의 열 순서가 좌→우→중앙으로 바뀌고 행 위치는 순환한다.','rule_induction','position_tracking'],
 ['position_fill_integration',2,'사각형과 원의 위치 이동 및 중앙 열의 채움 변화를 함께 추적한다.','attribute_integration','position_tracking'],
 ['three_symbol_integration',3,'원·별·사각형의 고정/이동 위치와 마지막 열의 채움 변화를 결합한다.','attribute_integration','parallel_tracking'],
 ['opposed_position_fill',2,'원과 사각형의 반대 이동, 행별 위치 순환, 채움 교대를 함께 비교한다.','attribute_integration','position_tracking'],
 ['perimeter_multirule',3,'원과 사각형의 테두리 위치 변화와 채움 교대를 여러 행에 걸쳐 추적한다.','parallel_tracking','attribute_integration'],
 ['exclusive_overlay',4,'첫 두 칸의 기호를 겹쳤을 때 공통 위치 기호가 소거되고 나머지가 남는 관계를 찾는다.','set_operations','rule_abstraction'],
 ['exclusive_overlay',4,'원과 사각형을 각각 위치별로 비교해 공통 요소 소거 규칙을 적용한다.','set_operations','attribute_integration'],
 ['inequality_cancellation',2,'O+T>S>T+별의 연결에서 공통 T를 소거해 O와 별을 비교한다.','constraint_reasoning','symbolic_cancellation'],
 ['transitive_comparison',1,'O>S>별의 두 부등식을 연결한다.','relational_ordering','constraint_reasoning'],
 ['equality_substitution',1,'O=S와 S>T를 결합해 O와 T를 비교한다.','symbolic_substitution','relational_ordering'],
 ['positive_ratio',1,'2O=S 및 양의 무게 조건으로 O와 S를 비교한다.','proportional_reasoning','constraint_reasoning'],
 ['common_term_cancellation',1,'O+T=S+T에서 양쪽의 공통 T를 소거한다.','symbolic_cancellation','constraint_reasoning'],
 ['multistep_inequality',4,'O+T=S, S+별=T+마름모, 마름모>2별을 대입/소거해 비교한다.','multistep_reasoning','symbolic_substitution'],
 ['multistep_equality',5,'O+T=S, S+별=2O, T=2별을 연쇄 대입해 O와 3별을 비교한다.','multistep_reasoning','proportional_reasoning'],
 ['multistep_inequality',5,'합의 부등식, S=T+마름모, 마름모>별을 결합해 O와 2별을 비교한다.','multistep_reasoning','symbolic_cancellation'],
 ['multistep_equality',5,'세 등식 O+T=S, S+별=마름모, 마름모=2O를 소거해 T와 별을 비교한다.','multistep_reasoning','symbolic_cancellation'],
 ['multistep_equality',5,'O+T=S, S+T=마름모, 마름모+별=3O를 결합해 O와 T를 비교한다.','multistep_reasoning','symbolic_substitution'],
 ['cube_cross_net',2,'십자 전개도에서 마주 보는 면을 배제하고 세 기호의 면 배치를 확인한다.','opposite_face_reasoning','spatial_folding'],
 ['cube_opposite_faces',2,'십자 전개도의 O와 사각형이 반대 면이라는 관계를 확인한다.','opposite_face_reasoning','spatial_folding'],
 ['cube_cross_net',2,'세로로 긴 십자 전개도에서 두 원의 반대 면 관계와 X의 인접 면을 확인한다.','opposite_face_reasoning','spatial_folding'],
 ['cube_cross_net',3,'채운/빈 원·사각형을 구분하며 인접 면과 반대 면 관계를 확인한다.','opposite_face_reasoning','attribute_discrimination'],
 ['cube_offset_net',3,'옆으로 뻗은 전개도를 접고 원·사각형·X의 세 면 배치를 비교한다.','spatial_folding','face_orientation'],
 ['cube_strip_net',4,'네 칸 띠 양 끝에 붙은 면을 접어 원·사각형·X의 배치를 비교한다.','spatial_folding','face_orientation'],
 ['cube_zigzag_net',4,'계단형 전개도의 면 연결을 연속 추적하며 사각형·원·마름모 배치를 비교한다.','spatial_folding','face_orientation'],
 ['cube_long_cross_net',4,'긴 세로 띠와 상단 날개를 접어 마름모·원·사각형의 배치를 비교한다.','spatial_folding','face_orientation'],
 ['cube_long_cross_net',4,'여섯 기호가 있는 긴 십자 전개도의 반대 면과 세 면 배치를 비교한다.','face_orientation','attribute_discrimination'],
 ['cube_zigzag_net',3,'계단형 전개도의 채운/빈 도형을 구분해 세 면의 배치를 비교한다.','spatial_folding','attribute_discrimination']
];
export const itemMetadata = rows.map(([subtype,difficulty,task_description,primary_skill,secondary_skill], i) => ({
 id:`Q${String(i+1).padStart(2,'0')}`, domain:['pattern','logic','spatial'][Math.floor(i/10)],
 subtype, difficulty, task_description, primary_skill, secondary_skills:[secondary_skill],
 skills:[primary_skill,secondary_skill], metadata_source:'visual_review_editorial_v1'
}));
