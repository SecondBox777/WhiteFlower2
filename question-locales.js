import { resolveLanguage } from './i18n.js';
export const questionCopy = {
 ko:{pattern:'규칙에 따라 물음표 자리에 들어갈 도형을 고르세요.',spatial:'전개도를 접었을 때 만들 수 있는 정육면체를 고르세요.',logic:'각 도형은 일정한 무게를 가집니다. 저울에서 더 낮은 쪽이 더 무겁습니다. 반드시 참인 비교를 고르세요.',positive:'각 도형은 일정한 양수의 무게를 가집니다. 저울에서 더 낮은 쪽이 더 무겁고, 수평이면 무게가 같습니다. 반드시 참인 비교를 고르세요.',unknown:'판단할 수 없음',alt:'문항 {n}: 도형과 선택지 A, B, C, D'},
 en:{pattern:'Which figure logically belongs in place of the question mark?',spatial:'Which cube can be made by folding this net?',logic:'Each shape has a fixed weight. The lower pan is heavier. Which comparison must be true?',positive:'Each shape has a fixed positive weight. Lower means heavier; level means equal. Which comparison must be true?',unknown:'Cannot be determined',alt:'Question {n}: figures and options A, B, C, D'},
 ja:{pattern:'規則に従って、疑問符の位置に入る図形を選んでください。',spatial:'この展開図を折って作れる立方体を選んでください。',logic:'各図形の重さは一定です。低い側の皿がより重いことを表します。必ず成り立つ比較を選んでください。',positive:'各図形の重さは一定の正の値です。低い側がより重く、水平なら同じ重さです。必ず成り立つ比較を選んでください。',unknown:'判断できない',alt:'問題{n}：図形と選択肢A・B・C・D'},
 'zh-CN':{pattern:'根据规律，选择应放在问号处的图形。',spatial:'选择可以由此展开图折成的正方体。',logic:'每种图形的重量固定。天平较低的一侧更重。哪个比较一定成立？',positive:'每种图形的重量为固定正数。较低的一侧更重，水平表示重量相等。哪个比较一定成立？',unknown:'无法确定',alt:'第{n}题：图形与选项A、B、C、D'},
 es:{pattern:'¿Qué figura corresponde al signo de interrogación según la lógica del patrón?',spatial:'¿Qué cubo se puede formar al plegar este desarrollo?',logic:'Cada figura tiene un peso fijo. El plato más bajo pesa más. ¿Qué comparación debe ser cierta?',positive:'Cada figura tiene un peso positivo fijo. Más bajo significa más pesado; al mismo nivel significa igual peso. ¿Qué comparación debe ser cierta?',unknown:'No se puede determinar',alt:'Pregunta {n}: figuras y opciones A, B, C, D'},
 fr:{pattern:'Quelle figure doit remplacer le point d’interrogation selon la logique du motif ?',spatial:'Quel cube peut-on former en pliant ce patron ?',logic:'Chaque forme a un poids fixe. Le plateau le plus bas est le plus lourd. Quelle comparaison est nécessairement vraie ?',positive:'Chaque forme a un poids positif fixe. Le plateau le plus bas est le plus lourd ; des plateaux au même niveau ont le même poids. Quelle comparaison est nécessairement vraie ?',unknown:'Impossible à déterminer',alt:'Question {n} : figures et options A, B, C, D'}
};
export function localizedQuestion(question,index,language) {
 const copy=questionCopy[resolveLanguage(language)];
 return {...question,prompt:index<10?copy.pattern:index<20?(index===10?copy.logic:copy.positive):copy.spatial,
  imageAlt:copy.alt.replace('{n}',index+1),options:index>=10&&index<20?['A','B','C',`D · ${copy.unknown}`]:question.options};
}
