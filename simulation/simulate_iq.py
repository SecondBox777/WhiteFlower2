from pathlib import Path
import sys, json, zipfile, os
os.environ["MPLCONFIGDIR"]=str(Path(__file__).parent/"mpl_cache")
sys.path.insert(0, str(Path(__file__).parent/'work_packages'))
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

OUT=Path(__file__).parent/'synthetic_iq_anchor110'; OUT.mkdir(exist_ok=True)
P=np.array([2,2,2,3,3,4,3,4,5,5,2,2,2,2,2,4,5,5,5,5,3,2,3,3,3,4,4,4,4,3])
T=np.array([20,20,20,25,25,40,30,45,75,90,20,20,20,25,25,50,70,75,90,90,45,30,45,50,50,65,65,70,70,55])
levels=np.array([0,0,0,1,1,2,1,2,4,4,1,1,1,1,1,3,4,4,4,4,2,1,2,2,2,3,3,3,3,2])
B=np.array([-1.5,-.75,0,.5,1.0])[levels]
def speed(r):
    return np.select([r<=.4,r<=.65,r<=1,r<=1.5,r<=2],[1,.9,.75,.5,.25],default=0.)
assert P.sum()==100 and T.sum()==1420
assert np.allclose(speed(np.array([.4,.400001,.65,.650001,1,1.000001,1.5,1.500001,2,2.000001])),[1,.9,.9,.75,.75,.5,.5,.25,.25,0])
assert np.isclose(np.sum(P*(.8+.2*speed(np.zeros(30)))),100)
assert np.isclose(np.sum(P*(.8+.2*speed(np.ones(30)*3))),80)
def simulate(iq,seed,shift=0,c=0,limit=False):
    rng=np.random.default_rng(seed); theta=(iq-110)/15; b=B+shift
    prob=c+(1-c-.02)/(1+np.exp(-1.3*(theta[:,None]-b)))
    correct=rng.random(prob.shape)<prob
    ratio=np.exp(.2*b-.3*theta[:,None]+rng.normal(0,.25,(len(iq),1))+rng.normal(0,.35,prob.shape))
    times=ratio*T
    if limit: correct &= np.cumsum(times,axis=1)<=1800
    score=np.sum(correct*P*(.8+.2*speed(ratio)),axis=1)
    assert score.min()>=0 and score.max()<=100.000001
    return score,np.sum(times,axis=1)/60
def summary(x):
    q=np.percentile(x,[5,50,95]); return dict(mean=float(x.mean()),sd=float(x.std()),p05=float(q[0]),median=float(q[1]),p95=float(q[2]))
bands=[]
for iq in range(50,151,5):
    s,t=simulate(np.full(10000,iq),20260914+iq-10)
    bands.append(dict(iq=iq,n=len(s),**summary(s),mean_mc_se=float(s.std()/np.sqrt(len(s))),mean_minutes=float(t.mean())))
rng=np.random.default_rng(20260914); iq=rng.normal(100,15,200000)
s,t=simulate(iq,20260915)
def conversions(scores):
    rows=[]
    for point in range(10,96,5):
        v=iq[(scores>=point-2.5)&(scores<point+2.5)]
        if len(v)>=100: rows.append(dict(score_center=point,score_low=point-2.5,score_high=point+2.5,n=len(v),**summary(v)))
    return rows
conv=conversions(s)
sensitivity=[]
for name,kwargs in [('baseline',{}),('easier_b_minus_0.5',{'shift':-.5}),('harder_b_plus_0.5',{'shift':.5}),('guess_floor_0.20',{'c':.2}),('sequential_30min_limit',{'limit':True})]:
    z,_=simulate(iq,20260915,**kwargs)
    sensitivity.append(dict(name=name,score=summary(z),correlation=float(np.corrcoef(iq,z)[0,1]),conversion=conversions(z)))
