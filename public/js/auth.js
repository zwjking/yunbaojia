/**
 * 登录 / 注册页
 */
import { icon, esc, toast, api } from './core.js';

export function authPage(mode = 'login') {
  const isLogin = mode === 'login';
  return `<div class="auth-page">
    <div class="auth-left">
      <a class="brand" href="#/" style="color:#fff">
        <span class="brand-mark">${icon('home', 18)}</span><span>云报价</span>
      </a>
      <h2>3 分钟出一份<br>专业家装报价</h2>
      <p>智能造价 · 工艺价格库 · 报价体检 · 客户分享<br>一套系统跑完整个报价流程。</p>
      <ul class="auth-points">
        <li>${icon('check', 16)} 内置 180+ 条家装工艺，开箱即用</li>
        <li>${icon('check', 16)} 15 项 AI 能力，按积分计费，成功才扣</li>
        <li>${icon('check', 16)} 12 种报价状态，从草稿跟到成交</li>
        <li>${icon('check', 16)} 本地部署，数据保存在你自己的服务器</li>
      </ul>
    </div>
    <div class="auth-right">
      <div class="auth-card">
        <div class="auth-tabs">
          <button class="${isLogin ? 'active' : ''}" data-switch="login">登录</button>
          <button class="${!isLogin ? 'active' : ''}" data-switch="register">注册</button>
        </div>

        ${isLogin ? loginForm() : registerForm()}
      </div>
      <div class="auth-tip" id="authTip">
        ${isLogin
    ? '支持手机号 + 密码，或手机号 + 验证码登录'
    : '注册即赠 30 积分 / 月，可立即体验 AI 智能造价'}
      </div>
    </div>
  </div>`;
}

function loginForm() {
  return `<div id="authBody">
    <div class="seg" style="margin-bottom:18px">
      <button class="active" data-mode="password">账号密码</button>
      <button data-mode="sms">短信验证码</button>
    </div>

    <div id="modePassword">
      <div class="field">
        <label class="field-label">手机号 / 邮箱</label>
        <input class="input" id="lgAccount" placeholder="请输入手机号" autocomplete="username">
      </div>
      <div class="field" style="margin-top:14px">
        <label class="field-label">密码</label>
        <input class="input" id="lgPwd" type="password" placeholder="请输入密码" autocomplete="current-password">
      </div>
      <button class="btn btn-primary btn-lg btn-block" id="btnLogin" style="margin-top:20px">
        登录 ${icon('arrowRight', 16)}
      </button>
    </div>

    <div id="modeSms" class="hide">
      <div class="field">
        <label class="field-label">手机号</label>
        <input class="input" id="smPhone" placeholder="请输入 11 位手机号">
      </div>
      <div class="field" style="margin-top:14px">
        <label class="field-label">验证码</label>
        <div class="row gap8">
          <input class="input" id="smCode" placeholder="6 位验证码" style="flex:1">
          <button class="btn btn-secondary" id="btnSendCode" style="flex:none;width:120px">获取验证码</button>
        </div>
        <div class="field-hint mt8" id="codeHint"></div>
      </div>
      <button class="btn btn-primary btn-lg btn-block" id="btnLoginSms" style="margin-top:20px">
        登录 / 注册 ${icon('arrowRight', 16)}
      </button>
    </div>
  </div>`;
}

function registerForm() {
  return `<div id="authBody">
    <div class="field">
      <label class="field-label">手机号</label>
      <input class="input" id="rgPhone" placeholder="请输入 11 位手机号">
    </div>
    <div class="field" style="margin-top:14px">
      <label class="field-label">你的称呼</label>
      <input class="input" id="rgName" placeholder="如：王工 / 小李">
    </div>
    <div class="field" style="margin-top:14px">
      <label class="field-label">密码</label>
      <input class="input" id="rgPwd" type="password" placeholder="至少 6 位">
    </div>
    <div class="field" style="margin-top:14px">
      <label class="field-label">验证码（选填）</label>
      <div class="row gap8">
        <input class="input" id="rgCode" placeholder="可不填" style="flex:1">
        <button class="btn btn-secondary" id="btnRgCode" style="flex:none;width:120px">获取验证码</button>
      </div>
    </div>
    <button class="btn btn-primary btn-lg btn-block" id="btnRegister" style="margin-top:20px">
      注册并进入 ${icon('arrowRight', 16)}
    </button>
    <p class="t-xs muted" style="margin-top:14px;text-align:center;line-height:1.7">
      注册即表示同意 <a href="#/terms">服务条款</a> 与 <a href="#/privacy">隐私政策</a>
    </p>
  </div>`;
}

