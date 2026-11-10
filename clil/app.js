'use strict';
const initialUiLanguage=uiLanguage;uiLanguage='ko';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy = value => JSON.parse(JSON.stringify(value));
const colors = ['#e8dcc9','#e3def0','#d7e7dc','#f0dce0','#e6e7ca','#d9e3ee'];
let participation = {quiet:T('조용히, 지명하면 참여'),balanced:T('상황에 따라 참여'),active:T('적극적으로 참여')};

let classroom = {schema_version:'1.3',title:initialUiLanguage==='en'?'Our little classroom':'우리의 작은 교실',target_language:'한국어',grade:2,subject:'통합교과',lesson:'',concepts:['수업 학습 내용'],students:[]};
const originalLabels={participation:{...participation}};
uiLanguage=initialUiLanguage;
let selected = 0;
let step = 1;
let session = null;
let sessionId=null;
let conversation = [];
let transcript = [];
let responders = [];
let mode = 'live';
let sending = false;
let toastTimer;

function student(index) {
  return {id:crypto.randomUUID(),name:`${T('학생')} ${index+1}`,age:8,home_language:'',exposure:'',target_language_learning_months:null,comprehension_level:'A1',production_level:'A1',interaction_level:'A1',language_strategy:'target_primary',participation:'balanced',traits:'',notes:'',knowledge:classroom.concepts.map(concept=>({concept,solo_level:'',performance_description:'',misconception:''}))};
}
classroom.students = Array.from({length:4},(_,i)=>student(i));

