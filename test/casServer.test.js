const utils = require('../lib/utils');
const expect = require('chai').expect;
const Express = require('express');
const url = require('url');
const http = require('http');
const rewire = require('rewire');
const casServerFactory = require('./lib/casServer');
const validate = rewire('../lib/validate.js');
const parseProxyTicketResponse = rewire('../lib/getProxyTicket.js').__get__('parseCasResponse');
const getPTThroughtRestletReq = rewire('../lib/getProxyTicketThroughRestletReq.js');

const logger = {
  info() {
  },
  error() {
  },
};

describe('cas server如预期', function() {

  it('访问/cas/login, 啥都不带, 直接响应200', function(done) {
    const app = new Express();

    casServerFactory(app);

    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;

      utils.getRequest('http://localhost:3004/cas/login', function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(200);

        server.close(function(err) {
          if (err) throw err;

          done();
        });
      });
    });
  });

  it('访问/cas/login,带service,当做成功登陆, 设置cookie, 302到service参数的路径, 带上ticket', function(done) {
    const app = new Express();

    casServerFactory(app);

    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;

      const service = 'http://localhost:3002/cas/validate';

      utils.getRequest(`http://localhost:3004/cas/login?service=${encodeURIComponent(service)}`, function(err, response) {
        if (err) throw err;

        // console.log('response', response);

        expect(response.status).to.equal(302);

        const serviceUri = url.parse(service, true);
        const locationUri = url.parse(response.header.location, true);


        expect(locationUri.host + locationUri.pathname).to.equal(serviceUri.host + locationUri.pathname);

        server.close(function(err) {
          if (err) throw err;

          done();
        });
      });
    });
  });

  it('访问/cas/serviceValidate, 没带ticket, 返回200, xml内authenticationFailure', function(done) {
    const app = new Express();

    casServerFactory(app);

    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;

      const service = 'http://localhost:3002/cas/validate';

      utils.getRequest(`http://localhost:3004/cas/serviceValidate?service=${encodeURIComponent(service)}`, function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(200);

        const parseCasResponse = validate.__get__('parseCasResponse');

        parseCasResponse(response.body, logger, function(err, info) {
          if (err) throw err;
          expect(info).to.deep.equal({});

          server.close(function(err) {
            if (err) throw err;

            done();
          });
        });
      });
    });
  });

  it('访问/cas/serviceValidate, 带ticket, 但是ticket非法, 返回200, xml内authenticationFailure', function(done) {
    const app = new Express();

    casServerFactory(app);

    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;

      const service = 'http://localhost:3002/cas/validate';

      utils.getRequest(`http://localhost:3004/cas/serviceValidate?service=${encodeURIComponent(service)}&ticket=xxx`, function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(200);

        const parseCasResponse = validate.__get__('parseCasResponse');

        parseCasResponse(response.body, logger, function(err, info) {
          if (err) throw err;
          expect(info).to.deep.equal({});

          server.close(function(err) {
            if (err) throw err;

            done();
          });
        });
      });
    });
  });

  it('访问/cas/serviceValidate, 带ticket, 但没带service, 返回200, xml内authenticationFailure', function(done) {
    const app = new Express();

    casServerFactory(app);

    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;

      utils.getRequest('http://localhost:3004/cas/serviceValidate?&ticket=xxx', function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(200);

        const parseCasResponse = validate.__get__('parseCasResponse');

        parseCasResponse(response.body, logger, function(err, info) {
          if (err) throw err;
          expect(info).to.deep.equal({});

          server.close(function(err) {
            if (err) throw err;

            done();
          });
        });
      });
    });
  });

  it('访问/cas/serviceValidate, 带ticket, ticket合法, 无pgtUrl, 直接响应成功xml, 带userId', function(done) {
    const app = new Express();

    casServerFactory(app);

    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;

      const service = 'http://localhost:3002/cas/validate';

      utils.getRequest(`http://localhost:3004/cas/login?service=${encodeURIComponent(service)}`, function(err, response) {
        if (err) throw err;

        const uri = url.parse(response.header.location, true);

        const ticket = uri.query.ticket;

        utils.getRequest(`http://localhost:3004/cas/serviceValidate?service=${encodeURIComponent(service)}&ticket=${ticket}`, function(err, response) {
          if (err) throw err;

          expect(response.status).to.equal(200);

          const parseCasResponse = validate.__get__('parseCasResponse');

          parseCasResponse(response.body, logger, function(err, info) {
            if (err) throw err;
            // expect(info).to.deep.equal({});

            expect(info.user).to.not.be.empty;

            server.close(function(err) {
              if (err) throw err;

              done();
            });
          });
        });
      });
    });
  });

  it('访问/cas/serviceValidate, 带ticket, ticket合法, 有pgtUrl, 先调pgtUrl, 传过去pgtIou和pgtId, 然后响应成功xml, 带userId和pgtIou', function(done) {
    const store = {};

    // cas server
    const casHost = 'http://localhost';
    const casPort = 3004;
    const app = new Express();
    casServerFactory(app);
    server = http.createServer(app);

    // cas client
    const localHost = 'http://localhost';
    const localPort = 3002;
    const appLocal = new Express();
    const serverLocal = http.createServer(appLocal);
    appLocal.get('/cas/proxyCallback', function(req, res) {
      if (req.query) {
        expect(req.query.pgtIou).to.not.be.empty;
        expect(req.query.pgtId).to.not.be.empty;
        store[req.query.pgtIou] = req.query.pgtId;
        res.send('ok');
      } else {
        res.sendStatus(400);
      }
    });

    serverLocal.listen(3002, function(err) {
      if (err) throw err;

      server.listen(3004, function(err) {
        if (err) throw err;

        const service = `${localHost}:${localPort}/cas/validate`;
        const pgtUrl = `${localHost}:${localPort}/cas/proxyCallback`;

        utils.getRequest(`http://localhost:3004/cas/login?service=${encodeURIComponent(service)}`, function(err, response) {
          if (err) throw err;

          const uri = url.parse(response.header.location, true);

          const ticket = uri.query.ticket;

          expect(ticket).to.not.be.empty;

          utils.getRequest(`http://localhost:3004/cas/serviceValidate?service=${encodeURIComponent(service)}&ticket=${ticket}&pgtUrl=${encodeURIComponent(pgtUrl)}`, function(err, response) {
            if (err) throw err;

            expect(response.status).to.equal(200);

            const parseCasResponse = validate.__get__('parseCasResponse');

            parseCasResponse(response.body, logger, function(err, info) {
              if (err) throw err;

              expect(info.user).to.not.be.empty;
              expect(info.proxyGrantingTicket).to.not.be.empty;

              expect(store[info.proxyGrantingTicket]).to.not.be.empty;

              server.close(function(err) {
                if (err) throw err;

                serverLocal.close(function(err) {
                  if (err) throw err;
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  it('访问/cas/serviceValidate, options设置期望的响应码, 接口响应对应响应码或响应内容', function(done) {

    // 期望状态码500
    const app1 = new Express();
    let server1;

    casServerFactory(app1, {
      expectStatus: 500,
    });

    server1 = http.createServer(app1);

    server1.listen(3004, function(err) {
      if (err) throw err;

      const service = 'http://localhost:3002/cas/validate';

      utils.getRequest(`http://localhost:3004/cas/login?service=${encodeURIComponent(service)}`, function(err, response) {
        if (err) throw err;

        const uri = url.parse(response.header.location, true);

        const ticket = uri.query.ticket;

        utils.getRequest(`http://localhost:3004/cas/serviceValidate?service=${encodeURIComponent(service)}&ticket=${ticket}`, function(err, response) {
          if (err) throw err;

          expect(response.status).to.equal(500);

          server1.close(function(err) {
            if (err) throw err;
          });
        });
      });
    });

    // 期望失败的xml响应
    const app2 = new Express();

    casServerFactory(app2, {
      expectStatus: 200,
      expectStatusStr: 'fail',
    });

    const server2 = http.createServer(app2);

    server2.listen(3005, function(err) {
      if (err) throw err;

      const service = 'http://localhost:3002/cas/validate';

      utils.getRequest(`http://localhost:3005/cas/login?service=${encodeURIComponent(service)}`, function(err, response) {
        if (err) throw err;

        const uri = url.parse(response.header.location, true);

        const ticket = uri.query.ticket;

        utils.getRequest(`http://localhost:3005/cas/serviceValidate?service=${encodeURIComponent(service)}&ticket=${ticket}`, function(err, response) {
          if (err) throw err;

          expect(response.status).to.equal(200);

          const parseCasResponse = validate.__get__('parseCasResponse');

          parseCasResponse(response.body, logger, function(err, info) {
            if (err) throw err;
            // expect(info).to.deep.equal({});

            expect(info.user).to.be.empty;

            server2.close(function(err) {
              if (err) throw err;

              done();
            });
          });
        });
      });
    });
  });

  it('/cas/proxy接口,参数正确能够正确获取pt', function(done) {
    const app = new Express();

    casServerFactory(app);

    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;

      utils.getRequest('http://localhost:3004/cas/proxy?pgt=fakePgtId&targetService=xxx', function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(200);
        expect(response.body).to.not.be.empty;

        let pt;

        if (/<cas:proxySuccess/.exec(response.body)) {
          if (/<cas:proxyTicket>(.*)<\/cas:proxyTicket>/.exec(response.body)) {
            pt = RegExp.$1;
          }
        }

        expect(pt).to.not.be.empty;

        server.close(function(err) {
          if (err) throw err;

          done();
        });
      });
    });
  });

  it('/cas/proxy接口,无pgt参数', function(done) {
    const app = new Express();

    casServerFactory(app);

    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;

      utils.getRequest('http://localhost:3004/cas/proxy?targetService=xxx', function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(200);
        expect(response.body).to.not.be.empty;

        let pt;

        if (/<cas:proxySuccess/.exec(response.body)) {
          if (/<cas:proxyTicket>(.*)<\/cas:proxyTicket>/.exec(response.body)) {
            pt = RegExp.$1;
          }
        }

        expect(pt).to.be.empty;

        server.close(function(err) {
          if (err) throw err;

          done();
        });
      });
    });
  });

  it('/cas/proxy接口,无targetService参数', function(done) {
    const app = new Express();

    casServerFactory(app);

    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;

      utils.getRequest('http://localhost:3004/cas/proxy?pgt=fakePgtId', function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(200);
        expect(response.body).to.not.be.empty;

        let pt;

        if (/<cas:proxySuccess/.exec(response.body)) {
          if (/<cas:proxyTicket>(.*)<\/cas:proxyTicket>/.exec(response.body)) {
            pt = RegExp.$1;
          }
        }

        expect(pt).to.be.empty;

        server.close(function(err) {
          if (err) throw err;

          done();
        });
      });
    });
  });

  it('/cas/v1/tickets接口, 参数全部正确, 返回新的pgtId, 能够正确调用/proxy接口换st', function(done) {
    const app = new Express();

    casServerFactory(app);

    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;

      const service = 'http://localhost:3002/cas/validate';

      utils.postRequest('http://localhost:3004/cas/v1/tickets', {
        username: 'username',
        password: 'password',
        type: 8,
        from: service,
      }, function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(200);

        const pgtId = getPTThroughtRestletReq.__get__('parseResponse')(response.body);

        expect(pgtId).to.not.be.empty;

        utils.getRequest(`http://localhost:3004/cas/proxy?pgt=${pgtId}&targetService=xxx`, function(err, response) {
          if (err) throw err;

          const pt = parseProxyTicketResponse(response.body);

          expect(response.status).to.equal(200);
          expect(pt).to.not.be.empty;

          server.close(function(err) {
            if (err) throw err;

            done();
          });
        });
      });
    });
  });

  it('/cas/v1/tickets接口, 参数异常, 响应400', function(done) {
    const app = new Express();

    casServerFactory(app);

    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;

      const service = 'http://localhost:3002/cas/validate';

      utils.postRequest('http://localhost:3004/cas/v1/tickets', {
        username: 'wrong_username',
        password: 'password',
        type: 8,
        from: service,
      }, function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(400);

        server.close(function(err) {
          if (err) throw err;

          done();
        });
      });
    });
  });

  it('/cas/v1/tickets/:tgt接口可以正常删除tgt', function(done) {
    const app = new Express();

    casServerFactory(app);

    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;

      const service = 'http://localhost:3002/cas/validate';

      utils.postRequest('http://localhost:3004/cas/v1/tickets', {
        username: 'username',
        password: 'password',
        type: 8,
        from: service,
      }, function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(200);

        const pgtId = getPTThroughtRestletReq.__get__('parseResponse')(response.body);

        expect(pgtId).to.not.be.empty;

        utils.getRequest(`http://localhost:3004/cas/proxy?pgt=${pgtId}&targetService=xxx`, function(err, response) {
          if (err) throw err;

          const pt = parseProxyTicketResponse(response.body);

          expect(response.status).to.equal(200);
          expect(pt).to.not.be.empty;

          utils.deleteRequest(`http://localhost:3004/cas/v1/tickets/${pgtId}`, function(err, response) {
            if (err) throw err;
            expect(response.status).to.equal(200);

            utils.getRequest(`http://localhost:3004/cas/proxy?pgt=${pgtId}&targetService=xxx`, function(err, response) {
              if (err) throw err;

              expect(response.status).to.equal(200);

              const nowPt = getPTThroughtRestletReq.__get__('parseResponse')(response.body);
              expect(nowPt).to.be.empty;

              server.close(function(err) {
                if (err) throw err;

                done();
              });
            });
          });
        });
      });
    });
  });
});
