(function(){
  function setFeedbackLinks(url){
    if(!url) return;
    document.querySelectorAll('[data-feedback-link]').forEach(function(link){
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  }

  fetch('/api/public-config')
    .then(function(res){ return res.ok ? res.json() : null; })
    .then(function(config){
      if(config && config.beta_feedback_url){
        setFeedbackLinks(config.beta_feedback_url);
      }
    })
    .catch(function(){});
})();
