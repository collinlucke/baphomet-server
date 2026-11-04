import jwt from 'jsonwebtoken';

export const generateToken = (user, secret, expiresIn) => {
  const { id, email, jti } = user;
  const payload = { id, email };
  if (jti) {
    payload.jti = jti;
  }
  return jwt.sign(payload, secret, {
    expiresIn
  });
};

export const tokenExpiresIn = role => (role === 'admin' ? '7d' : '30m');
