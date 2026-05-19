let identityApiPromise;

const IDENTITY_SETTINGS_PATH = "/.netlify/identity/settings";

async function getIdentityApi() {
  if (!identityApiPromise) {
    identityApiPromise = import("https://esm.sh/@netlify/identity");
  }
  return identityApiPromise;
}

function authSetupError(message, status = 503) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function checkIdentitySettings() {
  let response;
  try {
    response = await fetch(IDENTITY_SETTINGS_PATH, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw authSetupError("无法连接 Netlify Identity。请确认站点已部署到 Netlify，并在后台启用 Identity。");
  }

  if (response.status === 404) {
    throw authSetupError("Netlify Identity 尚未启用。请到 Netlify 后台 Project configuration > Identity 启用。", 404);
  }

  if (!response.ok) {
    throw authSetupError(`Netlify Identity 设置读取失败（${response.status}）。请检查站点 Identity 配置。`, response.status);
  }

  const settings = await response.json();
  if (settings.disable_signup) {
    throw authSetupError("当前站点关闭了公开注册。请在 Netlify Identity 中打开 Registration，或先用邀请创建测试账号。", 403);
  }

  return settings;
}

export function authName(user) {
  if (!user) return "未登录";
  return user.name || user.user_metadata?.full_name || user.email || "事克郎成员";
}

export function authEmail(user) {
  return user?.email || "";
}

export function authErrorMessage(error) {
  const message = error?.message || "认证服务暂时不可用";
  const status = error?.status;
  if (status === 404) return "Netlify Identity 尚未启用。请到 Netlify 后台 Project configuration > Identity 启用。";
  if (status === 401) return "邮箱或密码不正确。";
  if (status === 403) return "当前站点未开放注册，或账号尚未确认。";
  if (status === 422) return "请检查邮箱格式和密码强度。";
  if (/failed to fetch|network/i.test(message)) return "认证服务连接失败。请确认 Netlify Identity 已启用，并重新部署最新代码。";
  if (/identity/i.test(message) && /not/i.test(message)) return "请先在 Netlify 后台启用 Identity。";
  return message;
}

export async function initializeAuth({ onChange, onMessage } = {}) {
  const settings = await checkIdentitySettings();
  const api = await getIdentityApi();
  let callbackResult = null;

  try {
    callbackResult = await api.handleAuthCallback();
  } catch (error) {
    onMessage?.(authErrorMessage(error));
  }

  const currentUser = await api.getUser();
  onChange?.(currentUser);

  const unsubscribe = api.onAuthChange((event, user) => {
    onChange?.(user || null, event);
  });

  return {
    callbackResult,
    settings,
    unsubscribe,
  };
}

export async function loginWithEmail(email, password) {
  await checkIdentitySettings();
  const api = await getIdentityApi();
  return api.login(email, password);
}

export async function signupWithEmail(email, password, name) {
  await checkIdentitySettings();
  const api = await getIdentityApi();
  return api.signup(email, password, { full_name: name });
}

export async function logoutCurrentUser() {
  const api = await getIdentityApi();
  await api.logout();
}
