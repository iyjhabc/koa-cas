const Koa = require('koa');
const co = require('co');
const convert = require('koa-convert');
const bodyParser = require('koa-bodyparser');
const cookie = require('koa-cookie');
const json = require('koa-json');
const {
  toArray,
  getPath,
  isMatchRule,
  getOrigin,
  shouldIgnore,
  getLastUrl,
  getRequest,
  postRequest,
  deleteRequest,
  getLogger,
} = require('../lib/utils');
const { expect } = require('chai');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

describe('utils单元测试', () => {
  const localPath = 'http://localhost:3002';
  const port = 3002;
  const httpsPort = 3003;
  const httpsLocalPath = 'https://localhost:3003';

  const loggerFactory = function (ctx, type) { // eslint-disable-line
    return function () {};
  };

  let app;
  let server;
  let httpsServer;

  before((done) => {
    app = new Koa();
    app.keys = ['cas', 'test'];
    app.use(convert.back(cookie.default('here is some secret')));
    app.use(bodyParser());
    app.use(convert.back(json()));

    app.use(function* (next) {
      if (this.path === '/') {
        switch (this.method) {
          case 'GET':
            this.body = {
              message: 'ok',
            };
            return;
          case 'DELETE':
            this.body = {
              message: 'ok',
            };
            return;
          case 'POST':
            this.body = this.request.body;
            return;
          default:
            this.body = {
              message: 'Not Found',
            };

        }
      } else {
        return yield next;
      }
    });

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const libRoot = path.resolve(__dirname, './lib');

    const options = {
      key: fs.readFileSync(`${libRoot}/client-key.pem`),
      cert: fs.readFileSync(`${libRoot}/client-cert.pem`),
      requestCert: false,
      rejectUnhauthorized: false,
    };

    server = http.createServer(app.callback()).listen(port, (err) => {
      if (err) throw err;

      httpsServer = https.createServer(options, app.callback()).listen(httpsPort, (err) => {
        if (err) throw err;
        done();
      });
    });
  });

  after((done) => {
    server.close((err) => {
      if (err) throw err;

      httpsServer.close((err) => {
        if (err) throw err;
        done();
      });
    });
  });

  it('toArray, 传入伪数组, 输出真正数组', () => {
    function aFunction() {
      expect(toArray(arguments)).to.be.a('array');
      expect(toArray(null)).to.be.a('array');
      expect(toArray(undefined)).to.be.a('array');
      expect(toArray(NaN)).to.be.a('array');
      expect(toArray(1)).to.be.a('array');
      expect(toArray('hi')).to.be.a('array');
      expect(toArray({})).to.be.a('array');
    }

    aFunction(1, 2, 3);
  });

  it('getPath传入指定名称, 返回拼好的路径', () => {
    const options = {
      servicePrefix: 'http://localhost:8080',
      serverPath: 'http://cas.sdet.wsd.com',
      paths: {
        validate: '/cas/validate',
        serviceValidate: '/cas/serviceValidate',
        proxy: '/cas/proxy',
        login: '/cas/login',
        logout: '/cas/logout',
        proxyCallback: '/cas/proxyCallback',
        restletIntegration: '/cas/v1/tickets',
      },
      supportSubDomain: false,
    };
    const ctx = { origin: '' };

    expect(getPath(ctx, 'login', options)).to.equal(`http://cas.sdet.wsd.com/cas/login?service=${encodeURIComponent('http://localhost:8080/cas/validate')}`);
    expect(getPath(ctx, 'logout', options)).to.equal(`http://cas.sdet.wsd.com/cas/logout?service=${encodeURIComponent('http://localhost:8080/cas/validate')}`);
    expect(getPath(ctx, 'pgtUrl', options)).to.equal('http://localhost:8080/cas/proxyCallback');

    // absolute path
    expect(getPath(ctx, 'pgtUrl', {
      servicePrefix: 'http://localhost:8080',
      serverPath: 'http://cas.sdet.wsd.com',
      paths: {
        validate: '/cas/validate',
        serviceValidate: '/cas/serviceValidate',
        proxy: '/cas/proxy',
        login: '/cas/login',
        logout: '/cas/logout',
        proxyCallback: 'http://10.17.86.87:8080/cas/proxyCallback',
        restletIntegration: '/cas/v1/tickets',
      },
    })).to.equal('http://10.17.86.87:8080/cas/proxyCallback');

    expect(getPath(ctx, 'serviceValidate', options)).to.equal('http://cas.sdet.wsd.com/cas/serviceValidate');
    expect(getPath(ctx, 'proxy', options)).to.equal('http://cas.sdet.wsd.com/cas/proxy');
    expect(getPath(ctx, 'service', options)).to.equal('http://localhost:8080/cas/validate');
    expect(getPath(ctx, 'validate', options)).to.equal('http://localhost:8080/cas/validate');

    expect(getPath(ctx, 'restletIntegration', options)).to.equal('http://cas.sdet.wsd.com/cas/v1/tickets');
  });

  it('getPath传入指定名称, 支持subdomain, 返回拼好的路径', () => {
    const options = {
      servicePrefix: 'http://localhost:8080',
      serverPath: 'http://cas.sdet.wsd.com',
      paths: {
        validate: '/cas/validate',
        serviceValidate: '/cas/serviceValidate',
        proxy: '/cas/proxy',
        login: '/cas/login',
        logout: '/cas/logout',
        proxyCallback: '/cas/proxyCallback',
        restletIntegration: '/cas/v1/tickets',
      },
      supportSubDomain: true,
    };
    const ctx = { origin: 'http://subdomain.localhost:8080' };
    expect(getPath(ctx, 'login', options)).to.equal(`http://cas.sdet.wsd.com/cas/login?service=${encodeURIComponent('http://subdomain.localhost:8080/cas/validate')}`);
    expect(getPath(ctx, 'logout', options)).to.equal(`http://cas.sdet.wsd.com/cas/logout?service=${encodeURIComponent('http://subdomain.localhost:8080/cas/validate')}`);
    expect(getPath(ctx, 'pgtUrl', options)).to.equal('http://localhost:8080/cas/proxyCallback');

    // absolute path
    expect(getPath(ctx, 'pgtUrl', {
      servicePrefix: 'http://localhost:8080',
      serverPath: 'http://cas.sdet.wsd.com',
      paths: {
        validate: '/cas/validate',
        serviceValidate: '/cas/serviceValidate',
        proxy: '/cas/proxy',
        login: '/cas/login',
        logout: '/cas/logout',
        proxyCallback: 'http://10.17.86.87:8080/cas/proxyCallback',
        restletIntegration: '/cas/v1/tickets',
      },
    })).to.equal('http://10.17.86.87:8080/cas/proxyCallback');

    expect(getPath(ctx, 'serviceValidate', options)).to.equal('http://cas.sdet.wsd.com/cas/serviceValidate');
    expect(getPath(ctx, 'proxy', options)).to.equal('http://cas.sdet.wsd.com/cas/proxy');
    expect(getPath(ctx, 'service', options)).to.equal('http://subdomain.localhost:8080/cas/validate');
    expect(getPath(ctx, 'validate', options)).to.equal('http://subdomain.localhost:8080/cas/validate');

    expect(getPath(ctx, 'restletIntegration', options)).to.equal('http://cas.sdet.wsd.com/cas/v1/tickets');
  });


  it('utils.getPath(ctx, pgtUrl, options) servicePrefix中配置子路径', () => {
    const ctx = { origin: '' };
    const options = {
      servicePrefix: 'http://localhost:8080/ci',
      serverPath: 'http://cas.sdet.wsd.com',
      paths: {
        validate: '/ci/cas/validate',
        serviceValidate: '/cas/serviceValidate',
        proxy: '/cas/proxy',
        login: '/cas/login',
        logout: '/cas/logout',
        proxyCallback: '/ci/cas/proxyCallback',
        restletIntegration: '/cas/v1/tickets',
      },
    };
    expect(getPath(ctx, 'pgtUrl', options)).to.equal('http://localhost:8080/ci/cas/proxyCallback');
    expect(getPath(ctx, 'validate', options)).to.equal('http://localhost:8080/ci/cas/validate');
  });

  it('isMatchRule校验规则符合预期', () => {
    const ctx = {
      path: '/',
    };

    expect(isMatchRule(ctx, '/', '/')).to.be.true;
    expect(isMatchRule(ctx, '/', '/api')).to.be.false;

    expect(isMatchRule(ctx, '/', /\//)).to.be.true;
    expect(isMatchRule(ctx, '/', /\/api/)).to.be.false;

    expect(isMatchRule(ctx, '/', function (path, ctx) { //eslint-disable-line
      return path === '/';
    })).to.be.true;

    expect(isMatchRule(ctx, '/', function (path, ctx) { //eslint-disable-line
      return path === '/api';
    })).to.be.false;
  });

  it('getOrigin能够获取正确原始路径', () => {
    const ctx = {
      origin: 'http://localhost:8080/api',
      query: {
        ticket: 'some ticket',
      },
    };
    expect(getOrigin(ctx, {
      servicePrefix: 'http://localhost:8080',
      serverPath: 'http://cas.sdet.wsd.com',
      paths: {
        validate: '/cas/validate',
        serviceValidate: '/cas/serviceValidate',
        proxy: '/cas/proxy',
        login: '/cas/login',
        logout: '/cas/logout',
        proxyCallback: 'http://10.17.86.87:8080/cas/proxyCallback',
        restletIntegration: '/cas/v1/tickets',
      },
    })).to.equal('http://localhost:8080/api');
  });

  it('shouldIgnore能够正确的解析规则', () => {
    const ctx = {
      path: '/',
    };

    expect(shouldIgnore(ctx, {
      match: ['/'],
      logger: loggerFactory,
    })).to.be.false;

    expect(shouldIgnore(ctx, {
      match: ['/api'],
      logger: loggerFactory,
    })).to.be.true;

    expect(shouldIgnore(ctx, {
      match: [/\//],
      logger: loggerFactory,
    })).to.be.false;

    expect(shouldIgnore(ctx, {
      match: [/\/api/],
      logger: loggerFactory,
    })).to.be.true;

    expect(shouldIgnore(ctx, {
      match: [ function(pathname, ctx) { // eslint-disable-line
        return pathname === '/';
      }],
      logger: loggerFactory,
    })).to.be.false;

    expect(shouldIgnore(ctx, {
      match: [ function(pathname, ctx) { // eslint-disable-line
        return pathname === '/api';
      }],
      logger: loggerFactory,
    })).to.be.true;

    expect(shouldIgnore(ctx, {
      ignore: ['/'],
      logger: loggerFactory,
    })).to.be.true;

    expect(shouldIgnore(ctx, {
      ignore: ['/api'],
      logger: loggerFactory,
    })).to.be.false;

    expect(shouldIgnore(ctx, {
      ignore: [/\//],
      logger: loggerFactory,
    })).to.be.true;

    expect(shouldIgnore(ctx, {
      ignore: [/\/api/],
      logger: loggerFactory,
    })).to.be.false;

    expect(shouldIgnore(ctx, {
      ignore: [ function(pathname, ctx) { // eslint-disable-line
        return pathname === '/';
      }],
      logger: loggerFactory,
    })).to.be.true;

    expect(shouldIgnore(ctx, {
      ignore: [ function(pathname, ctx) { // eslint-disable-line
        return pathname === '/api';
      }],
      logger: loggerFactory,
    })).to.be.false;

    expect(shouldIgnore(ctx, {
      ignore: [],
      match: [],
      logger: loggerFactory,
    })).to.be.false;
  });

  it('getLastUrl能够正确的获取最后的访问路径, 并设置默认值', () => {
    const options = {
      servicePrefix: 'http://localhost:8080',
      serverPath: 'http://cas.sdet.wsd.com',
      paths: {
        validate: '/cas/validate',
        serviceValidate: '/cas/serviceValidate',
        proxy: '/cas/proxy',
        login: '/cas/login',
        logout: '/cas/logout',
        proxyCallback: '/cas/proxyCallback',
        restletIntegration: '/cas/v1/tickets',
      },
      logger: loggerFactory,
    };

    expect(getLastUrl({
      session: {
        lastUrl: 'http://localhost:8080/api',
      },
    }, options)).to.equal('http://localhost:8080/api');

    expect(getLastUrl({
      session: {
        lastUrl: 'http://localhost:8080/',
      },
    }, options)).to.equal('http://localhost:8080/');

    expect(getLastUrl({
      session: {
        lastUrl: 'http://localhost:8080/cas/validate',
      },
    }, options)).to.equal('/');

    expect(getLastUrl({
      session: {
        lastUrl: 'http://dcf.qq.com/oa/cas/node-cas',
      },
    }, Object.assign({}, options, {
      servicePrefix: 'http://dcf.qq.com',
      paths: {
        validate: '/oa/cas/node-cas',
      },
    }))).to.equal('/');

    expect(getLastUrl({}, options)).to.equal('/');
  });

  it('getRequest能够正确发送http GET请求,接收请求', (done) => {
    co(function* () {
      const res = yield getRequest(localPath);
      expect(res.status).to.equal(200);
      expect(res.body.replace(/\s*/g, '')).to.equal(JSON.stringify({
        message: 'ok',
      }));
      done();
    }).catch(done);
  });

  it('getRequest能够正确发送https GET请求,接收请求', (done) => {
    co(function* () {
      const res = yield getRequest(httpsLocalPath);
      expect(res.status).to.equal(200);
      expect(res.body.replace(/\s*/g, '')).to.equal(JSON.stringify({ message: 'ok' }));
      done();
    }).catch(done);
  });

  it('postRequest能够正确发送http POST请求,接收请求', (done) => {
    co(function* () {
      const data = {
        hello: 'world',
      };

      const res = yield postRequest(localPath, data);
      expect(res.status).to.equal(200);
      expect(res.body.replace(/\s*/g, '')).to.equal(JSON.stringify(data));
      done();
    }).catch(done);
  });

  it('postRequest能够正确发送http POST请求, 设置特殊头, 并接收请求', (done) => {
    co(function* () {
      const data = {
        hello: 'world',
      };

      const res = yield postRequest(localPath, data, {
        headers: {
          Cookie: 'Content-Type: application/json',
        },
      });
      expect(res.status).to.equal(200);
      expect(res.body.replace(/\s*/g, '')).to.equal(JSON.stringify(data));
      done();
    }).catch(done);
  });

  it('postRequest能够正确发送https POST请求,接收请求', (done) => {
    co(function* () {
      const data = {
        hello: 'world',
      };

      const res = yield postRequest(httpsLocalPath, data);
      expect(res.status).to.equal(200);
      expect(res.body.replace(/\s*/g, '')).to.equal(JSON.stringify(data));
      done();
    }).catch(done);
  });

  it('deleteRequest能够正确发送http DELETE请求,接收请求', (done) => {
    co(function* () {
      const res = yield deleteRequest(localPath);
      expect(res.status).to.equal(200);
      expect(res.body.replace(/\s*/g, '')).to.equal(JSON.stringify({
        message: 'ok',
      }));
      done();
    }).catch(done);
  });

  it('deleteRequest能够正确发送https DELETE请求,接收请求', (done) => {
    co(function* () {
      const res = yield deleteRequest(httpsLocalPath);
      expect(res.status).to.equal(200);
      expect(res.body.replace(/\s*/g, '')).to.equal(JSON.stringify({
        message: 'ok',
      }));
      done();
    }).catch(done);
  });

  it('getLogger工作正常', (done) => {
    const app = new Koa();
    app.use(function* (next) {
      function getLogger(type) {
        let user = 'unknown';
        try {
          user = this.session.cas.user;
        } catch (e) {} // eslint-disable-line

        if (!console[type]) {
          console.error('invalid console type', type);
          type = 'log';
        }

        return console[type].bind(console[type], `${this.sn}|`, `${user}|`, `${this.ip}|`);
      }

      this.getLogger = getLogger;
      return yield next;
    });

    app.use(function* (next) {
      let logger = getLogger(this, {
        logger(ctx, type) {
          return ctx.getLogger(type);
        },
      });

      expect(typeof logger.info).to.equal('function');
      expect(typeof logger.warn).to.equal('function');
      expect(typeof logger.error).to.equal('function');
      expect(typeof logger.log).to.equal('function');

      logger = getLogger(this);

      expect(typeof logger.info).to.equal('function');
      expect(typeof logger.warn).to.equal('function');
      expect(typeof logger.error).to.equal('function');
      expect(typeof logger.log).to.equal('function');
      return yield next;
    });

    app.use(function* (next) {
      if (this.path === '/') {
        this.body = 'ok';
        return;
      }
      return yield next;
    });
    let server;
    co(function* () {
      yield new Promise((r, j) => server = app.listen(3004, err => err ? j(err) : r()));
      yield getRequest('http://localhost:3004/');
      yield new Promise((r, j) => server.close(err => err ? j(err) : r()));
      done();
    }).catch(done);
  });
});