function toast(message) {
  $('toast').textContent = T(message);
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{$('toast').hidden=true;},5000);
}
function avatar(s,index) {
  return `<span class="avatar" style="--avatar:${colors[index%colors.length]}">${esc([...s.name][0] || '?')}</span>`;
}
function selectValue(id,value,otherId,wrapId) {
  const select=$(id);
  const known=[...select.options].some(o=>o.value===value && o.value!=='custom');
  select.value=known?value:'custom';
  $(wrapId).hidden=known;
  $(otherId).value=known?'':value;
}
function fillEnvironment() {
  $('classTitle').value=classroom.title;
  $('classGrade').value=String(classroom.grade);
  $('classLesson').value=classroom.lesson;
  $('classConcepts').value=classroom.concepts[0]==='수업 학습 내용'?'':classroom.concepts[0];
  $('studentCount').value=classroom.students.length;
  selectValue('targetLanguage',classroom.target_language,'customLanguage','customLanguageWrap');
  selectValue('classSubject',classroom.subject,'customSubject','customSubjectWrap');
}
function syncEnvironment() {
  const title=$('classTitle').value.trim();
  const lang=$('targetLanguage').value==='custom'?$('customLanguage').value.trim():$('targetLanguage').value;
  const subject=$('classSubject').value==='custom'?$('customSubject').value.trim():$('classSubject').value;
  const count=Number($('studentCount').value);
  const concepts=[$('classConcepts').value.trim() || '수업 학습 내용'];
  if(!title || !lang || !subject) throw new Error(T('수업 이름·언어·교과를 입력해 주세요.'));
  if(!Number.isInteger(count)||count<1||count>30) throw new Error(T('학생 수는 1~30명으로 입력해 주세요.'));
  if(concepts[0].length>120) throw new Error(uiLanguage==='en'?'Keep the learning content within 120 characters.':'학습 내용은 120자 이내로 입력해 주세요.');
  if(count<classroom.students.length && !confirm(uiLanguage==='en'?`Delete the last ${classroom.students.length-count} student profiles?`:`마지막 ${classroom.students.length-count}명의 학생 설정을 삭제할까요?`)) return false;
  Object.assign(classroom,{title,target_language:lang,grade:Number($('classGrade').value),subject,lesson:$('classLesson').value.trim(),concepts});
  if(count<classroom.students.length) classroom.students=classroom.students.slice(0,count);
  while(classroom.students.length<count) classroom.students.push(student(classroom.students.length));
  for(const s of classroom.students) s.knowledge=[{...(s.knowledge[0]||{solo_level:'',performance_description:'',misconception:''}),concept:concepts[0]}];
  selected=Math.min(selected,classroom.students.length-1);
  return true;
}
function showStep(value) {
  step=value;
  for(let i=1;i<=3;i++) $('stage'+i).hidden=i!==value;
  document.querySelectorAll('.step').forEach(button=>{
    const active=Number(button.dataset.step)===value;
    button.classList.toggle('active',active);
    if(active) button.setAttribute('aria-current','step'); else button.removeAttribute('aria-current');
  });
  window.scrollTo({top:0,behavior:'instant'});
}
function field(label,key,value,options={}) {
  return `<label class="${options.full?'full':''}">${esc(T(label))}<input data-field="${key}" value="${esc(value)}" ${options.type==='number'?'type="number" min="5" max="19"':'type="text"'} maxlength="${options.max||500}" ${options.placeholder?`placeholder="${esc(T(options.placeholder))}"`:''}></label>`;
}
function renderRoster() {
  $('rosterCount').textContent=`${classroom.students.length}${uiLanguage==='en'?' students':'명'}`;
  $('studentList').innerHTML=classroom.students.map((s,i)=>`<button class="student-item ${i===selected?'selected':''}" data-student="${i}" aria-pressed="${i===selected}">${avatar(s,i)}<span><strong><span data-user-content>${esc(s.name)}</span></strong><small>${ageLabel(s.age)} · ${esc('Production '+s.production_level)}</small></span><span class="arrow">↗</span></button>`).join('');
  $('studentList').querySelectorAll('[data-student]').forEach(button=>button.addEventListener('click',()=>{
    selected=Number(button.dataset.student);renderRoster();renderEditor();
  }));
  $('profileStatus').textContent=`${T(classroom.target_language)} · ${T(classroom.subject)} · ${uiLanguage==='en'?classroom.students.length+' students':classroom.students.length+'명의 학생'}`;
}
function levelControl(domain,title,s) {
  const key=domain+'_level';const level=s[key];
  return `<div class="level-card"><label for="level-${domain}">${title}</label><select id="level-${domain}" data-cefr="${key}">${CEFR.levels.map(v=>`<option value="${v}" ${v===level?'selected':''}>${v}</option>`).join('')}</select><p class="level-description">${esc(CEFR.descriptors[domain][level][uiLanguage])}</p><small class="muted">${esc(CEFR.source.scales[domain])}</small></div>`;
}
function languageUseOptions() {
  return [['target_only',uiLanguage==='en'?'Target language only':'목표 언어만 사용'],
    ['target_primary',uiLanguage==='en'?'Mainly target language':'목표 언어 중심'],
    ['mixed_language',uiLanguage==='en'?'Flexible use of both languages':'두 언어를 유연하게 사용'],
    ['home_primary',uiLanguage==='en'?'Mainly home language':'모국어 중심']];
}
function languageUseHint(s) {
  if(s.language_strategy!=='target_only'&&!s.home_language.trim())return uiLanguage==='en'?'Enter a home language above to enable its use. Without one, the student uses the target language.':'모국어를 활용하려면 위에 모국어를 입력하세요. 미입력 시 목표 언어를 사용합니다.';
  return uiLanguage==='en'?'Language choice is separate from target-language proficiency. Home-language-centered students explain mainly in their home language.':'언어 선택은 목표 언어 숙달도와 별개입니다. 모국어 중심 학생은 주로 모국어로 설명합니다.';
}
function renderEditor() {
  const s=classroom.students[selected];
  $('studentEditor').innerHTML=H(`<div class="editor-heading">${avatar(s,selected)}<div><h2 id="editorName"><span data-user-content>${esc(s.name)}</span>${T('의 프로필')}</h2><p>성격과 언어 능력, 교과 지식은 각각 설정해요.</p></div></div>
  <section class="editor-section"><h3>01 &nbsp; ${T('어떤 학생인가요?')}</h3><div class="form-grid">${field('이름','name',s.name,{max:60})}${field('나이','age',s.age,{type:'number'})}${field('모국어·가정에서 쓰는 언어','home_language',s.home_language,{max:120,placeholder:'예: 우즈베크어, 러시아어'})}<label>${esc(T(classroom.target_language))} ${uiLanguage==='en'?'learning duration (months) · optional':'학습 기간 (개월) · 선택'}<input type="number" data-field="target_language_learning_months" min="0" max="${s.age*12}" step="1" value="${esc(s.target_language_learning_months??'')}" placeholder="${uiLanguage==='en'?'Leave blank if unspecified':'미지정이면 비워 두세요'}"><small>${uiLanguage==='en'?'Background only; does not set proficiency automatically.':'선택적인 배경 정보이며 숙달도를 자동 결정하지 않습니다.'}</small></label>${field(uiLanguage==='en'?'Language experience / use at home and school · optional':'언어 경험·가정 및 학교에서의 사용 · 선택','exposure',s.exposure,{placeholder:uiLanguage==='en'?'e.g. Korean at school, Vietnamese at home':'예: 학교에서는 한국어, 가정에서는 베트남어'})}<label>수업 참여 성향<select data-field="participation">${Object.entries(participation).map(([k,v])=>`<option value="${k}" ${s.participation===k?'selected':''}>${v}</option>`).join('')}</select></label>${field('성격·관심사','traits',s.traits,{placeholder:'예: 호기심이 많고 그림을 좋아함'})}<label class="full">${uiLanguage==='en'?'Language use':'Language use · 언어 사용'}<select data-field="language_strategy">${languageUseOptions().map(([key,label])=>`<option value="${key}" ${s.language_strategy===key?'selected':''}>${label}</option>`).join('')}</select><small id="languageUseHint">${esc(languageUseHint(s))}</small></label></div></section>
  <section class="editor-section"><h3>02 &nbsp; ${T('사용 언어')}: <span data-user-content>${esc(T(classroom.target_language))}</span></h3><p class="section-description">${uiLanguage==='en'?'Select a target level for each area using CEFR descriptor summaries. These settings are not certified scores. This is a text simulation of classroom talk; audio and gestures are not evaluated.':'CEFR 기술문 요약에 따라 영역별 목표 수준을 선택합니다. 인증된 점수가 아니며, 교실 구어를 텍스트로 시뮬레이션합니다. 음성·몸짓은 평가하지 않습니다.'}</p><div class="form-grid cefr-grid">${levelControl('comprehension',uiLanguage==='en'?'Comprehension':'Comprehension · 이해',s)}${levelControl('production',uiLanguage==='en'?'Production':'Production · 산출',s)}${levelControl('interaction',uiLanguage==='en'?'Interaction':'Interaction · 상호작용',s)}</div><a class="cefr-source" href="${CEFR.source.url}" target="_blank" rel="noopener">${uiLanguage==='en'?'Source: Council of Europe (2020), pp.62, 72–73 ↗':'근거: Council of Europe (2020), pp.62, 72–73 ↗'}</a></section>
  <section class="editor-section"><h3>03 &nbsp; ${uiLanguage==='en'?'Subject understanding':'학습 내용 이해'}</h3><p class="section-description">${uiLanguage==='en'?'Choose one SOLO level for this lesson’s learning content. Both text fields are optional.':'이번 수업의 학습 내용에 대한 SOLO 수준을 하나 선택하세요. 두 설명란은 모두 선택 입력입니다.'}</p>${s.knowledge.length?s.knowledge.map((k,i)=>`<div class="solo-card"><div class="solo-heading"><h4>${uiLanguage==='en'?'Subject understanding':'교과목 이해도'}</h4><label for="knowledge-${i}">${uiLanguage==='en'?'SOLO level · required':'SOLO 수준 · 필수'}<select id="knowledge-${i}" data-knowledge="${i}" aria-label="${uiLanguage==='en'?'Subject understanding SOLO':'교과목 이해도 SOLO'}"><option value="">${uiLanguage==='en'?'Choose a SOLO level':'SOLO 수준 선택'}</option>${Object.entries(SOLO.levels).map(([key,v])=>`<option value="${key}" ${key===k.solo_level?'selected':''}>${esc(v[uiLanguage])}</option>`).join('')}</select></label></div><p class="solo-description" id="solo-description-${i}">${k.solo_level?esc(SOLO.levels[k.solo_level].description[uiLanguage]):(uiLanguage==='en'?'Select a level to see its meaning.':'수준을 선택하면 해당 기준이 표시됩니다.')}</p><div class="form-grid"><label>${uiLanguage==='en'?'Specific performance · optional':'구체적인 수행 설명 · 선택'}<textarea data-performance="${i}" maxlength="1000" rows="3" placeholder="${uiLanguage==='en'?'What does this student know or do in this lesson? Leave blank to use the lesson context and SOLO level.':'이번 수업에서 알고 있거나 할 수 있는 것을 적어 주세요. 비워두면 수업 맥락과 SOLO 수준을 따릅니다.'}">${esc(k.performance_description)}</textarea></label><label>${uiLanguage==='en'?'Misconceptions / difficulties · optional':'오개념·어려움 · 선택'}<textarea data-misconception="${i}" maxlength="1000" rows="3" placeholder="${uiLanguage==='en'?'Describe a specific misconception or difficulty, if any. None is assigned when blank.':'설정할 오개념이나 어려움이 있을 때만 입력하세요. 비워두면 특정 오개념을 부여하지 않습니다.'}">${esc(k.misconception)}</textarea></label></div></div>`).join(''):`<p class="muted">${uiLanguage==='en'?'Add learning items in classroom settings to configure subject understanding.':'수업 환경에서 학습 내용을 추가하면 이해 수준을 설정할 수 있습니다.'}</p>`}<a class="cefr-source" href="${SOLO.source.url}" target="_blank" rel="noopener">${uiLanguage==='en'?'Source: Biggs & Collis (1982), SOLO taxonomy ↗':'근거: Biggs & Collis (1982), SOLO taxonomy ↗'}</a></section>
  <section class="editor-section"><h3>04 &nbsp; ${T('추가로 기억할 내용')}</h3><label>학습 지원·학생 특성<textarea data-field="notes" maxlength="1000" rows="2" placeholder="예: 먼저 예시를 보여 주면 참여하기 편해함">${esc(s.notes)}</textarea></label></section>
  <div class="profile-preview"><strong>현재 설정의 의미</strong><p id="profilePreview"></p></div>`);
  $('studentEditor').querySelectorAll('[data-field]').forEach(input=>input.addEventListener('input',()=>{
    const key=input.dataset.field;
    s[key]=key==='target_language_learning_months'?(input.value===''?null:Number(input.value)):key==='age'?Number(input.value):input.value;
    if(key==='language_strategy'||key==='home_language')$('languageUseHint').textContent=languageUseHint(s);
    $('editorName').textContent=`${s.name || T('학생')}${T('의 프로필')}`;
    renderRoster();renderProfilePreview();
  }));
  $('studentEditor').querySelectorAll('[data-cefr]').forEach(input=>input.addEventListener('change',()=>{
    s[input.dataset.cefr]=input.value;renderRoster();renderEditor();
  }));
  $('studentEditor').querySelectorAll('[data-knowledge]').forEach(input=>input.addEventListener('change',()=>{
    const i=Number(input.dataset.knowledge);s.knowledge[i].solo_level=input.value;
    $('solo-description-'+i).textContent=input.value?SOLO.levels[input.value].description[uiLanguage]:(uiLanguage==='en'?'Select a level to see its meaning.':'수준을 선택하면 해당 기준이 표시됩니다.');
    renderProfilePreview();
  }));
  for(const [attr,key] of [['performance','performance_description'],['misconception','misconception']])$('studentEditor').querySelectorAll('[data-'+attr+']').forEach(input=>input.addEventListener('input',()=>{s.knowledge[Number(input.dataset[attr])][key]=input.value;}));
  renderProfilePreview();
}
function renderProfilePreview() {
  const s=classroom.students[selected];
  $('profilePreview').textContent=`${s.name || T('학생')} · ${ageLabel(s.age)}. ${uiLanguage==='en'?'Comprehension':'이해'} ${s.comprehension_level} / ${uiLanguage==='en'?'Production':'산출'} ${s.production_level} / ${uiLanguage==='en'?'Interaction':'상호작용'} ${s.interaction_level}. Language use: ${languageUseOptions().find(([key])=>key===s.language_strategy)?.[1]||''}. ${s.knowledge.map(k=>`${uiLanguage==='en'?'Subject understanding':'교과 이해'}: ${k.solo_level?SOLO.levels[k.solo_level][uiLanguage]:(uiLanguage==='en'?'Not selected':'미선택')}`).join(' / ')}`;
}
async function validated(config) {
  return CLILBrowser.validate(config);
}

