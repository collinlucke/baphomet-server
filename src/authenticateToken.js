import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const protectedRoutes = [
    'updateMovie',
    'addMovie',
    'deleteMovie',
    'checkAuth'
  ];

  if (protectedRoutes.includes(req.body.operationName)) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.sendStatus(401);
        }
        return res.sendStatus(403);
      }
      next();
    });
  } else {
    next();
  }
};