export function bindAuth(root, mode) {
  const card = root.querySelector('.auth-card');

  // 切换登录/注册
  root.querySelectorAll('[data-switch]').forEach((b) => {
    b.addEventListener('click', () => {
      location.hash = b.dataset.switch === 'login' ? '#/login' : '#/register';
    });
  });

  // 登录方式切换
  root.querySelectorAll('[data-mode]').forEach((b) => {
    b.addEventListener('click', () => {
      root.querySelectorAll('[data-mode]').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const isPwd = b.dataset.mode === 'password';
      root.querySelector('#modePassword').classList.toggle('hide', !isPwd);
      root.querySelector('#modeSms').classList.toggle('hide', isPwd);
    });
  });

  const goApp = (user) => {
    api.user = user;
    toast(`欢迎回来，${user.name || user.phone}`, 'success');
    location.hash = '#/app/dashboard';
  };

  /* 密码登录 */
  const btnLogin = root.querySelector('#btnLogin');
  if (btnLogin) {
    btnLogin.onclick = async () => {
      const account = root.querySelector('#lgAccount').value.trim();
      const password = root.querySelector('#lgPwd').value;
      if (!account || !password) return toast('请输入账号和密码', 'error');
      btnLogin.disabled = true;
      btnLogin.innerHTML = `<span class="spinner"></span>登录中`;
      try {
        const r = await api.post('/auth/login', { account, password });
        api.token = r.access_token;
        goApp(r.user);
      } catch (e) {
        toast(e.message, 'error');
        btnLogin.disabled = false;
        btnLogin.innerHTML = `登录 ${icon('arrowRight', 16)}`;
      }
    };
    // 回车登录
    root.querySelector('#lgPwd').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnLogin.click();
    });
  }

  /* 发送验证码 */
  const sendCode = async (phoneInput, hintEl, btn) => {
    const phone = phoneInput.value.trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) return toast('请输入正确的 11 位手机号', 'error');
    btn.disabled = true;
    try {
      const r = await api.post('/auth/sms-code/send', { phone });
      if (hintEl) {
        hintEl.innerHTML = `本地模式验证码：<b style="color:var(--brand)">${r.dev_code}</b>（5 分钟内有效）`;
      }
      toast('验证码已发送', 'success');
      let n = 60;
      btn.textContent = `${n}s 后重发`;
      const t = setInterval(() => {
        n -= 1;
        if (n <= 0) { clearInterval(t); btn.disabled = false; btn.textContent = '获取验证码'; }
        else btn.textContent = `${n}s 后重发`;
      }, 1000);
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false;
    }
  };

  const btnSendCode = root.querySelector('#btnSendCode');
  if (btnSendCode) {
    btnSendCode.onclick = () => sendCode(root.querySelector('#smPhone'), root.querySelector('#codeHint'), btnSendCode);
  }

  /* 验证码登录 */
  const btnLoginSms = root.querySelector('#btnLoginSms');
  if (btnLoginSms) {
    btnLoginSms.onclick = async () => {
      const phone = root.querySelector('#smPhone').value.trim();
      const code = root.querySelector('#smCode').value.trim();
      if (!phone || !code) return toast('请输入手机号和验证码', 'error');
      btnLoginSms.disabled = true;
      try {
        const r = await api.post('/auth/login-sms', { phone, code });
        api.token = r.access_token;
        goApp(r.user);
      } catch (e) {
        toast(e.message, 'error');
        btnLoginSms.disabled = false;
      }
    };
  }

  /* 注册 */
  const btnRegister = root.querySelector('#btnRegister');
  if (btnRegister) {
    const btnRgCode = root.querySelector('#btnRgCode');
    if (btnRgCode) {
      btnRgCode.onclick = () => sendCode(root.querySelector('#rgPhone'), null, btnRgCode);
    }
    btnRegister.onclick = async () => {
      const phone = root.querySelector('#rgPhone').value.trim();
      const name = root.querySelector('#rgName').value.trim();
      const password = root.querySelector('#rgPwd').value;
      const code = root.querySelector('#rgCode').value.trim();
      if (!/^1[3-9]\d{9}$/.test(phone)) return toast('请输入正确的 11 位手机号', 'error');
      if (password.length < 6) return toast('密码至少 6 位', 'error');
      btnRegister.disabled = true;
      try {
        const r = await api.post('/auth/register', { phone, name, password, code });
        api.token = r.access_token;
        goApp(r.user);
      } catch (e) {
        toast(e.message, 'error');
        btnRegister.disabled = false;
      }
    };
  }
}