async function startClass() {
  if(sending)return;
  $('startClass').disabled=true;
  try {
    const missing=classroom.students.findIndex(s=>s.knowledge.some(k=>!k.solo_level));
    if(missing>=0){selected=missing;renderRoster();renderEditor();throw new Error(uiLanguage==='en'?`Choose a SOLO level for each learning item for ${classroom.students[missing].name}. Both descriptions may be left blank.`:`${classroom.students[missing].name}의 학습 내용별 SOLO 수준을 선택해 주세요. 두 설명란은 비워도 됩니다.`);}
    classroom=await validated(classroom);
    session=copy(classroom);sessionId=crypto.randomUUID();conversation=[];transcript=[];responders=[];
    renderChat();showStep(3);
  } catch(error){toast(error.message);} finally{$('startClass').disabled=false;}
}
function renderChat() {
  $('chatTitle').textContent=session.title;
  $('chatSubtitle').textContent=`${T(session.target_language)} · ${T(session.subject)} · ${uiLanguage==='en'?'Grade '+session.grade:session.grade+'학년'} · ${session.students.length}${uiLanguage==='en'?' students':'명의 학생'}${session.lesson?' / '+session.lesson:''}`;
  $('chatRoster').innerHTML=session.students.map((s,i)=>`<label class="responder">${avatar(s,i)}<span><strong><span data-user-content>${esc(s.name)}</span></strong><small>${ageLabel(s.age)} · ${esc('Production '+s.production_level)}</small></span><input type="checkbox" data-responder="${esc(s.id)}" aria-label="${esc(s.name)} ${uiLanguage==='en'?'responds':'응답 선택'}"></label>`).join('');
  $('chatRoster').querySelectorAll('[data-responder]').forEach(input=>input.addEventListener('change',()=>{
    responders=[...$('chatRoster').querySelectorAll('input:checked')].map(el=>el.dataset.responder);
  }));
  $('conversation').innerHTML=`<div class="empty-chat"><div class="empty-icon">✳</div><h3>${uiLanguage==='en'?'Your classroom is ready.':'나만의 교실이 준비되었어요.'}</h3><p>${mode==='live'?(uiLanguage==='en'?'Choose a provider and model, enter its API key above, then say hello to your students.':'위에서 제공사와 모델을 선택하고 해당 API 키를 입력한 뒤 학생들에게 첫 인사를 건네 보세요.'):(uiLanguage==='en'?'Interface preview only. Choose Live AI for classroom dialogue.':'화면 확인 전용입니다. 수업 대화는 실제 AI 대화를 선택하세요.')}</p></div>`;
  $('teacherMessage').value='';$('chatError').hidden=true;updateConnection();
}
function addMessage(entry) {
  const box=$('conversation');box.querySelector('.empty-chat')?.remove();
  const div=document.createElement('div');
  if(entry.role==='system') {
    div.className='system-message';div.textContent=entry.content;
  } else {
    const isTeacher=entry.role==='user';
    const s=isTeacher?null:session.students.find(x=>x.id===entry.student_id);
    const i=s?session.students.indexOf(s):0;
    div.className='chat-message'+(isTeacher?' teacher':'');
    const av=isTeacher?`<span class="avatar">${T('나')}</span>`:avatar(s||{name:entry.name||T('학생')},i);
    const badge=entry.mode==='demo'?' · '+T('예시 응답'):'';
    div.innerHTML=`${av}<div class="message-body"><div class="message-meta"><span>${esc(isTeacher?T('선생님'):entry.name)}${badge}</span><small>${esc(new Date(entry.time).toLocaleTimeString(uiLanguage==='en'?'en-US':'ko-KR',{hour:'2-digit',minute:'2-digit'}))}</small></div><div class="bubble"></div></div>`;
    div.querySelector('.bubble').textContent=entry.content;
  }
  box.appendChild(div);
  if(entry.role==='user' && entry.response_status==='no_response')addMessage({role:'system',content:T('이번 차례에는 말로 응답한 학생이 없습니다. 기다리거나, 다시 질문하거나, 학생을 지명해 보세요.')});
  box.scrollTop=box.scrollHeight;return div;
}
function setMode(nextMode) {
  if(sending || nextMode===mode)return;
  if(conversation.length && !confirm(T('대화 모드를 바꾸면 현재 대화가 초기화됩니다. 필요한 경우 먼저 저장해 주세요.')))return;
  mode=nextMode;
  $('demoMode').classList.toggle('active',mode==='demo');$('liveMode').classList.toggle('active',mode==='live');
  $('demoMode').setAttribute('aria-pressed',String(mode==='demo'));$('liveMode').setAttribute('aria-pressed',String(mode==='live'));
  $('liveSettings').hidden=mode!=='live';
  updateConnection();
  conversation=[];transcript=[];
  if(session)renderChat();
}
function syncModelSelection() {
  $('modelName').value=$('modelPreset').value;
  $('modelIdDisplay').textContent=`API ID: ${$('modelName').value}`;
}
function syncProvider(clearKey=false) {
  const provider=MODELS[$('providerPreset').value];
  if(clearKey)$('apiKey').value='';
  $('modelPreset').replaceChildren(...provider.models.map(m=>new Option(m.name,m.id)));
  syncModelSelection();
  updateConnection();
}
$('modelPreset').addEventListener('change',syncModelSelection);
$('providerPreset').addEventListener('change',()=>syncProvider(true));
syncProvider();

