// 산수식단 v5 친구 기능: Firebase 연결 후 실제 동작합니다.
import {firebaseConfig} from './firebase-config.js';
const el=id=>document.getElementById(id);
const status=msg=>{el('friendStatus').textContent=msg};
const configured=Object.values(firebaseConfig).every(Boolean);
if(!configured){
  status('친구 화면 준비 완료! 실제 가입·친구 요청은 firebase-config.js에 Firebase 설정을 넣고 웹에 배포한 뒤 사용할 수 있어요.');
  ['friendSignup','friendLogin'].forEach(id=>el(id).onclick=()=>status('Firebase 연결이 필요합니다. firebase-config.js와 보안 규칙을 설정해 주세요.'));
}else{
  try{
    const [{initializeApp},{getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged},{getFirestore,doc,setDoc,getDoc,collection,onSnapshot,writeBatch,deleteDoc,serverTimestamp,query,orderBy,getDocs}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]);
    const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
    let user=null, unsub=[];
    const clean=()=>{unsub.forEach(f=>f());unsub=[]};
    const safe=err=>status('오류: '+(err?.message||err));
    const friendCode=uid=>uid; // UID는 비밀번호가 아니며 공유 식별자로만 사용합니다.
    el('friendSignup').onclick=async()=>{try{await createUserWithEmailAndPassword(auth,el('friendEmail').value.trim(),el('friendPassword').value)}catch(e){safe(e)}};
    el('friendLogin').onclick=async()=>{try{await signInWithEmailAndPassword(auth,el('friendEmail').value.trim(),el('friendPassword').value)}catch(e){safe(e)}};
    el('friendLogout').onclick=()=>signOut(auth).catch(safe);
    el('copyFriendCode').onclick=()=>navigator.clipboard?.writeText(friendCode(user.uid)).then(()=>status('친구 코드를 복사했어요.')).catch(()=>status('코드를 길게 눌러 복사해 주세요.'));
    el('friendRequest').onclick=async()=>{try{
      const other=el('friendCodeInput').value.trim();
      if(!other||other===user.uid)throw Error('다른 사용자의 친구 코드를 입력해 주세요.');
      const profile=await getDoc(doc(db,'profiles',other));
      if(!profile.exists())throw Error('해당 친구 코드를 찾지 못했어요.');
      if((await getDoc(doc(db,'users',user.uid,'friends',other))).exists())throw Error('이미 친구예요.');
      await setDoc(doc(db,'users',other,'requests',user.uid),{from:user.uid,fromName:user.email||'사용자',createdAt:serverTimestamp()});
      status('친구 요청을 보냈어요. 상대방의 승인을 기다려 주세요.');
    }catch(e){safe(e)}};
    function row(container,title,description,buttons){
      const box=document.createElement('div');box.className='friend-item';
      const b=document.createElement('strong');b.textContent=title;box.append(b);
      if(description){const p=document.createElement('p');p.textContent=description;box.append(p)}
      buttons.forEach(([label,fn])=>{const btn=document.createElement('button');btn.textContent=label;btn.onclick=fn;box.append(btn)});container.append(box);
    }
    async function approve(from,fromName){try{
      const batch=writeBatch(db);
      batch.set(doc(db,'users',user.uid,'friends',from),{email:fromName,addedAt:serverTimestamp()});
      batch.set(doc(db,'users',from,'friends',user.uid),{email:user.email||'사용자',addedAt:serverTimestamp()});
      batch.delete(doc(db,'users',user.uid,'requests',from));
      await batch.commit();status('서로 친구가 되었어요!');
    }catch(e){safe(e)}}
    async function removeFriend(other){if(!confirm('친구를 삭제하고 기록 공유를 해제할까요?'))return;try{
      const batch=writeBatch(db);batch.delete(doc(db,'users',user.uid,'friends',other));batch.delete(doc(db,'users',other,'friends',user.uid));await batch.commit();el('friendRecords').textContent='친구를 선택하면 기록이 표시됩니다.';
    }catch(e){safe(e)}}
    async function showFriend(other){try{
      const records=await getDocs(query(collection(db,'users',other,'sharedRecords'),orderBy('date','desc')));
      const target=el('friendRecords');target.replaceChildren();
      if(records.empty){target.textContent='친구가 공유한 기록이 없습니다.';return}
      records.forEach(d=>{const r=d.data();const p=document.createElement('div');p.className='record';p.textContent=`${r.date} · 탄수 ${r.carb??0} · 단백 ${r.protein??0} · 과채 ${r.veg??0} · 견과류 ${r.nuts??0}봉 · 체중 ${r.weight??'-'}kg`;target.append(p)});
    }catch(e){safe(e)}}
    // 앱 기록은 사용자가 명시적으로 동기화해야만 공유합니다.
    const syncBtn=document.createElement('button');syncBtn.className='primary';syncBtn.textContent='내 식단 기록 친구에게 공유/동기화';el('friendSigned').append(syncBtn);
    syncBtn.onclick=async()=>{if(!confirm('현재 기기의 식단 횟수와 체중 기록을 친구에게 공유할까요? 개인 메모는 제외됩니다.'))return;try{
      const local=JSON.parse(localStorage.getItem('sansu-diet-v1')||'{}');
      const batchSize=200,items=Object.entries(local);
      // 삭제된 기록은 클라우드에도 반영합니다.
      const existing=await getDocs(collection(db,'users',user.uid,'sharedRecords'));
      const existingIds=new Set(existing.docs.map(d=>d.id));
      const operations=[];
      for(const d of existingIds)if(!Object.hasOwn(local,d))operations.push(['delete',d]);
      for(const [date,r] of items)operations.push(['set',date,{date,carb:Number(r.carb)||0,protein:Number(r.protein)||0,veg:Number(r.veg)||0,nuts:Number(r.nuts)||0,weight:r.weight===null||r.weight===''?null:Number(r.weight)}]);
      for(let i=0;i<operations.length;i+=batchSize){const batch=writeBatch(db);for(const [action,date,value] of operations.slice(i,i+batchSize)){const ref=doc(db,'users',user.uid,'sharedRecords',date);if(action==='delete')batch.delete(ref);else batch.set(ref,value)}await batch.commit()}
      status('식단 기록 공유를 완료했어요. 변경 후에는 다시 동기화해 주세요.');
    }catch(e){safe(e)}};
    onAuthStateChanged(auth,async u=>{clean();user=u;el('authPanel').classList.toggle('hidden',!!u);el('friendSigned').classList.toggle('hidden',!u);if(!u){status('로그인하면 친구 요청을 이용할 수 있어요.');return}
      el('myFriendCode').textContent=friendCode(u.uid);el('myFriendEmail').textContent=u.email||'';
      try{await setDoc(doc(db,'profiles',u.uid),{uid:u.uid},{merge:true})}catch(e){safe(e)}
      status('로그인 완료. 친구 코드를 공유하거나 요청을 보내세요.');
      unsub.push(onSnapshot(collection(db,'users',u.uid,'requests'),snap=>{const target=el('incomingRequests');target.replaceChildren();if(snap.empty)target.textContent='받은 요청이 없습니다.';snap.forEach(d=>row(target,d.data().fromName||'사용자','친구 요청',[['수락',()=>approve(d.id,d.data().fromName)],['거절',()=>deleteDoc(d.ref).catch(safe)]]))},safe));
      unsub.push(onSnapshot(collection(db,'users',u.uid,'friends'),snap=>{const target=el('friendList');target.replaceChildren();if(snap.empty)target.textContent='아직 친구가 없습니다.';snap.forEach(d=>row(target,d.data().email||'친구','상호 공유 중',[['기록 보기',()=>showFriend(d.id)],['친구 삭제',()=>removeFriend(d.id)]]))},safe));
    });
  }catch(e){status('Firebase 모듈을 불러오지 못했어요. 인터넷 연결 및 HTTPS 배포 주소를 확인해 주세요. '+e.message)}
}
