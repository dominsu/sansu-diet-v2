// v6 추가 기능만 관리합니다. 기존 app.js 및 friends.js의 기능은 유지합니다.
(() => {
  const byId=id=>document.getElementById(id);
  const welcome=byId('welcome'), app=byId('appMain'), nav=byId('appNav');
  const showWelcome=()=>{
    welcome.classList.remove('hidden');app.classList.add('hidden');nav.classList.add('hidden');
    window.scrollTo(0,0);
  };
  const showApp=(page='home')=>{
    welcome.classList.add('hidden');app.classList.remove('hidden');nav.classList.remove('hidden');
    if(typeof tab==='function' && ['home','history','stats','settings','friends'].includes(page)) tab(page);
    else {
      document.querySelectorAll('#appMain > section').forEach(s=>s.classList.toggle('hidden',s.id!==page));
      document.querySelectorAll('#appNav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===page));
    }
    window.scrollTo(0,0);
  };
  byId('startApp').onclick=()=>showApp('home');
  byId('openGuide').onclick=()=>showApp('guide');

  // 기존 탭 전환 함수가 새 탭을 숨기도록 감싸기
  const originalTab=tab;
  tab=function(name){
    if(name==='guide'||name==='foods'){
      document.querySelectorAll('#appMain > section').forEach(s=>s.classList.toggle('hidden',s.id!==name));
      document.querySelectorAll('#appNav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
    } else {
      byId('guide').classList.add('hidden');
      byId('foods').classList.add('hidden');
      originalTab(name);
    }
  };
  document.querySelectorAll('#appNav button').forEach(b=>b.onclick=()=>tab(b.dataset.tab));

  const render=(target,sections,sectionClass)=>{
    const root=byId(target);
    root.replaceChildren();
    for(const section of sections){
      const wrapper=document.createElement('div');wrapper.className=sectionClass;
      const h=document.createElement('h3');h.textContent=section.title;wrapper.append(h);
      for(const text of (section.paragraphs||section.examples||[])){
        const p=document.createElement('p');p.textContent=text;
        if(sectionClass==='food-section')p.className='food-example';
        wrapper.append(p);
      }
      root.append(wrapper);
    }
  };
  render('guideContent',GUIDE_SECTIONS,'guide-section');
  render('foodContent',FOOD_SECTIONS,'food-section');

  // 기존 저장 데이터와 호환되는 견과류 기록
  let nuts=0;
  const baseLoadDay=loadDay;
  loadDay=function(){
    baseLoadDay();
    const day=byId('day').value;
    nuts=Math.max(0,Number(data[day]?.nuts)||0);
    byId('nutsValue').textContent=nuts;
  };
  const baseSave=byId('save').onclick;
  byId('save').onclick=function(){
    const day=byId('day').value;
    baseSave();
    if(data[day]){
      data[day].nuts=nuts;
      persist();
    }
  };
  byId('nutsMinus').onclick=()=>{nuts=Math.max(0,nuts-1);byId('nutsValue').textContent=nuts;};
  byId('nutsPlus').onclick=()=>{nuts+=1;byId('nutsValue').textContent=nuts;};
  loadDay();

  // 첫 화면은 앱을 다시 열 때마다 표시
  showWelcome();
})();
