/* LiftOS — Cognito auth helpers */
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

  async function cognitoIdpRequest(target, payload) {
    const res = await fetch(`https://cognito-idp.${global.cognitoConfig.region}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': target,
      },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  global.validateCognitoPassword = validateCognitoPassword;
  global.PASSWORD_HINT = PASSWORD_HINT;
  global.cognitoIdpRequest = cognitoIdpRequest;

  global.cognitoForgotPassword = async function (email) {
    if (!global.cognitoConfig?.clientId) throw new Error('Auth not configured.');
    const data = await cognitoIdpRequest(
      'AWSCognitoIdentityProviderService.ForgotPassword',
      { ClientId: global.cognitoConfig.clientId, Username: email.trim() },
    );
    if (data.__type) throw new Error(data.message || 'Could not send reset code');
    return data;
  };

  global.cognitoConfirmForgotPassword = async function (email, code, newPassword) {
    const err = validateCognitoPassword(newPassword);
    if (err) throw new Error(err);
    const data = await cognitoIdpRequest(
      'AWSCognitoIdentityProviderService.ConfirmForgotPassword',
      {
        ClientId: global.cognitoConfig.clientId,
        Username: email.trim(),
        ConfirmationCode: code.trim(),
        Password: newPassword,
      },
    );
    if (data.__type) throw new Error(data.message || 'Could not reset password');
    return data;
  };
})(window);
