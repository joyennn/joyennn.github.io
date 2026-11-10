/* Pure export helpers: stable English columns, Unicode and spreadsheet-safe cells. */
(function(root) {
  function cell(value) {
    let text=String(value ?? '');
    if(/^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }
  function csv(headers,rows) {return '\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';}
  const profileHeaders=['student_id','student_name','age','home_language','language_exposure','target_language_learning_months','comprehension_level','production_level','interaction_level','language_strategy','participation','traits','notes','knowledge_json'];
  function profile(s) {return s?[s.id,s.name,s.age,s.home_language,s.exposure,s.target_language_learning_months,s.comprehension_level,s.production_level,s.interaction_level,s.language_strategy||'target_only',s.participation,s.traits,s.notes,JSON.stringify(s.knowledge)]:Array(profileHeaders.length).fill('');}
  const classHeaders=['app_version','execution_mode','session_id','exported_at','mode','provider','model','classroom_title','target_language','grade','subject','lesson','concepts_json'];
  function context(data) {const c=data.classroom;return [data.app_version,data.execution_mode,data.session_id,data.exported_at,data.mode,data.provider||'',data.model,c.title,c.target_language,c.grade,c.subject,c.lesson,JSON.stringify(c.concepts)];}
  function conversationCsv(data) {
    return csv([...classHeaders,'turn_index','timestamp','role','speaker_name','content','message_provider','message_model','generation_settings_json','response_status','responding_student_ids_json','participation_policy',...profileHeaders],data.messages.map((m,i)=>[...context(data),i+1,m.time,m.role,m.name,m.content,m.provider||'',m.model||'',JSON.stringify(m.generation_settings||null),m.response_status||'',JSON.stringify(m.responding_student_ids||[]),m.participation_policy||'',...profile(data.classroom.students.find(s=>s.id===m.student_id))]));
  }
  function profilesCsv(data) {return csv([...classHeaders,...profileHeaders],data.classroom.students.map(s=>[...context(data),...profile(s)]));}
  const api={cell,csv,conversationCsv,profilesCsv};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CLILExport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