function updateConnection() {
  const live=mode==='live';const ready=Boolean($('apiKey').value.trim());
  const provider=MODELS[$('providerPreset').value];
  $('apiKeyLabel').textContent=`${provider.name} API key`;
  $('apiKey').placeholder=provider.placeholder;
  $('apiKeyLink').href=provider.key_url;
  $('apiKeyHint').textContent=uiLanguage==='en'?`Browser-direct trial: your key and classroom messages are sent directly to ${provider.name}, without Render. The key stays in page memory and is excluded from saved files. Switching provider clears it.`:`브라우저 직접 실행 시험판: 키와 수업 대화는 Render를 거치지 않고 ${provider.name}에 직접 전송됩니다. 키는 현재 화면 메모리에만 유지되며 저장 파일에는 포함되지 않습니다. 제공사를 바꾸면 초기화됩니다.`;
  $('liveSettings').hidden=!live;
  $('demoMode').classList.toggle('active',!live);$('liveMode').classList.toggle('active',live);
  $('demoMode').setAttribute('aria-pressed',String(!live));$('liveMode').setAttribute('aria-pressed',String(live));
  $('modeBadge').textContent=live?(ready?(uiLanguage==='en'?'API key entered':'API 키 입력됨'):(uiLanguage==='en'?'API key required':'API 키 연결 필요')):(uiLanguage==='en'?'No AI':'AI 미연결');
  $('modeDescription').textContent=live?(uiLanguage==='en'?'Students use their CEFR, SOLO and language-use settings to respond to your message and classroom history. Enter the selected provider’s API key below. Each responding student requires an API call.':'학생들은 CEFR·SOLO·언어 사용 설정과 교실 대화 이력을 바탕으로 응답합니다. 아래에 선택한 제공사의 API 키를 입력하세요. 응답 학생마다 API 호출이 발생합니다.'):(uiLanguage==='en'?'Interface preview only. Chat is disabled here; use Live AI for classroom dialogue.':'화면 확인 전용입니다. 여기서는 대화하지 않습니다. 수업 대화는 실제 AI 대화 모드를 이용하세요.');
  if(!sending){$('teacherMessage').disabled=!live;$('sendMessage').disabled=!live;}
}
$('apiKey').addEventListener('input',updateConnection);

