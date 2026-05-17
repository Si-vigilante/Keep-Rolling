let identityApiPromise;

async function getIdentityApi() {
  if (!identityApiPromise) {
    identityApiPromise = import("https://esm.sh/@netlify/identity");
  }
  return identityApiPromise;
}

export function authName(user) {
  if (!user) return "未登录";
  return user.name || user.user_metadata?.full_name || user.email || "王国成员";
}

export function authEmail(user) {
  return user?.email || "";
}

export function authErrorMessage(error) {
  const message = error?.message || "认证服务暂时不可用";
  const status = error?.status;
  if (status === 401) return "邮箱或密码不正确。";
  if (status === 403) return "当前站点未开放注册，或账号尚未确认。";
  if (status === 422) return "请检查邮箱格式和密码强度。";
  if (/identity/i.test(message) && /not/i.test(message)) return "请先在 Netlify 后台启用 Identity。";
  return message;
}

export async function initializeAuth({ onChange, onMessage } = {}) {
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
    settings: await api.getSettings().catch(() => null),
    unsubscribe,
  };
}

export async function loginWithEmail(email, password) {
  const api = await getIdentityApi();
  return api.login(email, password);
}

export async function signupWithEmail(email, password, name) {
  const api = await getIdentityApi();
  return api.signup(email, password, { full_name: name });
}

export async function logoutCurrentUser() {
  const api = await getIdentityApi();
  await api.logout();
}