cor=float(np.corrcoef(iq,s)[0,1]); slope=float(np.cov(iq,s,ddof=0)[0,1]/s.var()); intercept=float(iq.mean()-slope*s.mean())
stats=dict(label='SYNTHETIC / PRELIMINARY / NOT VALIDATED IQ NORMS',ability_anchor_iq=110,seed=20260914,population_n=len(iq),population_score=summary(s),correlation=cor,linear_iq_intercept=intercept,linear_iq_slope=slope,linear_rmse=float(np.sqrt(np.mean((iq-intercept-slope*s)**2))),bands=bands,score_to_iq=conv,sensitivity=sensitivity,items=[dict(item=i+1,points=int(P[i]),reference_seconds=int(T[i]),difficulty_level=int(levels[i]),b=float(B[i])) for i in range(30)])
(OUT/'results.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')
np.savez_compressed(OUT/'synthetic_population.npz',assumed_iq=iq,score=s,minutes=t)
plt.rcParams.update({'font.family':'Malgun Gothic','font.size':11,'axes.spines.top':False,'axes.spines.right':False})
fig,ax=plt.subplots(figsize=(10,5.8),layout='constrained')
ax.hist(s,bins=np.arange(0,102,2),density=True,color='#6c93ba',alpha=.75,label='합성 모집단 점수 히스토그램')
x=np.linspace(-10,110,600); mu=s.mean(); sd=s.std()
ax.plot(x,np.exp(-.5*((x-mu)/sd)**2)/(sd*np.sqrt(2*np.pi)),color='#bd6338',lw=2.5,label='동일 평균·표준편차의 정규곡선 (비교용)')
ax.axvline(mu,color='#34495e',ls='--',lw=1)
ax.set(xlim=(0,100),xlabel='80:20 시간 보정 점수 (0~100)',ylabel='확률밀도',title='합성·예비 모집단 점수 분포 | 검증된 IQ 규준 아님')
ax.text(.02,.95,f'가정: IQ ~ N(100, 15²), 200,000명\n점수 평균 {mu:.2f} / 표준편차 {sd:.2f}\n기준: IQ 110의 평균 약 41점',transform=ax.transAxes,va='top')
ax.legend(loc='upper right',fontsize=9)
fig.savefig(OUT/'population.png',dpi=180); fig.savefig(OUT/'population.svg');plt.close(fig)
fig,axes=plt.subplots(1,2,figsize=(12,5.5),layout='constrained')
q=np.array([r['iq'] for r in bands]); m=np.array([r['mean'] for r in bands])
axes[0].fill_between(q,[r['p05'] for r in bands],[r['p95'] for r in bands],alpha=.2,color='#386b9a',label='개인 점수 중앙 90% 범위')
axes[0].scatter([110],[41],color='#bd6338',zorder=5); axes[0].annotate('기준: IQ 110 → 평균 41점',(110,41),xytext=(65,65),arrowprops=dict(arrowstyle='->',color='#bd6338')); axes[0].plot(q,m,color='#386b9a',label='평균 점수');axes[0].set(xlabel='모형에 입력한 IQ',ylabel='점수',ylim=(0,100),title='IQ별 10,000회 가상 응시');axes[0].legend(fontsize=9)
cq=[r['score_center'] for r in conv]
axes[1].fill_between(cq,[r['p05'] for r in conv],[r['p95'] for r in conv],alpha=.2,color='#386b9a',label='조건부 IQ 중앙 90% 범위')
axes[1].plot(cq,[r['mean'] for r in conv],color='#386b9a',label='점수 구간별 조건부 평균 IQ')
axes[1].set(xlabel='점수 구간 중심 (±2.5점)',ylabel='합성 모형의 IQ',title='모집단 가정에 따른 예비 환산');axes[1].legend(fontsize=9)
fig.suptitle('합성·예비 결과 — 실제 IQ를 추정하는 검증된 환산표가 아님',fontsize=14)
fig.savefig(OUT/'relationship.png',dpi=180);plt.close(fig)
def table(rows,cols):
    return '| '+' | '.join(c[0] for c in cols)+' |\n|'+'|'.join(['---']*len(cols))+'|\n'+'\n'.join('| '+' | '.join(f'{r[k]:.2f}' if isinstance(r[k],float) else str(r[k]) for _,k in cols)+' |' for r in rows)
