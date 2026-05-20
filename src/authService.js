const LOCAL_STORAGE_KEY = "keep-rolling-users";

function getUsers() {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (data) {
    return JSON.parse(data);
  }
  const defaultUsers = [
    {
      id: "user-1234",
      email: "1234@test.com",
      password: "1234",
      user_metadata: { full_name: "测试用户" },
      emailVerified: true,
    },
  ];
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultUsers));
  return defaultUsers;
}

function saveUsers(users) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(users));
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
  try {
    const currentUser = JSON.parse(localStorage.getItem("keep-rolling-current-user") || "null");
    onChange?.(currentUser);

    return {
      callbackResult: null,
      settings: { allow_signup: true },
      unsubscribe: () => {},
    };
  } catch (error) {
    onMessage?.(authErrorMessage(error));
    return {
      callbackResult: null,
      settings: null,
      unsubscribe: () => {},
    };
  }
}

export async function loginWithEmail(email, password) {
  const users = getUsers();
  const user = users.find((u) => u.email === email && u.password === password);
  
  if (!user) {
    const error = new Error("邮箱或密码不正确");
    error.status = 401;
    throw error;
  }

  localStorage.setItem("keep-rolling-current-user", JSON.stringify(user));
  return user;
}

export async function signupWithEmail(email, password, name) {
  const users = getUsers();
  
  if (users.some((u) => u.email === email)) {
    const error = new Error("该邮箱已被注册");
    error.status = 422;
    throw error;
  }

  const newUser = {
    id: `user-${Date.now()}`,
    email: email,
    password: password,
    user_metadata: { full_name: name || "" },
    emailVerified: false,
  };

  users.push(newUser);
  saveUsers(users);
  
  localStorage.setItem("keep-rolling-current-user", JSON.stringify(newUser));
  return newUser;
}

export async function logoutCurrentUser() {
  localStorage.removeItem("keep-rolling-current-user");
}