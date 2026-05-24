(function(){
  function $(id){ return document.getElementById(id); }

  var storageKey = 'instanttest_admin_password';
  var teacherItems = [];
  var planItems = [];
  var featureSettingItems = [];
  var publicSettingItems = [];
  var contactRequestItems = [];
  var dateFormatter = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  function getAdminPassword(){
    return (localStorage.getItem(storageKey) || '').trim();
  }

  function setAdminPassword(pw){
    localStorage.setItem(storageKey, pw || '');
  }

  function clearAdminPassword(){
    localStorage.removeItem(storageKey);
  }

  function redirectToLanding(){
    window.location.replace('/');
  }

  function redirectToLogin(){
    window.location.replace('/login.html?admin=1');
  }

  function apiFetch(url, options){
    var opts = options || {};
    opts.headers = opts.headers || {};
    var adminPw = getAdminPassword();
    if(adminPw){
      opts.headers['X-Admin-Password'] = adminPw;
    }
    return fetch(url, opts).then(function(r){
      return r.text().then(function(text){
        var body = {};
        if(text){
          try{ body = JSON.parse(text); }catch(_err){ body = { raw: text }; }
        }
        return { ok: r.ok, status: r.status, body: body };
      });
    });
  }

  function showMessage(id, text, isError){
    var el = $(id);
    if(!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#900' : '';
  }

  function showCreateMessage(text, isError){
    showMessage('teacher-create-message', text, isError);
  }

  function showListMessage(text, isError){
    showMessage('teacher-list-message', text, isError);
  }

  function showPlanMessage(text, isError){
    showMessage('plan-config-message', text, isError);
  }

  function showFeatureMessage(text, isError){
    showMessage('feature-config-message', text, isError);
  }

  function showPublicConfigMessage(text, isError){
    showMessage('public-config-message', text, isError);
  }

  function showContactListMessage(text, isError){
    showMessage('contact-request-list-message', text, isError);
  }

  function formatDate(value){
    if(!value) return '未記録';
    var time = Date.parse(value);
    if(Number.isNaN(time)) return String(value);
    return dateFormatter.format(new Date(time));
  }

  function escapeHtml(s){
    return String(s || '').replace(/[&<>"']/g, function(ch){
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch;
    });
  }

  function getSummary(item){
    var summary = item && item.summary ? item.summary : {};
    return {
      classes: Number(summary.classes) || 0,
      tests: Number(summary.tests) || 0,
      questions: Number(summary.questions) || 0,
      students: Number(summary.students) || 0,
      studentAnswers: Number(summary.student_answers) || 0,
      examSessions: Number(summary.exam_sessions) || 0,
      teacherSessions: Number(summary.teacher_sessions) || 0
    };
  }

  function getTeacherUsage(item){
    var usage = item && item.usage ? item.usage : {};
    return {
      aiGenerations: Number(usage.ai_generations) || 0
    };
  }

  function getEffectiveLimits(item){
    var limits = item && item.effective_limits ? item.effective_limits : {};
    var aiLimit = limits.ai_generations_per_month;
    return {
      aiGenerationsPerMonth: aiLimit == null ? null : Number(aiLimit)
    };
  }

  function renderTeacherSummary(items){
    var host = $('teacher-list-summary');
    if(!host) return;
    var teacherCount = items.length;
    var testCount = 0;
    var studentCount = 0;
    items.forEach(function(item){
      var summary = getSummary(item);
      testCount += summary.tests;
      studentCount += summary.students;
    });
    host.innerHTML = ''
      + '<span class="admin-pill">教師 ' + teacherCount + '人</span>'
      + '<span class="admin-pill">テスト ' + testCount + '件</span>'
      + '<span class="admin-pill">生徒 ' + studentCount + '人</span>';
  }

  function formatLimitValue(value){
    return value == null || value === '' ? '無制限' : String(value);
  }

  function renderPlanSummary(items){
    var host = $('plan-config-summary');
    if(!host) return;
    var count = Array.isArray(items) ? items.length : 0;
    host.innerHTML = ''
      + '<span class="admin-pill">プラン ' + count + '件</span>'
      + '<span class="admin-pill">free_beta 既定値をここで調整</span>';
  }

  function renderFeatureSummary(items){
    var host = $('feature-config-summary');
    if(!host) return;
    var count = Array.isArray(items) ? items.length : 0;
    var enabledCount = 0;
    (items || []).forEach(function(item){
      if(item && item.value) enabledCount += 1;
    });
    host.innerHTML = ''
      + '<span class="admin-pill">機能 ' + count + '件</span>'
      + '<span class="admin-pill">有効 ' + enabledCount + '件</span>';
  }

  function renderPublicConfigSummary(items){
    var host = $('public-config-summary');
    if(!host) return;
    var count = Array.isArray(items) ? items.length : 0;
    var configuredCount = 0;
    (items || []).forEach(function(item){
      if(item && String(item.value || '').trim()) configuredCount += 1;
    });
    host.innerHTML = ''
      + '<span class="admin-pill">公開設定 ' + count + '件</span>'
      + '<span class="admin-pill">設定済み ' + configuredCount + '件</span>';
  }

  function renderFeatureSettings(items){
    var host = $('feature-config-list');
    if(!host) return;

    renderFeatureSummary(items || []);

    if(!items || items.length === 0){
      host.innerHTML = '<div class="admin-empty">機能設定はまだありません。</div>';
      return;
    }

    var feature = items.find(function(item){
      return item && item.key === 'test_sets_management_enabled';
    });
    if(!feature){
      host.innerHTML = '<div class="admin-empty">表示できる機能設定がありません。</div>';
      return;
    }

    var checked = !!feature.value;
    host.innerHTML = ''
      + '<article class="feature-setting-card" data-setting-key="' + escapeHtml(feature.key) + '">'
      + '  <div class="feature-setting-row">'
      + '    <div>'
      + '      <strong>まとめ配布を作成</strong>'
      + '      <p class="feature-setting-note">OFF の間は教師による新規作成、公開切替、アーカイブ、削除を停止します。</p>'
      + '    </div>'
      + '    <label><input class="feature-setting-toggle" type="checkbox"' + (checked ? ' checked' : '') + ' />' + (checked ? '有効' : '無効') + '</label>'
      + '  </div>'
      + '  <div class="admin-actions">'
      + '    <button class="btn btn-small" data-action="save-feature-setting" data-key="' + escapeHtml(feature.key) + '" type="button">保存</button>'
      + '  </div>'
      + '</article>';

    attachFeatureSettingActions(host);
  }

  function renderPublicSettings(items){
    var host = $('public-config-list');
    if(!host) return;

    renderPublicConfigSummary(items || []);

    if(!items || items.length === 0){
      host.innerHTML = '<div class="admin-empty">公開設定はまだありません。</div>';
      return;
    }

    var feedbackSetting = items.find(function(item){
      return item && item.key === 'feedback_form_url';
    });
    if(!feedbackSetting){
      host.innerHTML = '<div class="admin-empty">表示できる公開設定がありません。</div>';
      return;
    }

    var value = String(feedbackSetting.value || '');
    host.innerHTML = ''
      + '<article class="public-setting-card" data-setting-key="' + escapeHtml(feedbackSetting.key) + '">'
      + '  <div>'
      + '    <strong>フィードバックフォーム URL</strong>'
      + '    <p class="public-setting-note">Google Form などの URL を設定します。空欄で保存すると、公開側のフィードバックリンクは非表示になります。</p>'
      + '  </div>'
      + '  <label>URL<input class="public-setting-input" type="url" inputmode="url" value="' + escapeHtml(value) + '" placeholder="https://docs.google.com/forms/..." /></label>'
      + '  <div class="admin-actions">'
      + '    <button class="btn btn-small" data-action="save-public-setting" data-key="' + escapeHtml(feedbackSetting.key) + '" type="button">保存</button>'
      + '  </div>'
      + '</article>';

    attachPublicSettingActions(host);
  }

  function renderPlanList(items){
    var host = $('plan-config-list');
    if(!host) return;

    renderPlanSummary(items || []);

    if(!items || items.length === 0){
      host.innerHTML = '<div class="admin-empty">プラン設定はまだありません。</div>';
      return;
    }

    var html = '';
    items.forEach(function(item){
      var limits = item && item.limits ? item.limits : {};
      var displayName = item && item.display_name ? escapeHtml(item.display_name) : '';
      var code = item && item.code ? escapeHtml(item.code) : '';
      html += ''
        + '<article class="plan-card" data-plan-code="' + code + '">'
        + '  <div class="plan-card-head">'
        + '    <div class="plan-card-title">'
        + '      <strong>' + (displayName || code) + '</strong>'
        + '      <span>code: ' + code + '</span>'
        + '    </div>'
        + '    <span class="admin-pill">' + (item && item.active === 0 ? '停止中' : '利用中') + '</span>'
        + '  </div>'
        + '  <div class="admin-form-grid">'
        + '    <div class="admin-field--full">'
        + '      <label>表示名<input class="plan-display-name-input" type="text" value="' + displayName + '" placeholder="プラン表示名" /></label>'
        + '    </div>'
        + '  </div>'
        + '  <div class="plan-config-grid">'
        + '    <label>クラス上限<input class="plan-limit-input" data-limit-name="classes" type="number" min="0" step="1" value="' + escapeHtml(formatLimitValue(limits.classes === null ? '' : limits.classes)) + '" placeholder="空欄で無制限" /></label>'
        + '    <label>テスト上限<input class="plan-limit-input" data-limit-name="tests" type="number" min="0" step="1" value="' + escapeHtml(formatLimitValue(limits.tests === null ? '' : limits.tests)) + '" placeholder="空欄で無制限" /></label>'
        + '    <label>生徒上限<input class="plan-limit-input" data-limit-name="students" type="number" min="0" step="1" value="' + escapeHtml(formatLimitValue(limits.students === null ? '' : limits.students)) + '" placeholder="空欄で無制限" /></label>'
        + '    <label>AI生成 / 月<input class="plan-limit-input" data-limit-name="ai_generations_per_month" type="number" min="0" step="1" value="' + escapeHtml(formatLimitValue(limits.ai_generations_per_month === null ? '' : limits.ai_generations_per_month)) + '" placeholder="空欄で無制限" /></label>'
        + '  </div>'
        + '  <div class="plan-card-actions">'
        + '    <p class="plan-card-note">空欄にすると、その項目は無制限として扱います。</p>'
        + '    <button class="btn btn-small" data-action="save-plan" data-code="' + code + '" type="button">保存</button>'
        + '  </div>'
        + '</article>';
    });

    host.innerHTML = '<div class="plan-config-list">' + html + '</div>';
    attachPlanActions(host);
  }

  function attachFeatureSettingActions(host){
    host.querySelectorAll('button[data-action="save-feature-setting"]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var key = btn.getAttribute('data-key');
        var article = btn.closest('article');
        var toggle = article ? article.querySelector('.feature-setting-toggle') : null;
        if(!key || !toggle) return;

        btn.disabled = true;
        showFeatureMessage('保存しています...');
        apiFetch('/api/admin/settings/' + encodeURIComponent(key), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: !!toggle.checked })
        }).then(function(r){
          btn.disabled = false;
          if(!r.ok){
            showFeatureMessage('保存に失敗しました: ' + (((r.body && r.body.error) || r.status)), true);
            if(r.status === 401) handleInvalidAdminPassword();
            return;
          }
          showFeatureMessage('機能設定を更新しました。');
          loadFeatureSettings(true);
        }).catch(function(){
          btn.disabled = false;
          showFeatureMessage('通信に失敗しました', true);
        });
      });
    });
  }

  function attachPublicSettingActions(host){
    host.querySelectorAll('button[data-action="save-public-setting"]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var key = btn.getAttribute('data-key');
        var article = btn.closest('article');
        var input = article ? article.querySelector('.public-setting-input') : null;
        if(!key || !input) return;

        btn.disabled = true;
        showPublicConfigMessage('保存しています...');
        apiFetch('/api/admin/settings/' + encodeURIComponent(key), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: (input.value || '').trim() })
        }).then(function(r){
          btn.disabled = false;
          if(!r.ok){
            showPublicConfigMessage('保存に失敗しました: ' + (((r.body && r.body.error) || r.status)), true);
            if(r.status === 401) handleInvalidAdminPassword();
            return;
          }
          showPublicConfigMessage('公開設定を更新しました。');
          loadPublicSettings(true);
        }).catch(function(){
          btn.disabled = false;
          showPublicConfigMessage('通信に失敗しました', true);
        });
      });
    });
  }

  function renderTeacherList(items){
    var host = $('teacher-list');
    if(!host) return;

    renderTeacherSummary(items || []);

    if(!items || items.length === 0){
      host.innerHTML = '<div class="admin-empty">教師ユーザーはまだ登録されていません。</div>';
      return;
    }

    var html = '';
    items.forEach(function(item){
      var summary = getSummary(item);
      var displayName = item.display_name ? escapeHtml(item.display_name) : '';
      var email = item.email ? escapeHtml(item.email) : '';
      var provider = item.auth_provider ? escapeHtml(item.auth_provider) : 'password';
      var planLabel = item.plan ? escapeHtml(item.plan) : 'free_beta';
      var usage = getTeacherUsage(item);
      var effectiveLimits = getEffectiveLimits(item);
      var aiLimitOverride = item.ai_generations_per_month_limit_override == null ? '' : String(item.ai_generations_per_month_limit_override);
      var aiEffectiveLimit = effectiveLimits.aiGenerationsPerMonth == null ? '無制限' : String(effectiveLimits.aiGenerationsPerMonth);
      var aiLimitLabel = aiLimitOverride === '' ? 'プラン既定値' : '個別上限';
      html += ''
        + '<article class="teacher-card" data-user-id="' + item.id + '">'
        + '  <div class="teacher-card-head">'
        + '    <div class="teacher-card-title">'
        + '      <strong>' + escapeHtml(item.username) + '</strong>'
        + '      <span class="teacher-display-name">' + (displayName ? '表示名: ' + displayName : '表示名: 未設定') + '</span>'
        + '      <span>認証: ' + provider + (email ? ' / ' + email : '') + '</span>'
        + '      <span>プラン: ' + planLabel + '</span>'
        + '      <span>作成: ' + escapeHtml(formatDate(item.created_at)) + '</span>'
        + '    </div>'
        + '    <button class="btn btn-small btn-danger" data-action="delete" data-id="' + item.id + '" type="button">削除</button>'
        + '  </div>'
        + '  <div class="teacher-card-meta">'
        + '    <div class="teacher-metric"><strong>' + summary.classes + '</strong><span>クラス</span></div>'
        + '    <div class="teacher-metric"><strong>' + summary.tests + '</strong><span>テスト</span></div>'
        + '    <div class="teacher-metric"><strong>' + summary.questions + '</strong><span>問題</span></div>'
        + '    <div class="teacher-metric"><strong>' + summary.students + '</strong><span>生徒</span></div>'
        + '    <div class="teacher-metric"><strong>' + summary.studentAnswers + '</strong><span>回答</span></div>'
        + '    <div class="teacher-metric"><strong>' + summary.examSessions + '</strong><span>受験記録</span></div>'
        + '    <div class="teacher-metric"><strong>' + usage.aiGenerations + ' / ' + escapeHtml(aiEffectiveLimit) + '</strong><span>AI生成/月</span></div>'
        + '  </div>'
        + '  <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;">'
        + '    <div style="display:flex;gap:8px;align-items:center;flex:1;min-width:260px;">'
        + '      <input class="edit-display-input" type="text" placeholder="表示名を入力" value="' + displayName + '" style="padding:6px;border-radius:8px;border:1px solid #ddd;flex:1;" />'
        + '      <button class="btn btn-small" data-action="save-display" data-id="' + item.id + '" type="button">保存</button>'
        + '    </div>'
        + '    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
        + '      <input class="teacher-password-input" type="password" placeholder="新しいパスワード" style="padding:6px;border-radius:8px;border:1px solid #ddd;" />'
        + '      <button class="btn btn-small" data-action="save-password" data-id="' + item.id + '" type="button">パスワード更新</button>'
        + '    </div>'
        + '    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
        + '      <label style="display:flex;gap:6px;align-items:center;color:var(--text-muted);font-size:12px;">AI生成/月<input class="teacher-ai-limit-input" type="number" min="0" step="1" placeholder="空欄でプラン既定値" value="' + escapeHtml(aiLimitOverride) + '" style="padding:6px;border-radius:8px;border:1px solid #ddd;width:150px;" /></label>'
        + '      <span class="admin-pill">' + escapeHtml(aiLimitLabel) + '</span>'
        + '      <button class="btn btn-small" data-action="save-ai-limit" data-id="' + item.id + '" type="button">AI上限保存</button>'
        + '    </div>'
        + '  </div>'
        + '  <div class="teacher-card-foot">'
        + '    <p>削除時にはログインセッション ' + summary.teacherSessions + ' 件も同時に消去します。</p>'
        + '  </div>'
        + '</article>';
    });

    host.innerHTML = '<div class="teacher-list-grid">' + html + '</div>';
    attachTeacherActions(host);
  }

  function attachPlanActions(host){
    host.querySelectorAll('button[data-action="save-plan"]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var code = btn.getAttribute('data-code');
        var article = btn.closest('article');
        if(!article || !code) return;

        var displayNameInput = article.querySelector('.plan-display-name-input');
        var payload = {
          display_name: displayNameInput ? (displayNameInput.value || '').trim() : ''
        };

        article.querySelectorAll('.plan-limit-input').forEach(function(input){
          var key = input.getAttribute('data-limit-name');
          if(!key) return;
          var value = (input.value || '').trim();
          payload[key] = value === '' ? null : Number(value);
        });

        btn.disabled = true;
        showPlanMessage('保存しています...');
        apiFetch('/api/admin/plans/' + encodeURIComponent(code), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function(r){
          btn.disabled = false;
          if(!r.ok){
            showPlanMessage('保存に失敗しました: ' + (((r.body && r.body.error) || r.status)), true);
            if(r.status === 401) handleInvalidAdminPassword();
            return;
          }
          showPlanMessage('プラン上限を更新しました。');
          loadPlans(true);
        }).catch(function(){
          btn.disabled = false;
          showPlanMessage('通信に失敗しました', true);
        });
      });
    });
  }

  function renderContactRequestSummary(items){
    var host = $('contact-request-summary');
    if(!host) return;
    var count = Array.isArray(items) ? items.length : 0;
    var newCount = 0;
    var inProgressCount = 0;
    var completedCount = 0;
    (items || []).forEach(function(item){
      if(item && item.status === 'completed') completedCount += 1;
      else if(item && item.status === 'in_progress') inProgressCount += 1;
      else newCount += 1;
    });
    host.innerHTML = ''
      + '<span class="admin-pill">お問い合わせ ' + count + '件</span>'
      + '<span class="admin-pill">新規 ' + newCount + '件</span>'
      + '<span class="admin-pill">対応中 ' + inProgressCount + '件</span>'
      + '<span class="admin-pill">完了 ' + completedCount + '件</span>';
  }

  function contactRequestStatusLabel(value){
    if(value === 'completed') return '対応完了';
    if(value === 'in_progress') return '対応中';
    return '新規';
  }

  function renderContactRequestList(items){
    var host = $('contact-request-list');
    if(!host) return;

    renderContactRequestSummary(items || []);

    if(!items || items.length === 0){
      host.innerHTML = '<div class="admin-empty">お問い合わせはまだ届いていません。</div>';
      return;
    }

    var html = '';
    items.forEach(function(item){
      var status = item && item.status ? String(item.status) : 'new';
      var adminNote = item && item.admin_note ? String(item.admin_note) : '';
      html += ''
        + '<article class="contact-request-card" data-request-id="' + item.id + '">'
        + '  <div class="contact-request-card__body">'
        + '    <strong>' + escapeHtml(item.name) + '</strong>'
        + '    <a href="mailto:' + encodeURIComponent(item.email) + '">' + escapeHtml(item.email) + '</a>'
        + '    <div class="contact-request-card__meta">状態: ' + escapeHtml(contactRequestStatusLabel(status)) + '</div>'
        + '    <div class="contact-request-card__meta">受付: ' + escapeHtml(formatDate(item.created_at)) + '</div>'
        + '  </div>'
        + '  <div class="contact-request-card__editor">'
        + '    <label>対応状況<select class="contact-request-status-input">'
        + '      <option value="new"' + (status === 'new' ? ' selected' : '') + '>新規</option>'
        + '      <option value="in_progress"' + (status === 'in_progress' ? ' selected' : '') + '>対応中</option>'
        + '      <option value="completed"' + (status === 'completed' ? ' selected' : '') + '>対応完了</option>'
        + '    </select></label>'
        + '    <label>メモ<textarea class="contact-request-note-input" maxlength="2000" placeholder="内部メモを入力">' + escapeHtml(adminNote) + '</textarea></label>'
        + '    <div class="contact-request-card__actions">'
        + '      <button class="btn btn-small" data-action="save-contact-request" data-id="' + item.id + '" type="button">保存</button>'
        + '      <button class="btn btn-small btn-danger" data-action="delete-contact-request" data-id="' + item.id + '" type="button">削除</button>'
        + '    </div>'
        + '  </div>'
        + '</article>';
    });

    host.innerHTML = '<div class="contact-request-list">' + html + '</div>';
    attachContactRequestActions(host);
  }

  function attachTeacherActions(host){
    host.querySelectorAll('button[data-action="delete"]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.getAttribute('data-id');
        var item = teacherItems.find(function(entry){ return String(entry.id) === String(id); });
        if(!item) return;

        var summary = getSummary(item);
        var targetName = item.display_name || item.username;
        var confirmLines = [
          '教師ユーザー「' + targetName + '」を完全削除します。',
          '',
          '削除されるデータ',
          'クラス: ' + summary.classes + '件',
          'テスト: ' + summary.tests + '件',
          '問題: ' + summary.questions + '件',
          '生徒: ' + summary.students + '人',
          '回答: ' + summary.studentAnswers + '件',
          '受験記録: ' + summary.examSessions + '件',
          'ログインセッション: ' + summary.teacherSessions + '件',
          '',
          'この操作は取り消せません。'
        ];
        if(!confirm(confirmLines.join('\n'))) return;

        btn.disabled = true;
        showListMessage('削除しています...');
        apiFetch('/api/admin/teachers/' + encodeURIComponent(id), {
          method: 'DELETE'
        }).then(function(r){
          if(!r.ok){
            btn.disabled = false;
            showListMessage('削除に失敗しました: ' + (((r.body && r.body.error) || r.status)), true);
            if(r.status === 401) handleInvalidAdminPassword();
            return;
          }
          showListMessage('削除しました: ' + targetName);
          loadTeachers(true);
        }).catch(function(){
          btn.disabled = false;
          showListMessage('通信に失敗しました', true);
        });
      });
    });

    host.querySelectorAll('button[data-action="save-display"]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.getAttribute('data-id');
        var article = btn.closest('article');
        var input = article ? article.querySelector('.edit-display-input') : null;
        if(!input) return;
        var val = (input.value || '').trim();
        btn.disabled = true;
        showListMessage('保存しています...');
        apiFetch('/api/admin/teachers/' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_name: val })
        }).then(function(r){
          btn.disabled = false;
          if(!r.ok){
            showListMessage('保存に失敗しました: ' + (((r.body && r.body.error) || r.status)), true);
            if(r.status === 401) handleInvalidAdminPassword();
            return;
          }
          showListMessage('表示名を更新しました。');
          loadTeachers(true);
        }).catch(function(){
          btn.disabled = false;
          showListMessage('通信に失敗しました', true);
        });
      });
    });

    host.querySelectorAll('button[data-action="save-ai-limit"]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.getAttribute('data-id');
        var article = btn.closest('article');
        var input = article ? article.querySelector('.teacher-ai-limit-input') : null;
        if(!input) return;
        var value = (input.value || '').trim();
        if(value !== '' && !/^\d+$/.test(value)){
          showListMessage('AI生成上限は0以上の整数、または空欄で入力してください。', true);
          return;
        }

        btn.disabled = true;
        showListMessage('AI生成上限を保存しています...');
        apiFetch('/api/admin/teachers/' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ai_generations_per_month_limit_override: value === '' ? null : Number(value)
          })
        }).then(function(r){
          btn.disabled = false;
          if(!r.ok){
            showListMessage('AI生成上限の保存に失敗しました: ' + (((r.body && r.body.error) || r.status)), true);
            if(r.status === 401) handleInvalidAdminPassword();
            return;
          }
          showListMessage('AI生成上限を更新しました。');
          loadTeachers(true);
        }).catch(function(){
          btn.disabled = false;
          showListMessage('通信に失敗しました', true);
        });
      });
    });

    host.querySelectorAll('button[data-action="save-password"]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.getAttribute('data-id');
        var article = btn.closest('article');
        var input = article ? article.querySelector('.teacher-password-input') : null;
        if(!input) return;
        var val = (input.value || '').trim();
        if(!val){
          showListMessage('新しいパスワードを入力してください。', true);
          return;
        }
        if(val.length < 6){
          showListMessage('パスワードは6文字以上で入力してください。', true);
          return;
        }
        btn.disabled = true;
        showListMessage('パスワードを更新しています...');
        apiFetch('/api/admin/teachers/' + encodeURIComponent(id) + '/password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: val })
        }).then(function(r){
          btn.disabled = false;
          if(!r.ok){
            showListMessage('パスワード更新に失敗しました: ' + (((r.body && r.body.error) || r.status)), true);
            if(r.status === 401) handleInvalidAdminPassword();
            return;
          }
          input.value = '';
          showListMessage('パスワードを更新しました。');
        }).catch(function(){
          btn.disabled = false;
          showListMessage('通信に失敗しました', true);
        });
      });
    });
  }

  function attachContactRequestActions(host){
    host.querySelectorAll('button[data-action="save-contact-request"]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.getAttribute('data-id');
        var article = btn.closest('article');
        var statusInput = article ? article.querySelector('.contact-request-status-input') : null;
        var noteInput = article ? article.querySelector('.contact-request-note-input') : null;
        if(!statusInput || !noteInput) return;

        btn.disabled = true;
        showContactListMessage('保存しています...');
        apiFetch('/api/admin/contact-requests/' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: statusInput.value,
            admin_note: noteInput.value
          })
        }).then(function(r){
          btn.disabled = false;
          if(!r.ok){
            showContactListMessage('保存に失敗しました: ' + (((r.body && r.body.error) || r.status)), true);
            if(r.status === 401) handleInvalidAdminPassword();
            return;
          }
          showContactListMessage('お問い合わせを更新しました。');
          loadContactRequests(true);
        }).catch(function(){
          btn.disabled = false;
          showContactListMessage('通信に失敗しました', true);
        });
      });
    });

    host.querySelectorAll('button[data-action="delete-contact-request"]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.getAttribute('data-id');
        var item = contactRequestItems.find(function(entry){ return String(entry.id) === String(id); });
        if(!item) return;
        if(!confirm('お問い合わせ「' + (item.name || '') + ' / ' + (item.email || '') + '」を削除します。\nこの操作は取り消せません。')) return;

        btn.disabled = true;
        showContactListMessage('削除しています...');
        apiFetch('/api/admin/contact-requests/' + encodeURIComponent(id), {
          method: 'DELETE'
        }).then(function(r){
          if(!r.ok){
            btn.disabled = false;
            showContactListMessage('削除に失敗しました: ' + (((r.body && r.body.error) || r.status)), true);
            if(r.status === 401) handleInvalidAdminPassword();
            return;
          }
          showContactListMessage('お問い合わせを削除しました。');
          loadContactRequests(true);
        }).catch(function(){
          btn.disabled = false;
          showContactListMessage('通信に失敗しました', true);
        });
      });
    });
  }

  function handleInvalidAdminPassword(){
    clearAdminPassword();
    redirectToLogin();
  }

  function loadTeachers(keepMessage){
    if(!getAdminPassword()){
      redirectToLogin();
      return;
    }
    if(!keepMessage) showListMessage('一覧を読み込んでいます...');
    showCreateMessage('');
    apiFetch('/api/admin/teachers').then(function(r){
      if(!r.ok){
        clearAdminPassword();
        redirectToLogin();
        return;
      }
      teacherItems = Array.isArray(r.body) ? r.body : [];
      if(!keepMessage) showListMessage('教師ユーザー ' + teacherItems.length + ' 人を表示しています。');
      renderTeacherList(teacherItems);
    }).catch(function(){
      showListMessage('通信に失敗しました。サーバーの状態を確認してください。', true);
    });
  }

  function loadPlans(keepMessage){
    if(!getAdminPassword()){
      redirectToLogin();
      return;
    }
    if(!keepMessage) showPlanMessage('プラン設定を読み込んでいます...');
    apiFetch('/api/admin/plans').then(function(r){
      if(!r.ok){
        clearAdminPassword();
        redirectToLogin();
        return;
      }
      planItems = Array.isArray(r.body) ? r.body : [];
      if(!keepMessage) showPlanMessage('プラン設定 ' + planItems.length + ' 件を表示しています。');
      renderPlanList(planItems);
    }).catch(function(){
      showPlanMessage('通信に失敗しました。サーバーの状態を確認してください。', true);
    });
  }

  function loadFeatureSettings(keepMessage){
    if(!getAdminPassword()){
      redirectToLogin();
      return;
    }
    if(!keepMessage) showFeatureMessage('機能設定を読み込んでいます...');
    apiFetch('/api/admin/settings').then(function(r){
      if(!r.ok){
        clearAdminPassword();
        redirectToLogin();
        return;
      }
      featureSettingItems = Array.isArray(r.body) ? r.body : [];
      if(!keepMessage) showFeatureMessage('機能設定 ' + featureSettingItems.length + ' 件を表示しています。');
      renderFeatureSettings(featureSettingItems);
    }).catch(function(){
      showFeatureMessage('通信に失敗しました。サーバーの状態を確認してください。', true);
    });
  }

  function loadPublicSettings(keepMessage){
    if(!getAdminPassword()){
      redirectToLogin();
      return;
    }
    if(!keepMessage) showPublicConfigMessage('公開設定を読み込んでいます...');
    apiFetch('/api/admin/settings').then(function(r){
      if(!r.ok){
        clearAdminPassword();
        redirectToLogin();
        return;
      }
      publicSettingItems = Array.isArray(r.body) ? r.body.filter(function(item){
        return item && item.key === 'feedback_form_url';
      }) : [];
      if(!keepMessage) showPublicConfigMessage('公開設定 ' + publicSettingItems.length + ' 件を表示しています。');
      renderPublicSettings(publicSettingItems);
    }).catch(function(){
      showPublicConfigMessage('通信に失敗しました。サーバーの状態を確認してください。', true);
    });
  }

  function loadContactRequests(keepMessage){
    if(!getAdminPassword()){
      redirectToLogin();
      return;
    }
    if(!keepMessage) showContactListMessage('一覧を読み込んでいます...');
    apiFetch('/api/admin/contact-requests').then(function(r){
      if(!r.ok){
        clearAdminPassword();
        redirectToLogin();
        return;
      }
      contactRequestItems = Array.isArray(r.body) ? r.body : [];
      if(!keepMessage) showContactListMessage('お問い合わせ ' + contactRequestItems.length + ' 件を表示しています。');
      renderContactRequestList(contactRequestItems);
    }).catch(function(){
      showContactListMessage('通信に失敗しました。サーバーの状態を確認してください。', true);
    });
  }

  var clearBtn = $('admin-clear');
  if(clearBtn){
    clearBtn.addEventListener('click', function(){
      clearAdminPassword();
      redirectToLanding();
    });
  }

  var createForm = $('teacher-create-form');
  if(createForm){
    createForm.addEventListener('submit', function(ev){
      ev.preventDefault();
      var username = ($('teacher-username') && $('teacher-username').value || '').trim();
      var displayName = ($('teacher-display-name') && $('teacher-display-name').value || '').trim();
      var password = ($('teacher-password') && $('teacher-password').value || '').trim();
      if(!username || !password){
        showCreateMessage('ユーザー名と初期パスワードは必須です。', true);
        return;
      }

      showCreateMessage('追加しています...');
      apiFetch('/api/admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, display_name: displayName, password: password })
      }).then(function(r){
        if(!r.ok){
          var msg = (r.body && r.body.error) || r.status;
          showCreateMessage('追加に失敗しました: ' + msg, true);
          if(r.status === 401) handleInvalidAdminPassword();
          return;
        }
        showCreateMessage('教師ユーザーを追加しました。');
        if($('teacher-username')) $('teacher-username').value = '';
        if($('teacher-display-name')) $('teacher-display-name').value = '';
        if($('teacher-password')) $('teacher-password').value = '';
        loadTeachers(true);
      }).catch(function(){
        showCreateMessage('通信に失敗しました', true);
      });
    });
  }

  if(!getAdminPassword()){
    redirectToLogin();
    return;
  }

  loadTeachers(false);
  loadFeatureSettings(false);
  loadPublicSettings(false);
  loadPlans(false);
  loadContactRequests(false);
})();