anchor_curve=[dict(score=float(v),iq=float(np.interp(v,m,q))) for v in [10,20,30,41,50,60,70,80,90] if m.min()<=v<=m.max()]
report=f'''# 30문항 IQ형 검사: 합성·예비 시뮬레이션

**모든 수치와 그림은 합성 결과이며 검증된 IQ 규준이 아니다. 실제 사람 또는 AI가 문제를 반복해서 푼 기록이 아니라, 정답 여부와 시간을 확률적으로 생성했다.**

## 입력과 모형

사용자 지정 기준: 기존 IQ 100의 평균 약 41.0점을 새 IQ 110의 평균으로 이동했다. 정답률과 응답시간 모두 theta=(IQ-110)/15를 사용한다. 모집단 IQ 평균은 100, 표준편차는 15로 유지했다. 이는 관측 자료로 확인된 보정이 아니라 사용자가 지정한 기준점 변경이다.

평균 점수 곡선의 역환산에서는 약 41점이 IQ 110에 대응한다. 반면 모집단 사전분포를 반영한 조건부 평균 IQ는 평균으로 수축하므로 정확히 110일 필요가 없다. 두 종류의 환산을 구분한다.

원 대화의 30개 배점(합 100), 기준시간(합 1,420초 = 23분 40초), 문항별 잠정 난이도를 사용했다. 원 대화의 22~23분 설명을 산술적으로 수정했다. 문제 내용·정답을 재검증하거나 경험적으로 보정하지 않았다.

theta=(IQ-110)/15. 난이도 매우 쉬움/쉬움/중간/중상/어려움의 b를 각각 -1.5/-0.75/0/0.5/1.0으로 임의 대응시켰다. 이 수치는 측정값이나 적합된 모수가 아니다. 각 문항의 정답확률은 p=c+(1-c-0.02)*logistic(1.3*(theta-b))이다. 기본 c=0이며 2% 실수 상한을 가정했다. 선택지 수에 근거한 찍기 확률을 확인하지 않았으므로 c=0.20은 별도 민감도 조건으로만 사용했다.

응답시간은 ln(t_i/T_i)=0.2*b_i-0.3*theta+u+e_i; u~N(0,0.25²)는 개인별 공통 속도 차이, e_i~N(0,0.35²)는 문항별 변동이다. theta가 고정되면 정답 여부와 시간은 독립이다. 고정 IQ 안에서도 문항 정답과 시간이 매번 달라진다. 영역별 능력, 학습, 피로, 재응시 기억, 전략적 찍기, 정답-시간 잔차 의존은 구현하지 않았다.

S는 t/T ≤0.40:1, (0.40,0.65]:0.9, (0.65,1]:0.75, (1,1.5]:0.5, (1.5,2]:0.25, >2:0이다. 시간은 반올림하지 않는다. 오답은 전체 문항 기여가 0이다. Score=sum(correct*P*(0.8+0.2*S)). 모든 정답·최고속도 100점, 모든 정답·2T초과 80점. 경계값과 최대점수를 자동 확인했다.

## 표본 설계

IQ 50~150, 5점 간격의 21개 고정 수준마다 10,000명(총 210,000회)을 독립 생성했다. 별도로 IQ~N(100,15²)에서 200,000명을 추출했다. 균등 IQ 표본을 모집단 분포로 사용하지 않았다. 이 정규 IQ 분포는 관측된 사실이 아니라 모형의 입력 가정이다. 기본 결과는 전체 시간제한 없이 30문항 모두 응시한다. 과거 대화의 30분 제한은 제안 단계였으므로 문항 순서대로 풀다 누적 1,800초를 넘으면 해당 문항부터 0점인 별도 조건으로 평가했다.

고정된 한 모형에서 반복 표집했다. 따라서 표의 90% 범위는 개인차/응답 변동이며 모형 가정에 대한 신뢰구간이 아니다. 난이도 사전분포를 자료로 업데이트한 베이지안 보정도 아니다. 잠정 사전 판단의 불확실성은 별도 민감도 조건으로 확인했다.

## IQ별 점수 분포 (합성·예비)

{table(bands,[('가정 IQ','iq'),('N','n'),('평균','mean'),('표준편차','sd'),('5백분위','p05'),('중앙값','median'),('95백분위','p95'),('평균의 MC 표준오차','mean_mc_se')])}

## 평균 점수 곡선 역환산 (사용자 지정 기준, 합성·예비)

이는 해당 평균 점수가 기대되는 IQ 수준이다. 개인의 IQ를 확정하는 값이 아니다. IQ별 모의 평균 사이를 선형 보간했다.

{table(anchor_curve,[('평균 점수','score'),('대응 IQ','iq')])}

## 모집단 결과와 환산 (합성·예비)

점수 평균 {mu:.2f}, 표준편차 {sd:.2f}, Pearson r={cor:.3f}. 이는 모형에 입력한 IQ와 생성 점수의 관계이며 실제 검사 타당도의 증거가 아니다. 표본 수를 늘려도 잘못된 모형 가정은 해결되지 않는다.

간단한 선형 근사: IQ_hat={intercept:.2f}+{slope:.3f}*Score. 합성 모집단 내 잔차 RMSE={stats['linear_rmse']:.2f} IQ점. 이 식은 모집단 사전분포에 따른 평균으로 수축되며 극단 점수에 선형 외삽하지 않는다. 아래 조건부 환산표를 우선 사용한다. IQ별 평균 점수 곡선을 역으로 뒤집는 것과 E[IQ|Score]는 다르다.

아래는 중심 점수 ±2.5점의 [하한, 상한) 구간에 속한 가상 응시자들의 IQ다. N<100인 구간은 제외했다. 90% 범위는 해당 합성 집단의 분포이며 실제 개인 IQ의 신뢰구간이 아니다.

{table(conv,[('점수 중심','score_center'),('N','n'),('평균 IQ','mean'),('IQ 5백분위','p05'),('IQ 95백분위','p95')])}

## 가정 민감도 (합성·예비)

'''
for r in sensitivity:
    row=next((v for v in r['conversion'] if v['score_center']==60),None)
    report+=f"- {r['name']}: 평균 점수 {r['score']['mean']:.2f}, r={r['correlation']:.3f}; 60±2.5점의 평균 IQ {row['mean']:.2f}\n"