function busy(value) {
  sending=value;
  ['uiLanguage','sendMessage','teacherMessage','demoMode','liveMode','newChat','editClass','importBtn','importFile','startClass','backEnvironment','toStudents','countUp','countDown','modelName','modelPreset','providerPreset','apiKey','clearResponders'].forEach(id=>{$(id).disabled=value;});
  document.querySelectorAll('.step,[data-responder]').forEach(el=>{el.disabled=value;});
  $('sendMessage').textContent=value?T('응답 기다리는 중…'):T('보내기 ↑');
  if(!value)updateConnection();
}
async function send(event) {
  event?.preventDefault();if(sending || !session)return;
  const text=$('teacherMessage').value.trim();if(!text)return;
  if(mode==='demo'){toast(uiLanguage==='en'?'Preview has no AI conversation. Select Live AI and enter an API key.':'미리보기에서는 대화하지 않습니다. 실제 AI 대화를 선택하고 API 키를 입력해 주세요.');return;}
  if(transcript.filter(m=>m.role==='user').length>=100){toast(T('대화가 길어졌습니다. 기록을 저장한 뒤 새 대화를 시작해 주세요.'));return;}
  if(mode==='live' && !$('apiKey').value.trim()){toast(T('실제 AI 대화를 위해 API 키를 입력해 주세요.'));$('apiKey').focus();return;}
  if(mode==='live' && !$('modelName').value.trim()){toast(T('사용할 모델 이름을 입력해 주세요.'));return;}
  $('chatError').hidden=true;busy(true);
  const turnProvider=mode==='live'?$('providerPreset').value:null;
  const turnModel=mode==='live'?$('modelName').value.trim():null;
  const entry={provider:turnProvider,model:turnModel,role:'user',name:'Teacher',content:text,time:new Date().toISOString(),mode};
  const pendingUser=addMessage(entry);$('teacherMessage').value='';
  const loading=addMessage({role:'system',content:T('학생들이 생각하고 있어요…')});
  const nextHistory=[...conversation,{role:'user',content:text}];
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),240000);
  try {
    const body=await CLILBrowser.chat({classroom:session,conversation:nextHistory,classroom_turns:[...transcript,entry].slice(-800).map(m=>({role:m.role,content:m.content,student_id:m.student_id||null})),mode,provider:$('providerPreset').value,api_key:$('apiKey').value.trim(),model:$('modelName').value.trim(),responder_ids:responders},controller.signal);
    loading.remove();conversation=nextHistory;
    entry.response_status=body.response_status || (body.replies.length?'responded':'no_response');
    entry.responding_student_ids=body.replies.map(r=>r.student_id);
    entry.execution_mode=body.execution_mode;
    entry.generation_settings=body.generation_settings;
    entry.participation_policy=body.participation_policy||null;
    transcript.push(entry);
    const replies=[];
    for(const r of body.replies){const message={execution_mode:'browser-direct',provider:turnProvider,generation_settings:body.generation_settings,model:turnModel,role:'assistant',student_id:r.student_id,name:r.name,content:r.text,time:new Date().toISOString(),mode};addMessage(message);transcript.push(message);replies.push(`[${r.name}]: ${r.text}`);}
    if(replies.length)conversation.push({role:'assistant',content:replies.join('\n')});
    else addMessage({role:'system',content:T('이번 차례에는 말로 응답한 학생이 없습니다. 기다리거나, 다시 질문하거나, 학생을 지명해 보세요.')});
  } catch(error) {
    loading.remove();pendingUser.remove();$('teacherMessage').value=text;
    $('chatError').textContent=error.name==='AbortError'?T('응답 시간이 초과되었습니다. 입력은 복원되었습니다. 다시 시도해 주세요.'):error.message;
    $('chatError').hidden=false;
  } finally{clearTimeout(timeout);busy(false);$('teacherMessage').focus();}
}
function downloadText(name,text,type) {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function download(name,data) {downloadText(name,JSON.stringify(data,null,2),'application/json;charset=utf-8');}
async function exportConfig() {
  if(sending){toast(T('응답이 끝난 뒤 설정을 저장해 주세요.'));return;}
  try {
    if(step===1 && !syncEnvironment())return;
    const clean=await validated(classroom);
    download('clil-classroom-settings.json',clean);toast(T('학생 설정을 저장했습니다. API 키는 포함하지 않습니다.'));
  } catch(error){toast(error.message);}
}
async function importConfig(event) {
  const file=event.target.files[0];if(!file)return;
  try {
    if(file.size>1000000)throw new Error(T('설정 파일은 1MB 이하로 선택해 주세요.'));
    const raw=JSON.parse(await file.text());
    const incoming=raw.classroom || raw;
    if(incoming.students?.some(s=>!s.comprehension_level||!s.production_level||!s.interaction_level)){
      if(!confirm(uiLanguage==='en'?'Legacy numeric levels cannot be equated to CEFR. Import the other settings and initialize all three language targets to A1 for you to review?':'기존 숫자 수준은 CEFR과 동등하게 환산할 수 없습니다. 나머지 설정을 불러오고 세 언어 목표를 A1로 초기화하여 직접 검토할까요?'))return;
      for(const s of incoming.students){s.comprehension_level='A1';s.production_level='A1';s.interaction_level='A1';delete s.understanding;delete s.expression;}
    }
    if(incoming.students?.some(s=>s.knowledge?.some(k=>!k.solo_level))){
      if(!confirm(uiLanguage==='en'?'Previous subject states have no equivalent SOLO level. Initialize them to Prestructural for manual review and keep the old state/notes in the optional descriptions?':'기존 교과 상태를 SOLO로 동등하게 환산할 수 없습니다. 전구조적으로 초기화하여 직접 검토하고, 이전 상태·메모는 선택 설명란에 보관할까요?'))return;
      for(const s of incoming.students)for(const k of s.knowledge||[])if(!k.solo_level){k.solo_level='prestructural';k.performance_description=`[Legacy state: ${k.state||'unspecified'}; review SOLO] ${k.state==='misconception'?'':k.note||''}`;k.misconception=k.state==='misconception'?(k.note||''):'';delete k.state;delete k.note;}
    }
    const singleContent=(incoming.concepts||[])[0]||'수업 학습 내용';
    const collapsed=incoming.students?.some(s=>(s.knowledge||[]).length>1);
    incoming.concepts=[singleContent];
    for(const s of incoming.students||[])s.knowledge=[{...(s.knowledge?.[0]||{solo_level:'prestructural',performance_description:'',misconception:''}),concept:singleContent}];
    incoming.schema_version='1.3';
    const clean=await validated(incoming);
    if(conversation.length && !confirm(T('설정을 불러오면 현재 대화가 초기화됩니다. 계속할까요?')))return;
    classroom=clean;selected=0;session=null;conversation=[];transcript=[];responders=[];
    fillEnvironment();renderRoster();renderEditor();showStep(2);toast(collapsed?(uiLanguage==='en'?'Imported the first subject profile into the single SOLO card. Please review it.':'첫 번째 교과 설정을 단일 SOLO 카드로 불러왔습니다. 내용을 검토해 주세요.'):T('수업과 학생 설정을 불러왔습니다.'));
  } catch(error){toast(T('불러오기 실패: ')+error.message);} finally{event.target.value='';}
}
function editSettings(target=2) {
  if(sending)return;
  if(step===3 && conversation.length && !confirm(T('설정을 수정하면 현재 대화를 초기화합니다. 필요한 경우 먼저 대화를 저장해 주세요.')))return;
  session=null;conversation=[];transcript=[];responders=[];
  fillEnvironment();renderRoster();renderEditor();showStep(target);
}


const staticText=[]; const staticAttributes=[];
const initialWalker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
while(initialWalker.nextNode()) {
  const n=initialWalker.currentNode;
  if(!n.parentElement?.closest('script,style,textarea,[data-user-content]'))staticText.push([n,n.textContent]);
}
for(const el of document.querySelectorAll('[aria-label],[placeholder],[title]'))for(const attr of ['aria-label','placeholder','title'])if(el.hasAttribute(attr))staticAttributes.push([el,attr,el.getAttribute(attr)]);
function ageLabel(age) {return uiLanguage==='en'?`Age ${age}`:`${age}세`;}
function refreshLanguageLabels() {
  participation=Object.fromEntries(Object.entries(originalLabels.participation).map(([k,v])=>[k,T(v)]));
}
function changeLanguage(next,initial=false) {
  if(sending)return;
  // Inputs synchronize on edit; never translate user-entered data or reset the conversation.
  uiLanguage=next==='ko'?'ko':'en';
  document.documentElement.lang=uiLanguage;document.title=T('CLIL Studio · 나만의 교실 만들기');
  for(const [n,source] of staticText) {const key=source.trim();n.textContent=source.replace(key,T(key));}
  for(const [el,attr,source] of staticAttributes)el.setAttribute(attr,T(source));
  $('uiLanguage').value=uiLanguage;
  $('sendMessage').textContent=T(sending?'응답 기다리는 중…':'보내기 ↑');
  refreshLanguageLabels();
  for(const option of $('classGrade').options){const i=Number(option.value);option.textContent=uiLanguage==='en'?`Grade ${i}`:i<=6?`초등 ${i}학년`:i<=9?`중등 ${i-6}학년`:`고등 ${i-9}학년`;}
  if(step===2){renderRoster();renderEditor();}
  if(session&&step===3){
    const draft=$('teacherMessage').value;const chosen=[...responders];
    renderChat();responders=chosen;
    for(const input of $('chatRoster').querySelectorAll('input'))input.checked=responders.includes(input.dataset.responder);
    for(const entry of transcript)addMessage(entry);
    $('teacherMessage').value=draft;
  }
  updateConnection();
  $('toast').hidden=true;
}
for(let i=1;i<=12;i++){$('classGrade').add(new Option(i<=6?`초등 ${i}학년`:i<=9?`중등 ${i-6}학년`:`고등 ${i-9}학년`,i));}
fillEnvironment();
$('targetLanguage').addEventListener('change',()=>{$('customLanguageWrap').hidden=$('targetLanguage').value!=='custom';});
$('classSubject').addEventListener('change',()=>{$('customSubjectWrap').hidden=$('classSubject').value!=='custom';});
for(const [id,delta] of [['countDown',-1],['countUp',1]])$(id).addEventListener('click',()=>{$('studentCount').value=Math.min(30,Math.max(1,(Number($('studentCount').value)||1)+delta));});
$('toStudents').addEventListener('click',()=>{try{if(syncEnvironment()){renderRoster();renderEditor();showStep(2);}}catch(error){toast(error.message);}});
$('backEnvironment').addEventListener('click',()=>{fillEnvironment();showStep(1);});
$('startClass').addEventListener('click',startClass);
$('editClass').addEventListener('click',()=>editSettings(2));
document.querySelectorAll('.step').forEach(button=>button.addEventListener('click',()=>{
  if(sending)return;const target=Number(button.dataset.step);if(target===step)return;
  if(target===3){if(step===1){toast(T('먼저 학생 프로필을 설정해 주세요.'));return;}startClass();return;}
  if(step===3){editSettings(target);return;}
  if(target===2){$('toStudents').click();return;}
  fillEnvironment();showStep(1);
}));
$('demoMode').addEventListener('click',()=>setMode('demo'));
$('liveMode').addEventListener('click',()=>setMode('live'));
$('chatForm').addEventListener('submit',send);
$('teacherMessage').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send();}});
$('clearResponders').addEventListener('click',()=>{responders=[];$('chatRoster').querySelectorAll('input').forEach(el=>{el.checked=false;});});
$('newChat').addEventListener('click',()=>{if(!conversation.length||confirm(T('대화를 초기화할까요? 학생 설정은 유지됩니다.'))){conversation=[];transcript=[];sessionId=crypto.randomUUID();renderChat();responders=[];}});
$('exportConfigBtn').addEventListener('click',exportConfig);
$('exportChat').addEventListener('click',()=>{
  if(sending){toast(T('응답이 끝난 뒤 대화를 저장해 주세요.'));return;}
  const data={schema_version:'1.3',app_version:CLILBrowser.version,execution_mode:'browser-direct',participation_policy:'focused-v2',session_id:sessionId,exported_at:new Date().toISOString(),mode,language_framework:CEFR,subject_framework:SOLO,provider:mode==='live'?$('providerPreset').value:null,model:mode==='live'?$('modelName').value.trim():null,classroom:copy(session),messages:copy(transcript)};
  const base=`clil-session-${sessionId}`;
  $('savedContent').value=JSON.stringify(data,null,2);
  $('saveCopyStatus').textContent=T('다운로드가 표시되지 않으면 내용을 복사하거나 외부 브라우저에서 열어 주세요.');
  const notice=()=>{$('saveCopyStatus').textContent=T('다운로드를 요청했습니다. 브라우저의 다운로드 목록을 확인해 주세요.');};
  $('downloadSaved').onclick=()=>{download(base+'.json',data);notice();};
  $('downloadCsv').onclick=()=>{downloadText(base+'-conversation.csv',CLILExport.conversationCsv(data),'text/csv;charset=utf-8');notice();};
  $('downloadProfiles').onclick=()=>{downloadText(base+'-students.csv',CLILExport.profilesCsv(data),'text/csv;charset=utf-8');notice();};
  $('saveDialog').showModal();
});
$('closeSaved').addEventListener('click',()=>$('saveDialog').close());
$('copySaved').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($('savedContent').value);$('saveCopyStatus').textContent=T('내용을 복사했습니다.');}
  catch{ $('savedContent').focus();$('savedContent').select();$('saveCopyStatus').textContent=T('내용을 선택했습니다. Ctrl+C 또는 ⌘C로 복사해 주세요.'); }
});
$('importBtn').addEventListener('click',()=>$('importFile').click());
$('importFile').addEventListener('change',importConfig);

$('uiLanguage').addEventListener('change',()=>changeLanguage($('uiLanguage').value));
uiLanguage=initialUiLanguage;changeLanguage(uiLanguage,true);
