/* Standalone browser execution. No proxy, shared key, telemetry or persistent state. */
(function(root){
'use strict';
const version='0.7.1-browser.1';
function error(en,ko){return new Error(typeof uiLanguage!=='undefined'&&uiLanguage==='ko'?ko:en);}
function text(value,max,required=false){
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw error('Check the text fields and their lengths.','텍스트 입력값과 길이를 확인해 주세요.');
  return value;
}
function integer(value,min,max){if(!Number.isInteger(value)||value<min||value>max)throw error('Check the numeric settings.','숫자 설정값을 확인해 주세요.');return value;}
function choice(value,allowed){if(!allowed.includes(value))throw error('Choose one of the listed profile levels or options.','목록에 있는 수준과 옵션을 선택해 주세요.');return value;}
function validate(input){
  if(!input||typeof input!=='object'||![undefined,'1.2','1.3'].includes(input.schema_version))throw error('Unsupported settings format.','지원하지 않는 설정 형식입니다.');
  if(!Array.isArray(input.students)||input.students.length<1||input.students.length>30||!Array.isArray(input.concepts)||input.concepts.length!==1)throw error('Set 1–30 students and one learning-content entry.','학생 1~30명과 학습 내용 한 개를 설정해 주세요.');
  const concepts=input.concepts.map(x=>text(x,120,true));
  const students=input.students.map(s=>{
    const age=integer(s.age??8,5,19);
    if(!Array.isArray(s.knowledge)||s.knowledge.length!==1)throw error('Set one SOLO profile per student.','학생별 SOLO 설정은 한 개여야 합니다.');
    const knowledge=s.knowledge.map(k=>{
      if(k.concept!==concepts[0])throw error('Student concepts must match the lesson.','학생의 개념 설정과 수업 개념이 일치해야 합니다.');
      return {concept:concepts[0],solo_level:choice(k.solo_level,Object.keys(SOLO.levels)),performance_description:text(k.performance_description??'',1000),misconception:text(k.misconception??'',1000)};
    });
    return {id:text(s.id,80,true),name:text(s.name,60,true),age,home_language:text(s.home_language??'',120),exposure:text(s.exposure??'',500),
      target_language_learning_months:s.target_language_learning_months==null?null:integer(s.target_language_learning_months,0,age*12),
      comprehension_level:choice(s.comprehension_level,CEFR.levels),production_level:choice(s.production_level,CEFR.levels),interaction_level:choice(s.interaction_level,CEFR.levels),
      language_strategy:choice(s.language_strategy==='home_language_words'?'target_primary':s.language_strategy??'target_only',['target_only','target_primary','mixed_language','home_primary']),
      participation:choice(s.participation??'balanced',['quiet','balanced','active']),traits:text(s.traits??'',500),notes:text(s.notes??'',1000),knowledge};
  });
  if(new Set(students.map(s=>s.id)).size!==students.length)throw error('Student IDs must be unique.','학생 ID는 중복될 수 없습니다.');
  return {schema_version:'1.3',title:text(input.title??'우리의 작은 교실',120,true),target_language:text(input.target_language??'한국어',60,true),grade:integer(input.grade??2,1,12),subject:text(input.subject??'통합교과',80,true),lesson:text(input.lesson??'',500),concepts,students};
}
function escapeRegex(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function selectStudents(req,rng=Math.random){
  const students=req.classroom.students,q=req.conversation.at(-1).content;
  const boundary='(?=$|[\\s,，.。!?？!：:;]|(?:야|아|은|는|이|가|이가|에게|한테|학생|만|부터)(?=$|[\\s,，.。!?？!：:;]))';
  const named=students.filter(s=>new RegExp('(^|[^\\p{L}\\p{N}_])'+escapeRegex(s.name)+boundary,'iu').test(q));
  if(named.length)return named;
  if(req.responder_ids?.length)return req.responder_ids.map(id=>students.find(s=>s.id===id));
  if(/(?:다\s*같이|모두\s*함께|여러분\s*모두).{0,25}(?:말|대답|읽|따라|인사)|(?:모두|전부).{0,15}(?:말해|대답해|읽어)|함께\s*말해|(?:everyone|everybody|all of you|all together|together).{0,35}(?:say|answer|repeat|read)|(?:say|answer|repeat|read).{0,30}(?:all together|together)|repeat after me|大家.{0,12}(?:一起|回答)|みんなで.{0,12}(?:言|答|読)/i.test(q))return [...students];
  const listen=/들어\s*(?:보|봐|주)|설명[을해\s]*들|조용히|잠깐\s*기다|\b(?:listen|stay quiet|wait a moment)\b|听老师|聞いて/i.test(q);
  const question=/[?？]|누가|무엇|뭐|어떤|어느|얼마|몇|왜|어떻게|말해\s*(?:볼|줘|보)|답해|설명해|이야기해|생각해\s*볼|(?:할|일|을|는|인)까|(?:니|나요|습니까|까요|래요|래|어때)[.!\s]*$|\b(?:who|what|which|where|when|why|how|can you|could you|tell me)\b|谁|什么|どう|何/i.test(q);
  if(listen&&!question)return [];
  if(question&&/^(?:자[,，\s]*)?(?:여러분|얘들아|친구들아|다들)(?:은|는|이|의)?(?=[,，!！?？\s]|$)|^(?:okay[,\s]*)?(?:everyone|everybody|all of you|class)\b|^(?:大家|みんな)/i.test(q.trim()))return [...students];
  if(q.length<=100&&/^(?:왜|어떻게|그럼|그다음|다시|맞아|잘했|좋아|네가|너는|그것|그 말|예를|쉽게|why\b|how\b|then\b|again\b|you said\b|your answer\b|well done\b|that's right\b|try\b)/i.test(q.trim())){
    for(const t of (req.classroom_turns||[]).slice(0,-1).reverse()){
      if(t.role==='user')break;
      if(t.student_id)return students.filter(s=>s.id===t.student_id);
    }
  }
  const greeting=/안녕|반가워|\b(?:hello|hi|good morning|good afternoon)\b|你好|こんにちは/i.test(q);
  if(!question&&!greeting)return [];
  const one=/한\s*명(?:만|이|의|이라도)?|\bone (?:student|person)\b/i.test(q);
  const count=one||(greeting&&!question)?1:Math.min(students.length,rng()<0.75?1:2);
  const pool=[...students],selected=[],weights={quiet:1,balanced:2.5,active:4};
  for(let i=0;i<count;i++){
    let draw=rng()*pool.reduce((total,s)=>total+weights[s.participation],0),index=0;
    for(;index<pool.length-1;index++){draw-=weights[pool[index].participation];if(draw<0)break;}
    selected.push(pool.splice(index,1)[0]);
  }
  return selected;
}
function studentMessages(req,s){
  const messages=[],names=Object.fromEntries(req.classroom.students.map(s=>[s.id,s.name]));
  if(req.classroom_turns?.length){
    let size=0;const turns=[];
    for(const t of [...req.classroom_turns].reverse()){size+=t.content.length;if(size>70000&&turns.length)break;turns.push(t);}
    for(const t of turns.reverse()){
      const role=t.role==='assistant'&&t.student_id===s.id?'assistant':'user';
      const content=t.role==='user'?'[Teacher / 교사]\n'+t.content:t.student_id===s.id?t.content:`[Peer / 다른 학생: ${names[t.student_id]}]\n${t.content}`;
      if(!messages.length&&role==='assistant')continue;
      if(messages.at(-1)?.role===role)messages.at(-1).content+='\n\n'+content;else messages.push({role,content});
    }
  }else{
    for(const m of req.conversation){
      const content=m.role==='user'?m.content:'[Public classroom responses / 교실 공개 응답]\n'+m.content;
      if(messages.at(-1)?.role==='user')messages.at(-1).content+='\n\n'+content;else messages.push({role:'user',content});
    }
  }
  return messages;
}
function buildPrompt(req,s){
  const own=[...(req.classroom_turns||[])].reverse().find(t=>t.student_id===s.id);
  return BROWSER_PROMPT.build(req.classroom,s)+'\n\n현재 대화 정보 (상태 데이터):\n'+JSON.stringify({current_teacher_message:req.conversation.at(-1).content,last_own_utterance:own?.content??null,student_id:s.id,instruction:'앞선 자기 발화와 교사의 지원에 이어 학생으로 응답한다. 다른 학생의 발화는 동료의 말이다.'});
}
function settings(req){
  if(req.provider==='openai')return {max_output_tokens:4096,reasoning:{effort:req.model==='gpt-6.1-terra'?'none':'low'},store:false};
  if(req.provider==='google')return {maxOutputTokens:4096,thinkingConfig:{thinkingLevel:'low'}};
  return {max_tokens:4096,...(req.model==='claude-sonnet-5-5'?{thinking:{type:'between_tools'},output_config:{effort:'low'}}:{thinking:{type:'disabled'}})};
}
function requestSpec(req,s){
  const prompt=buildPrompt(req,s),messages=studentMessages(req,s),generation=settings(req);
  if(req.provider==='anthropic')return {url:'https://api.anthropic.com/v1/messages',headers:{'x-api-key':req.api_key.trim(),'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:{model:req.model,...generation,system:prompt,messages}};
  if(req.provider==='openai')return {url:'https://api.openai.com/v1/responses',headers:{authorization:'Bearer '+req.api_key.trim()},body:{model:req.model,...generation,instructions:prompt,input:messages}};
  return {url:'https://generativelanguage.googleapis.com/v1beta/models/'+req.model+':generateContent',headers:{'x-goog-api-key':req.api_key.trim()},body:{systemInstruction:{parts:[{text:prompt}]},contents:messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),generationConfig:generation}};
}
function parseResponse(provider,data){
  let output='',incomplete=false;
  try{
    if(provider==='anthropic'){output=(data.content||[]).filter(p=>p.type==='text').map(p=>p.text||'').join('');incomplete=['max_tokens','refusal','model_context_window_exceeded'].includes(data.stop_reason);}
    else if(provider==='openai'){output=(data.output||[]).filter(i=>i.type==='message').flatMap(i=>i.content||[]).filter(p=>p.type==='output_text').map(p=>p.text||'').join('');incomplete=data.status!=='completed';}
    else{const candidate=data.candidates?.[0];output=(candidate?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');incomplete=candidate?.finishReason!=='STOP';}
  }catch{throw error('Could not read the AI response. Please retry.','AI 응답을 읽을 수 없습니다. 다시 시도해 주세요.');}
  if(incomplete)throw error('The AI response was blocked or incomplete. Please retry.','AI 응답이 차단되었거나 완료되지 않았습니다. 다시 시도해 주세요.');
  if(!output.trim())throw error('The AI response is empty. Please retry.','AI 응답이 비어 있습니다. 다시 시도해 주세요.');
  return output.trim();
}
async function callProvider(req,s,signal){
  const spec=requestSpec(req,s),controller=new AbortController();
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)controller.abort();
  const timeout=setTimeout(abort,50000);
  try{
    let response;
    try{response=await fetch(spec.url,{method:'POST',headers:{'content-type':'application/json',...spec.headers},body:JSON.stringify(spec.body),signal:controller.signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});}
    catch(e){if(signal?.aborted)throw new DOMException('Aborted','AbortError');throw error('Direct API connection failed or timed out. Check browser/network restrictions and try the Render version if needed.','API 직접 연결에 실패했거나 시간이 초과되었습니다. 브라우저·네트워크 제한을 확인하고 필요하면 Render 버전을 이용해 주세요.');}
    if(!response.ok){
      if([401,403].includes(response.status))throw error('Check your API key and model access.','API 키 또는 모델 이용 권한을 확인해 주세요.');
      if(response.status===429)throw error('API usage or rate limit reached. Please try later.','API 사용량 또는 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.');
      if([400,404].includes(response.status))throw error('Check the API key, model availability and request settings.','API 키, 모델 이용 가능 여부와 요청 설정을 확인해 주세요.');
      throw error('The AI provider could not process the request. Please retry.','AI 제공사가 요청을 처리하지 못했습니다. 다시 시도해 주세요.');
    }
    let data;try{data=await response.json();}catch{throw error('Could not read the AI response. Please retry.','AI 응답을 읽을 수 없습니다. 다시 시도해 주세요.');}
    return parseResponse(req.provider,data);
  }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
function validateRequest(input){
  const req={...input,classroom:validate(input.classroom)},ids=new Set(req.classroom.students.map(s=>s.id));
  if(!Array.isArray(req.conversation)||!req.conversation.length||req.conversation.length>200||req.conversation.at(-1).role!=='user')throw error('Check the classroom conversation.','교실 대화 기록을 확인해 주세요.');
  for(const t of req.conversation){choice(t.role,['user','assistant']);text(t.content,12000,true);}
  req.classroom_turns=req.classroom_turns||[];
  if(!Array.isArray(req.classroom_turns)||req.classroom_turns.length>800)throw error('The conversation is too long. Save it and start a new chat.','대화가 너무 깁니다. 저장한 뒤 새 대화를 시작해 주세요.');
  for(const t of req.classroom_turns){choice(t.role,['user','assistant']);text(t.content,12000,true);if(t.role==='assistant'?!ids.has(t.student_id):t.student_id!=null)throw error('Check the speaker IDs.','대화의 학생 ID를 확인해 주세요.');}
  if(req.classroom_turns.length&&(req.classroom_turns.at(-1).role!=='user'||req.classroom_turns.at(-1).content!==req.conversation.at(-1).content))throw error('The last teacher turn does not match.','마지막 교사 발화가 일치하지 않습니다.');
  req.responder_ids=req.responder_ids||[];
  if(!Array.isArray(req.responder_ids)||new Set(req.responder_ids).size!==req.responder_ids.length||req.responder_ids.some(id=>!ids.has(id)))throw error('Choose responders from the current roster.','현재 학생 명단에서 응답 학생을 선택해 주세요.');
  if(!Object.hasOwn(MODELS,req.provider)||!MODELS[req.provider].models.some(m=>m.id===req.model))throw error('Choose a model for the selected provider.','선택한 제공사에 맞는 모델을 선택해 주세요.');
  text(req.api_key,500,true);
  if(req.mode!=='live')throw error('Use Live AI for dialogue.','대화는 실제 AI 모드를 이용해 주세요.');
  return req;
}
async function chat(input,signal){
  const req=validateRequest(input),selected=selectStudents(req),controller=new AbortController();
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
  let replies=[];
  try{
    if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');
    if(selected.length>3){
      let next=0;const out=new Array(selected.length);
      await Promise.all(Array.from({length:Math.min(8,selected.length)},async()=>{
        while(next<selected.length){const i=next++,s=selected[i];const reply=await callProvider(req,s,controller.signal);out[i]={student_id:s.id,name:s.name,text:reply};}
      }));replies=out;
    }else{
      let current=req;
      for(const s of selected){const reply=await callProvider(current,s,controller.signal);replies.push({student_id:s.id,name:s.name,text:reply});
        if(req.classroom_turns.length)current={...current,classroom_turns:[...current.classroom_turns,{role:'assistant',student_id:s.id,content:reply}]};}
    }
    return {replies,mode:'live',settings_version:'1.3',response_status:replies.length?'responded':'no_response',participation_policy:'focused-v2',app_version:version,execution_mode:'browser-direct',provider:req.provider,model:req.model,generation_settings:settings(req)};
  }catch(e){controller.abort();throw e;}finally{signal?.removeEventListener('abort',abort);}
}
root.CLILBrowser={version,validate,validateRequest,selectStudents,studentMessages,buildPrompt,settings,requestSpec,parseResponse,chat};
})(typeof globalThis!=='undefined'?globalThis:this);
