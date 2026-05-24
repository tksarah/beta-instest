require('dotenv').config();
const http = require('http');
const { URLSearchParams } = require('url');

const port = parseInt(process.env.PORT, 10) || 3000;
const adminPassword = process.env.ADMIN_PASSWORD || '';

function req(method, path, headers, payload){
  const opts = {
    hostname: 'localhost',
    port,
    path,
    method,
    headers: headers || {}
  };
  var bodyText = '';
  if(payload && typeof payload === 'object'){
    bodyText = JSON.stringify(payload);
    opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
    opts.headers['Content-Length'] = Buffer.byteLength(bodyText);
  }else if(typeof payload === 'string' && payload){
    bodyText = payload;
    opts.headers['Content-Length'] = Buffer.byteLength(bodyText);
  }
  return new Promise((resolve, reject) => {
    const request = http.request(opts, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let parsed = body;
        try{ parsed = JSON.parse(body); }catch(_err){}
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    request.on('error', reject);
    if(bodyText) request.write(bodyText);
    request.end();
  });
}

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

(async () => {
  try{
    const config = await req('GET', '/api/public-config');
    assert(config.status === 200, 'public config should be available');
    assert(config.body.beta_feedback_url === '', 'feedback URL should default to empty');
    assert(config.body && config.body.free_beta_limits, 'public config should include free beta limits');
    assert(config.body && config.body.feature_flags, 'public config should include feature flags');
    assert(typeof config.body.feature_flags.test_sets_management_enabled === 'boolean', 'test set management flag should be boolean');
    assert(Number.isInteger(config.body.free_beta_limits.classes) && config.body.free_beta_limits.classes >= 0, 'class limit should be a non-negative integer');
    assert(Number.isInteger(config.body.free_beta_limits.tests) && config.body.free_beta_limits.tests >= 0, 'test limit should be a non-negative integer');
    assert(Number.isInteger(config.body.free_beta_limits.students) && config.body.free_beta_limits.students >= 0, 'student limit should be a non-negative integer');
    assert(Number.isInteger(config.body.free_beta_limits.ai_generations_per_month) && config.body.free_beta_limits.ai_generations_per_month >= 0, 'AI generation limit should be a non-negative integer');

    if(adminPassword){
      const settings = await req('GET', '/api/admin/settings', { 'X-Admin-Password': adminPassword });
      assert(settings.status === 200, 'admin settings list should be available when admin auth is configured');
      assert(Array.isArray(settings.body), 'admin settings list should return an array');
      const feedbackSetting = settings.body.find(item => item && item.key === 'feedback_form_url');
      const testSetSetting = settings.body.find(item => item && item.key === 'test_sets_management_enabled');
      assert(feedbackSetting, 'feedback form URL setting should be listed');
      assert(feedbackSetting.value === '', 'feedback form URL should default to empty');
      assert(testSetSetting, 'test set management setting should be listed');
      assert(typeof testSetSetting.value === 'boolean', 'admin settings should expose feature flag as boolean');
      assert(testSetSetting.value === config.body.feature_flags.test_sets_management_enabled, 'admin settings and public config should expose the same feature flag state');

      var originalFeedbackUrl = feedbackSetting.value;
      try{
        const feedbackUrl = 'https://docs.google.com/forms/d/e/example/viewform?usp=pp_url&' + new URLSearchParams({ entry: 'instanttest-beta' }).toString();
        const feedbackUpdate = await req(
          'PATCH',
          '/api/admin/settings/feedback_form_url',
          { 'X-Admin-Password': adminPassword },
          { value: feedbackUrl }
        );
        assert(feedbackUpdate.status === 200, 'feedback form URL should be updateable');
        assert(feedbackUpdate.body && feedbackUpdate.body.value === feedbackUrl, 'feedback form URL update should echo saved value');

        const updatedConfig = await req('GET', '/api/public-config');
        assert(updatedConfig.status === 200, 'public config should still be available after updating feedback URL');
        assert(updatedConfig.body && updatedConfig.body.beta_feedback_url === feedbackUrl, 'public config should reflect saved feedback URL');
        assert(updatedConfig.body && updatedConfig.body.feature_flags, 'public config feature flags should still be available after update');
        assert(updatedConfig.body.feature_flags.test_sets_management_enabled === testSetSetting.value, 'updating feedback URL should not change feature flags');

        const plans = await req('GET', '/api/admin/plans', { 'X-Admin-Password': adminPassword });
        assert(plans.status === 200, 'admin plans list should be available when admin auth is configured');
        assert(Array.isArray(plans.body), 'admin plans list should return an array');
        const freeBetaPlan = plans.body.find(plan => plan && plan.code === 'free_beta');
        assert(freeBetaPlan, 'free_beta plan should be listed');
        assert(freeBetaPlan.limits && freeBetaPlan.limits.classes === updatedConfig.body.free_beta_limits.classes, 'free_beta class limit should match public config');
        assert(freeBetaPlan.limits && freeBetaPlan.limits.tests === updatedConfig.body.free_beta_limits.tests, 'free_beta test limit should match public config');
        assert(freeBetaPlan.limits && freeBetaPlan.limits.students === updatedConfig.body.free_beta_limits.students, 'free_beta student limit should match public config');
        assert(freeBetaPlan.limits && freeBetaPlan.limits.ai_generations_per_month === updatedConfig.body.free_beta_limits.ai_generations_per_month, 'free_beta AI limit should match public config');

        const tempUsername = 'ai-limit-test-' + Date.now();
        let tempTeacherId = null;
        try{
          const createdTeacher = await req(
            'POST',
            '/api/admin/teachers',
            { 'X-Admin-Password': adminPassword },
            { username: tempUsername, display_name: 'AI limit test', password: 'password123' }
          );
          assert(createdTeacher.status === 200, 'temporary teacher should be created');
          tempTeacherId = createdTeacher.body && createdTeacher.body.id;
          assert(tempTeacherId, 'temporary teacher id should be returned');

          const setOverride = await req(
            'PATCH',
            '/api/admin/teachers/' + tempTeacherId,
            { 'X-Admin-Password': adminPassword },
            { ai_generations_per_month_limit_override: 7 }
          );
          assert(setOverride.status === 200, 'teacher AI generation override should be updateable');
          assert(setOverride.body.ai_generations_per_month_limit_override === 7, 'teacher AI generation override should be echoed');
          assert(setOverride.body.effective_limits && setOverride.body.effective_limits.ai_generations_per_month === 7, 'teacher effective AI generation limit should use override');
          assert(setOverride.body.usage && Number.isInteger(setOverride.body.usage.ai_generations), 'teacher AI generation usage should be included');

          const invalidOverride = await req(
            'PATCH',
            '/api/admin/teachers/' + tempTeacherId,
            { 'X-Admin-Password': adminPassword },
            { ai_generations_per_month_limit_override: '1.5' }
          );
          assert(invalidOverride.status === 400, 'teacher AI generation override should reject decimals');

          const resetOverride = await req(
            'PATCH',
            '/api/admin/teachers/' + tempTeacherId,
            { 'X-Admin-Password': adminPassword },
            { ai_generations_per_month_limit_override: null }
          );
          assert(resetOverride.status === 200, 'teacher AI generation override should reset to plan default');
          assert(resetOverride.body.ai_generations_per_month_limit_override === null, 'teacher AI generation override should reset to null');
          assert(resetOverride.body.effective_limits && resetOverride.body.effective_limits.ai_generations_per_month === freeBetaPlan.limits.ai_generations_per_month, 'teacher effective AI generation limit should fall back to plan default');
        }finally{
          if(tempTeacherId){
            await req('DELETE', '/api/admin/teachers/' + tempTeacherId, { 'X-Admin-Password': adminPassword });
          }
        }
      }finally{
        await req(
          'PATCH',
          '/api/admin/settings/feedback_form_url',
          { 'X-Admin-Password': adminPassword },
          { value: originalFeedbackUrl }
        );
      }
    }

    const invalidCallback = await req('GET', '/api/auth/google/callback?state=bad&code=bad');
    assert(invalidCallback.status === 400, 'callback without matching state should be rejected');
    assert(invalidCallback.body && invalidCallback.body.error === 'invalid_oauth_state', 'invalid state error should be explicit');

    if(!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI){
      const start = await req('GET', '/api/auth/google/start');
      assert(start.status === 500, 'OAuth start should fail clearly when Google config is missing');
      assert(start.body && start.body.error === 'google_oauth_not_configured', 'missing Google config error should be explicit');
    }

    console.log('beta SaaS API checks passed');
  }catch(err){
    console.error('ERROR', err);
    process.exitCode = 1;
  }
})();
