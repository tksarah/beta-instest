(function(){
  function $(id){ return document.getElementById(id); }

  var adminStorageKey = 'instanttest_admin_password';

  function getNextPath(){
    try{
      var params = new URLSearchParams(window.location.search || '');
      var next = (params.get('next') || '').trim();
      if(next && next.startsWith('/') && !next.startsWith('//') && !next.toLowerCase().startsWith('/api/')) return next;
      return '/app.html';
    }catch(e){
      return '/app.html';
    }
  }

  function showMessage(text, isError){
    var el = $('login-message');
    if(!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#900' : '';
  }

  function showAdminMessage(text, isError){
    var el = $('admin-access-message');
    if(!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#900' : '';
  }

  function shouldOpenAdminAccess(){
    try{
      return new URLSearchParams(window.location.search || '').get('admin') === '1';
    }catch(_err){
      return false;
    }
  }

  function verifyAdminPassword(password){
    return fetch('/api/admin/teachers', {
      method: 'GET',
      headers: { 'X-Admin-Password': password }
    }).then(function(r){
      return r.text().then(function(text){
        var body = {};
        if(text){
          try{ body = JSON.parse(text); }catch(_err){ body = { raw: text }; }
        }
        return { ok: r.ok, status: r.status, body: body };
      });
    });
  }

  var googleLink = $('google-login-link');
  if(googleLink){
    googleLink.href = '/api/auth/google/start?next=' + encodeURIComponent(getNextPath());
  }

  var form = $('login-form');
  if(form){
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      showMessage('ログインしています...');

      var username = ($('username') && $('username').value || '').trim();
      var password = ($('password') && $('password').value || '');
      if(!username || !password){
        showMessage('ユーザー名とパスワードを入力してください。', true);
        return;
      }

      fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      }).then(function(r){
        return r.json().then(function(body){
          return { ok: r.ok, status: r.status, body: body };
        });
      }).then(function(result){
        if(!result.ok){
          var msg = (result.body && (result.body.error || result.body.message)) || 'ログインに失敗しました';
          showMessage('ログインに失敗しました: ' + msg, true);
          return;
        }
        showMessage('ログインしました。移動します...');
        window.location.href = getNextPath();
      }).catch(function(){
        showMessage('通信に失敗しました。サーバーの状態を確認してください。', true);
      });
    });
  }

  var adminForm = $('admin-access-form');
  if(adminForm){
    adminForm.addEventListener('submit', function(ev){
      ev.preventDefault();
      var password = ($('admin-access-password') && $('admin-access-password').value || '').trim();
      if(!password){
        showAdminMessage('管理者パスワードを入力してください。', true);
        return;
      }

      var submit = $('admin-access-submit');
      if(submit) submit.disabled = true;
      showAdminMessage('管理者承認を確認しています...');

      verifyAdminPassword(password).then(function(result){
        if(submit) submit.disabled = false;
        if(!result.ok){
          localStorage.removeItem(adminStorageKey);
          showAdminMessage('管理者パスワードが違います。', true);
          return;
        }
        localStorage.setItem(adminStorageKey, password);
        showAdminMessage('承認しました。管理者画面へ移動します...');
        window.location.href = '/admin.html';
      }).catch(function(){
        if(submit) submit.disabled = false;
        showAdminMessage('通信に失敗しました。サーバーの状態を確認してください。', true);
      });
    });
  }

  if(shouldOpenAdminAccess()){
    var adminInput = $('admin-access-password');
    if(adminInput) adminInput.focus();
  }

  fetch('/api/teacher/me').then(function(r){
    if(r.ok && !shouldOpenAdminAccess()){
      window.location.replace(getNextPath());
    }
  }).catch(function(){});
})();
