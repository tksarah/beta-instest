const http = require('http');
const db = require('./db');

const port = parseInt(process.env.PORT, 10) || 3000;
const adminPassword = process.env.ADMIN_PASSWORD || 'test-admin';

function req(method, path, data, headers){
  const opts = {
    hostname: 'localhost',
    port,
    path,
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
  };
  return new Promise((resolve, reject) => {
    const request = http.request(opts, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let parsed = body;
        try{
          parsed = JSON.parse(body);
        }catch(_err){
          // keep raw body
        }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    request.on('error', reject);
    if(data) request.write(JSON.stringify(data));
    request.end();
  });
}

function dbAll(sql, params){
  return new Promise((resolve, reject) => {
    db.all(sql, params || [], (err, rows) => {
      if(err) return reject(err);
      resolve(rows || []);
    });
  });
}

function dbRun(sql, params){
  return new Promise((resolve, reject) => {
    db.run(sql, params || [], function(err){
      if(err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

(async () => {
  const createdIds = [];
  try{
    await dbRun('DELETE FROM contact_requests WHERE email IN (?, ?)', ['lp-contact-test@example.com', 'trim-check@example.com']);

    const missingFieldRes = await req('POST', '/api/contact-requests', { name: '田中' });
    assert(missingFieldRes.status === 400, 'name/email 必須チェックは 400 を返す必要があります');

    const invalidEmailRes = await req('POST', '/api/contact-requests', { name: '田中', email: 'invalid-email' });
    assert(invalidEmailRes.status === 400, '不正メールは 400 を返す必要があります');

    const createRes = await req('POST', '/api/contact-requests', {
      name: '  田中 花子  ',
      email: '  LP-CONTACT-TEST@example.com  '
    });
    assert(createRes.status === 200, '問い合わせ作成は成功する必要があります');
    assert(createRes.body && createRes.body.ok === true, '問い合わせ作成レスポンスの ok が必要です');
    assert(createRes.body.request && createRes.body.request.id, '問い合わせ作成レスポンスに ID が必要です');
    assert(createRes.body.request.name === '田中 花子', '名前は trim される必要があります');
    assert(createRes.body.request.email === 'lp-contact-test@example.com', 'メールは trim/lowercase される必要があります');
    assert(createRes.body.request.status === 'new', '新規問い合わせの初期 status は new である必要があります');
    assert(createRes.body.request.admin_note === '', '新規問い合わせの初期メモは空である必要があります');
    createdIds.push(createRes.body.request.id);

    const unauthorizedListRes = await req('GET', '/api/admin/contact-requests');
    assert(unauthorizedListRes.status === 401, '管理認証なし一覧取得は 401 を返す必要があります');

    const listRes = await req('GET', '/api/admin/contact-requests', null, { 'X-Admin-Password': adminPassword });
    assert(listRes.status === 200, '管理認証あり一覧取得は成功する必要があります');
    assert(Array.isArray(listRes.body), '一覧は配列で返る必要があります');
    assert(listRes.body.some(row => row.id === createRes.body.request.id && row.email === 'lp-contact-test@example.com'), '作成した問い合わせが一覧に含まれる必要があります');

    const updateRes = await req('PATCH', '/api/admin/contact-requests/' + createRes.body.request.id, {
      status: 'in_progress',
      admin_note: '初回連絡済み'
    }, { 'X-Admin-Password': adminPassword });
    assert(updateRes.status === 200, '管理認証あり更新は成功する必要があります');
    assert(updateRes.body && updateRes.body.status === 'in_progress', 'status 更新が反映される必要があります');
    assert(updateRes.body && updateRes.body.admin_note === '初回連絡済み', 'admin_note 更新が反映される必要があります');

    const extraCreateRes = await req('POST', '/api/contact-requests', {
      name: '確認用',
      email: 'trim-check@example.com'
    });
    assert(extraCreateRes.status === 200, '2件目の問い合わせ作成は成功する必要があります');
    createdIds.push(extraCreateRes.body.request.id);

    const unauthorizedDeleteRes = await req('DELETE', '/api/admin/contact-requests/' + createRes.body.request.id);
    assert(unauthorizedDeleteRes.status === 401, '管理認証なし削除は 401 を返す必要があります');

    const deleteRes = await req('DELETE', '/api/admin/contact-requests/' + createRes.body.request.id, null, { 'X-Admin-Password': adminPassword });
    assert(deleteRes.status === 200, '管理認証あり削除は成功する必要があります');
    assert(deleteRes.body && deleteRes.body.deleted === true, '削除レスポンスに deleted=true が必要です');

    const rowsAfterDelete = await dbAll('SELECT id FROM contact_requests WHERE id=?', [createRes.body.request.id]);
    assert(rowsAfterDelete.length === 0, '削除済み問い合わせはDBから消えている必要があります');
    createdIds.splice(createdIds.indexOf(createRes.body.request.id), 1);

    console.log('contact request api checks passed');
  }catch(err){
    console.error('ERROR', err);
    process.exitCode = 1;
  }finally{
    if(createdIds.length){
      try{
        await dbRun(
          'DELETE FROM contact_requests WHERE id IN (' + createdIds.map(() => '?').join(',') + ')',
          createdIds
        );
      }catch(_cleanupErr){
        // ignore cleanup failures in test script
      }
    }
  }
})();