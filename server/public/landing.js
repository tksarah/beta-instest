(function(){
  function $(id){
    return document.getElementById(id);
  }

  function setFeedbackLinks(url){
    document.querySelectorAll('[data-feedback-link]').forEach(function(link){
      if(url){
        link.hidden = false;
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.removeAttribute('aria-disabled');
        return;
      }
      link.hidden = true;
      link.removeAttribute('href');
      link.removeAttribute('target');
      link.removeAttribute('rel');
      link.setAttribute('aria-disabled', 'true');
    });
  }

  function setLimitText(id, value){
    var node = $(id);
    if(!node) return;
    node.textContent = value == null || value === '' ? '無制限' : String(value);
  }

  function setFreeBetaLimits(limits){
    if(!limits) return;
    setLimitText('free-beta-limit-classes', limits.classes);
    setLimitText('free-beta-limit-tests', limits.tests);
    setLimitText('free-beta-limit-students', limits.students);
    setLimitText('free-beta-limit-ai', limits.ai_generations_per_month);
  }

  function setContactRequestStatus(text, isError){
    var status = $('contact-request-status');
    if(!status) return;
    status.textContent = text || '';
    status.style.color = isError ? '#b42318' : '';
  }

  function resetContactRequestForm(){
    var form = $('contact-request-form');
    if(form) form.reset();
    setContactRequestStatus('');
  }

  function openContactRequestModal(){
    var modal = $('contact-request-modal');
    var firstInput = $('contact-request-name');
    if(!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setContactRequestStatus('');
    if(firstInput) firstInput.focus();
  }

  function closeContactRequestModal(){
    var modal = $('contact-request-modal');
    if(!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    resetContactRequestForm();
  }

  function requestJson(url, options, fallbackMessage){
    return fetch(url, options || {}).then(function(response){
      return response.json().catch(function(){ return null; }).then(function(payload){
        if(!response.ok){
          throw new Error((payload && payload.error) || fallbackMessage || '通信に失敗しました');
        }
        return payload;
      });
    });
  }

  function isValidEmail(value){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  function handleContactRequestSubmit(event){
    var submitButton = $('contact-request-submit');
    var nameInput = $('contact-request-name');
    var emailInput = $('contact-request-email');
    var name = nameInput ? nameInput.value.trim() : '';
    var email = emailInput ? emailInput.value.trim() : '';

    event.preventDefault();
    setContactRequestStatus('');

    if(!name || !email){
      setContactRequestStatus('お名前とメールアドレスを入力してください。', true);
      return;
    }
    if(!isValidEmail(email)){
      setContactRequestStatus('メールアドレスの形式を確認してください。', true);
      return;
    }

    if(submitButton){
      submitButton.disabled = true;
      submitButton.textContent = '送信中...';
    }

    requestJson('/api/contact-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email })
    }, '送信に失敗しました。')
      .then(function(){
        resetContactRequestForm();
        setContactRequestStatus('送信を受け付けました。確認後、こちらからご連絡します。');
      })
      .catch(function(err){
        setContactRequestStatus(err && err.message ? err.message : '送信に失敗しました。', true);
      })
      .finally(function(){
        if(submitButton){
          submitButton.disabled = false;
          submitButton.textContent = '送信する';
        }
      });
  }

  function bindContactRequestModal(){
    var modal = $('contact-request-modal');
    var form = $('contact-request-form');
    var cancelButton = $('contact-request-cancel');
    if(!modal || !form) return;

    document.querySelectorAll('[data-open-contact-modal]').forEach(function(trigger){
      trigger.addEventListener('click', openContactRequestModal);
    });

    form.addEventListener('submit', handleContactRequestSubmit);
    if(cancelButton) cancelButton.addEventListener('click', closeContactRequestModal);

    modal.addEventListener('click', function(event){
      if(event.target === modal){
        closeContactRequestModal();
      }
    });

    document.addEventListener('keydown', function(event){
      if(event.key === 'Escape' && modal.style.display !== 'none'){
        closeContactRequestModal();
      }
    });
  }

  bindContactRequestModal();

  fetch('/api/public-config')
    .then(function(res){ return res.ok ? res.json() : null; })
    .then(function(config){
      setFeedbackLinks(config && config.beta_feedback_url ? config.beta_feedback_url : '');
      if(config && config.free_beta_limits){
        setFreeBetaLimits(config.free_beta_limits);
      }
    })
    .catch(function(){});
})();
