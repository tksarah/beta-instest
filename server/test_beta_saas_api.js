const http = require('http');

const port = parseInt(process.env.PORT, 10) || 3000;

function req(method, path, headers){
  const opts = {
    hostname: 'localhost',
    port,
    path,
    method,
    headers: headers || {}
  };
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
    assert(config.body && config.body.free_beta_limits, 'public config should include free beta limits');
    assert(config.body.free_beta_limits.classes === 10, 'default class limit should be 10');
    assert(config.body.free_beta_limits.tests === 100, 'default test limit should be 100');
    assert(config.body.free_beta_limits.students === 500, 'default student limit should be 500');
    assert(config.body.free_beta_limits.ai_generations_per_month === 50, 'default AI generation limit should be 50');

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