report+='''

난이도 ±0.5는 theta 척도의 변화로 7.5 IQ점에 해당한다. 이 조건들의 차이는 완전한 불확실성 범위가 아니다. 변별도, 속도계수, 모집단 구성 등을 바꾸면 환산값은 더 달라질 수 있다.

## 그래프 해석 및 다음 단계

population.png는 점수 히스토그램에 동일 평균·표준편차의 정규밀도곡선을 겹친 비교 그림이다. 0~100의 유계 점수는 정규분포일 필요가 없으며 곡선을 맞췄다고 정규성이 입증되지 않는다. 정규곡선의 범위 밖 꼬리는 그래프에서 잘린다. relationship.png의 띠는 중앙 90% 분포다.

실사용 환산을 위해서는 목표 연령·언어·모집단을 정하고, 실제 응시자의 문항별 정답 및 응답시간과 적절한 외부 지능검사 결과를 수집해야 한다. 그 자료로 난이도·변별도·시간 모형을 추정하고 별도 검증 표본에서 환산 오차, 신뢰도, 연령 효과와 공정성을 확인해야 한다. 그 전까지 본 환산은 게임/검사 설계용 시나리오로만 취급한다.

## 재현

simulate_iq.py (Python, numpy, matplotlib), results.json (모든 모수·요약), synthetic_population.npz (200,000명 합성자료)를 제공한다. numpy 기본 난수생성기를 사용하며 표본 추출 seed=20260914, 모집단 반응 seed=20260915, 각 IQ 수준 seed=20260914+IQ-10. 이전 모형의 IQ 100과 새 모형의 IQ 110에 같은 난수를 사용하여 기준점 비교의 표집 잡음을 제거했다. sources 폴더는 변경하지 않았다.
'''
(OUT/'report.md').write_text(report,encoding='utf-8')
(OUT/'simulate_iq.py').write_text(Path(__file__).read_text(encoding='utf-8'),encoding='utf-8')
with zipfile.ZipFile(OUT.parent/'synthetic_iq_anchor110_bundle.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in OUT.iterdir(): z.write(p,p.name)
print(json.dumps({k:stats[k] for k in ['population_score','correlation','linear_iq_intercept','linear_iq_slope','linear_rmse']},indent=2))
print(table([r for r in bands if r['iq']%15==10],[('IQ','iq'),('mean','mean'),('p05','p05'),('p95','p95')]))
