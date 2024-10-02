import jwt from 'jsonwebtoken';

export const generateToken = (user, secret, expiresIn) => {
  const { id, email } = user;
  return jwt.sign({ id, email }, secret, {
    expiresIn
  });
};
