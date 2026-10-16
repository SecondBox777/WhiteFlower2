// TEMPORARY TEST FEATURE: delete this module and the marked integration hooks to remove.
export const temporaryTestReportsEnabled = true;
const labels={ko:'테스트용: 바로 확인하기',en:'Testing: view results now',ja:'テスト用：今すぐ結果を見る','zh-CN':'测试用：立即查看',es:'Prueba: ver resultados ahora',fr:'Test : voir les résultats maintenant'};
export function temporaryTestButton(language) {
 return temporaryTestReportsEnabled?`<button class="button secondary full" style="margin-top:10px" id="temporary-test-report" type="button" disabled>${labels[language]??labels.en}</button>`:'';
}
export function updateTemporaryTestButton({disabled,run}) {
 const button=document.querySelector('#temporary-test-report');
 if(!button)return;
 button.disabled=disabled;
 button.onclick=run;
}
