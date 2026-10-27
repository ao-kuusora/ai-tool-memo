(() => {
  'use strict';
  const KEY = 'aiToolMemo.v1';
  const initial = [
    { id: crypto.randomUUID(), name: 'Alpha', monthly: 3000, memo: '文章' },
    { id: crypto.randomUUID(), name: 'Beta', monthly: 0, memo: '調査' },
    { id: crypto.randomUUID(), name: 'Gamma', monthly: 5000, memo: '画像' }
  ];
  const $ = id => document.getElementById(id);
  const el = {
    form:$('tool-form'), formTitle:$('form-title'), name:$('f-name'), monthly:$('f-monthly'), memo:$('f-memo'),
    errName:$('e-name'), errMonthly:$('e-monthly'), errMemo:$('e-memo'), submit:$('btn-submit'), cancel:$('btn-cancel'),
    search:$('search'), sort:$('sort'), csv:$('btn-csv'), csvEncoding:$('csv-encoding'), csvProtect:$('csv-protect'),
    reset:$('btn-reset'), body:$('tool-body'), tableWrap:$('table-wrap'), summary:$('summary'), status:$('status'),
    empty:$('empty'), saveWarning:$('save-warning')
  };
  const clean = s => String(s).replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim();
  const norm = s => clean(s).normalize('NFKC').toLowerCase();
  const yen = n => n.toLocaleString('ja-JP') + '円';
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) return {items:initial.map(x=>({...x})), warning:false, note:''};
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw Error();
      const items = parsed.map(x => {
        if (!x || typeof x.name !== 'string' || typeof x.memo !== 'string' ||
            !Number.isInteger(x.monthly) || x.monthly < 0 || x.monthly > 1000000 ||
            !clean(x.name) || !clean(x.memo) || clean(x.name).length > 50 || clean(x.memo).length > 200) throw Error();
        return {id:typeof x.id==='string'&&x.id?x.id:crypto.randomUUID(),name:clean(x.name),monthly:x.monthly,memo:clean(x.memo)};
      });
      return {items,warning:false,note:''};
    } catch {
      return {items:initial.map(x=>({...x})),warning:true,note:'保存データが壊れていたか、読み込めませんでした。初期データを表示しています。'};
    }
  }
  const loaded = read();
  const state = {items:loaded.items, editingId:null, sort:'none', saveFailed:false};
  function status(message,error=false){el.status.textContent=message;el.status.classList.toggle('is-error',error);}
  function save(message) {
    try { localStorage.setItem(KEY,JSON.stringify(state.items)); state.saveFailed=false; status(message+'（保存しました）'); }
    catch { state.saveFailed=true; status(message+'（ブラウザに保存できませんでした）',true); }
    render();
  }
  function sorted(items) {
    const out=items.slice();
    if(state.sort==='asc') out.sort((a,b)=>a.monthly-b.monthly||a.name.localeCompare(b.name,'ja'));
    if(state.sort==='desc') out.sort((a,b)=>b.monthly-a.monthly||a.name.localeCompare(b.name,'ja'));
    return out;
  }
  function cell(label,value,cls='') {
    const td=document.createElement('td'); td.dataset.label=label; if(cls)td.className=cls;
    const span=document.createElement('span');span.className='cell-value';span.textContent=value;td.append(span);return td;
  }
  function actionButton(label,action,item) {
    const b=document.createElement('button');b.type='button';b.className='btn btn-small'+(action==='delete'?' btn-danger-outline':'');
    b.textContent=label;b.dataset.action=action;b.dataset.id=item.id;b.setAttribute('aria-label',item.name+'を'+label+'する');return b;
  }
  function render() {
    const q=norm(el.search.value);
    const visible=sorted(state.items.filter(x=>norm(x.name).includes(q)||norm(x.memo).includes(q)));
    el.body.replaceChildren(...visible.map(item=>{
      const tr=document.createElement('tr');if(item.id===state.editingId)tr.classList.add('editing');
      tr.append(cell('名前',item.name,'cell-name'),cell('月額',item.monthly===0?'0円（無料）':yen(item.monthly),'num'),cell('メモ',item.memo));
      const td=document.createElement('td');td.className='cell-actions';const span=document.createElement('span');span.className='cell-value';
      span.append(actionButton('編集','edit',item),actionButton('削除','delete',item));td.append(span);tr.append(td);return tr;
    }));
    el.tableWrap.hidden=visible.length===0;el.empty.hidden=visible.length!==0;
    el.empty.textContent=state.items.length===0?'まだツールがありません。上のフォームから追加してください。':'条件に合うツールがありません。';
    el.summary.textContent='全'+state.items.length+'件中 '+visible.length+'件を表示 ／ 表示分の月額合計 '+yen(visible.reduce((s,x)=>s+x.monthly,0));
    el.saveWarning.hidden=!state.saveFailed;
  }
  function showErrors(errors={}) {
    for(const [key,input,error] of [['name',el.name,el.errName],['monthly',el.monthly,el.errMonthly],['memo',el.memo,el.errMemo]]) {
      error.textContent=errors[key]||''; if(errors[key])input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
    }
  }
  function resetForm() {
    el.form.reset();showErrors({});state.editingId=null;el.formTitle.textContent='ツールを追加';el.submit.textContent='追加する';el.cancel.hidden=true;
  }
  function dirty() {
    const x=state.items.find(i=>i.id===state.editingId);if(!x)return false;
    return clean(el.name.value)!==x.name||el.monthly.value.trim()!==String(x.monthly)||clean(el.memo.value)!==x.memo;
  }
  el.form.addEventListener('submit',event=>{
    event.preventDefault();
    const values={name:clean(el.name.value),monthlyRaw:el.monthly.value.trim(),memo:clean(el.memo.value)}, errors={};
    if(!values.name)errors.name='名前を入力してください。';else if(values.name.length>50)errors.name='名前は50文字以内で入力してください。';
    else if(state.items.some(x=>x.id!==state.editingId&&norm(x.name)===norm(values.name)))errors.name='同じ名前のツールが既に登録されています。';
    if(values.monthlyRaw==='')errors.monthly='月額を入力してください。';
    else {const n=Number(values.monthlyRaw);if(!Number.isInteger(n)||n<0)errors.monthly='月額は0以上の整数で入力してください。';else if(n>1000000)errors.monthly='月額は1,000,000円以下で入力してください。';}
    if(!values.memo)errors.memo='メモを入力してください。';else if(values.memo.length>200)errors.memo='メモは200文字以内で入力してください。';
    showErrors(errors);const first=['name','monthly','memo'].find(k=>errors[k]);
    if(first){({name:el.name,monthly:el.monthly,memo:el.memo})[first].focus();status('入力内容を確認してください。',true);return;}
    const monthly=Number(values.monthlyRaw), editing=state.items.find(x=>x.id===state.editingId);
    if(monthly===0&&!(editing&&editing.monthly===0)&&!confirm('月額0円（無料）として登録します。よろしいですか？'))return;
    if(editing){editing.name=values.name;editing.monthly=monthly;editing.memo=values.memo;resetForm();save('「'+editing.name+'」を更新しました');}
    else {const item={id:crypto.randomUUID(),...values,monthly};delete item.monthlyRaw;state.items.push(item);resetForm();save('「'+item.name+'」を追加しました');el.name.focus();}
  });
  el.cancel.addEventListener('click',()=>{if(dirty()&&!confirm('編集中の内容を破棄しますか？'))return;resetForm();render();status('編集をやめました。');});
  el.body.addEventListener('click',event=>{
    const b=event.target.closest('button[data-action]');if(!b)return;const item=state.items.find(x=>x.id===b.dataset.id);if(!item)return;
    if(b.dataset.action==='edit'){
      if(state.editingId&&state.editingId!==item.id&&dirty()&&!confirm('編集中の内容を破棄して、別のツールを編集しますか？'))return;
      state.editingId=item.id;el.name.value=item.name;el.monthly.value=String(item.monthly);el.memo.value=item.memo;
      el.formTitle.textContent='ツールを編集：'+item.name;el.submit.textContent='更新する';el.cancel.hidden=false;showErrors({});render();el.form.scrollIntoView({behavior:'smooth',block:'start'});el.name.focus();
    } else if(b.dataset.action==='delete'&&confirm('「'+item.name+'」を削除しますか？')) {
      if(state.editingId===item.id)resetForm();state.items=state.items.filter(x=>x.id!==item.id);save('「'+item.name+'」を削除しました');
    }
  });
  el.search.addEventListener('input',render);el.sort.addEventListener('change',()=>{state.sort=el.sort.value;render();});
  function csvCell(value,protect) {
    let s=String(value);
    if(protect&&typeof value==='string'&&(/^[+\-]?\d[\d,.\/:\-eE+]*$/.test(s)||/^(true|false)$/i.test(s)))s='="'+s+'"';
    else if(/^[\t\r]|^[\s\u0000-\u001F]*[=+\-@]/.test(s))s="'"+s;
    return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }
  el.csv.addEventListener('click',()=>{
    if(!state.items.length){status('出力するデータがありません。',true);return;}
    const rows=[['名前','月額(円)','メモ'].map(x=>csvCell(x,false)).join(',')];
    for(const x of sorted(state.items))rows.push([x.name,x.monthly,x.memo].map(v=>csvCell(v,el.csvProtect.checked)).join(','));
    const csv=rows.join('\r\n')+'\r\n';const blob=new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
    const d=new Date(),stamp=d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
    a.download='ai-tools_'+stamp+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('CSVをダウンロードしました（全'+state.items.length+'件）。');
  });
  el.reset.addEventListener('click',()=>{
    if(!confirm('ブラウザに保存されているデータもすべて消え、初期データに戻ります。元に戻せません。\n必要なら先にCSVでバックアップしてください。\nよろしいですか？'))return;
    state.items=initial.map(x=>({...x}));state.sort='none';el.sort.value='none';el.search.value='';resetForm();
    try{localStorage.removeItem(KEY);state.saveFailed=false;render();status('初期状態に戻しました。');}
    catch{state.saveFailed=true;render();status('初期状態に戻しました（保存データの削除はできませんでした）。',true);}
  });
  window.addEventListener('storage',event=>{
    if(event.key!==KEY&&event.key!==null)return;
    try{const raw=event.newValue,parsed=raw===null?initial.map(x=>({...x})):JSON.parse(raw);if(!Array.isArray(parsed))return;state.items=parsed;render();status('他のタブで内容が変更されたため、最新の状態に更新しました。');}catch{}
  });
  render();if(loaded.note)status(loaded.note,true);
})();