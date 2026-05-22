/* Auxos — Cognito auth helpers */
(function (global) {
  const PASSWORD_HINT =
    'At least 12 characters with uppercase, lowercase, a number, and a symbol.';

  function validateCognitoPassword(password) {
    if (!password || password.length < 12) {
      return 'Password must be at least 12 characters.';
    }
    if (!/[a-z]/.test(password)) return 'Include a lowercase letter.';
    if (!/[A-Z]/.test(password)) return 'Include an uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Include a number.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Include a symbol (e.g. ! @ #).';
    return null;
  }

  function cognitoConfig() {
    const cfg = global.cognitoConfig;
    if (!cfg?.region || !cfg?.clientId) {
      throw new Error('Auth not configured. Refresh the page or redeploy config.json.');
    }
    return cfg;
  }

  async function cognitoIdpRequest(target, payload) {
    const cfg = cognitoConfig();
    const res = await fetch(`https://cognito-idp.${cfg.region}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': target,
      },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  function decodeIdTokenPayload() {
    try {
      const raw = global.sessionStorage?.getItem?.("liftos_auth_v1");
      if (!raw) return null;
      const token = JSON.parse(raw).idToken;
      if (!token) return null;
      return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  }

  function getIdTokenEmail() {
    const payload = decodeIdTokenPayload();
    if (!payload) return null;
    return payload.email || payload["cognito:username"] || null;
  }

  function getIdTokenGroups() {
    const payload = decodeIdTokenPayload();
    const groups = payload?.["cognito:groups"];
    if (Array.isArray(groups)) return groups;
    if (typeof groups === "string" && groups) {
      return groups.split(",").map((g) => g.trim()).filter(Boolean);
    }
    return [];
  }

  function isCognitoAdmin() {
    return getIdTokenGroups().includes("admins");
  }

  global.validateCognitoPassword = validateCognitoPassword;
  global.PASSWORD_HINT = PASSWORD_HINT;
  global.cognitoIdpRequest = cognitoIdpRequest;
  global.decodeIdTokenPayload = decodeIdTokenPayload;
  global.getIdTokenEmail = getIdTokenEmail;
  global.getIdTokenGroups = getIdTokenGroups;
  global.isCognitoAdmin = isCognitoAdmin;

  global.cognitoForgotPassword = async function (email) {
    const cfg = cognitoConfig();
    const data = await cognitoIdpRequest(
      'AWSCognitoIdentityProviderService.ForgotPassword',
      { ClientId: cfg.clientId, Username: email.trim() },
    );
    if (data.__type) throw new Error(data.message || 'Could not send reset code');
    return data;
  };

  global.cognitoConfirmForgotPassword = async function (email, code, newPassword) {
    const err = validateCognitoPassword(newPassword);
    if (err) throw new Error(err);
    const cfg = cognitoConfig();
    const data = await cognitoIdpRequest(
      'AWSCognitoIdentityProviderService.ConfirmForgotPassword',
      {
        ClientId: cfg.clientId,
        Username: email.trim(),
        ConfirmationCode: code.trim(),
        Password: newPassword,
      },
    );
    if (data.__type) throw new Error(data.message || 'Could not reset password');
    return data;
  };
})(window);
