import { randomUUID } from 'node:crypto';
import { db } from '../dBConnection.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { generateToken, tokenExpiresIn } from '../generateToken.js';

const buildAuthTokens = (user, refreshTokenId) => {
  const expiresIn = tokenExpiresIn(user.role);
  const subject = { id: user.id, email: user.email };

  return {
    token: generateToken(
      subject,
      process.env.ACCESS_TOKEN_SECRET,
      expiresIn
    ),
    refreshToken: generateToken(
      { ...subject, jti: refreshTokenId },
      process.env.REFRESH_TOKEN_SECRET,
      expiresIn
    )
  };
};

const toAuthUser = user => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  avatarUrl: user.avatarUrl,
  birthday: user.birthday,
  username: user.username,
  email: user.email,
  displayName: user.displayName,
  totalVotes: user.totalVotes || 0,
  joinDate: (user.joinDate || user.createdAt).toISOString(),
  role: user.role || 'user',
  emailVerified: user.emailVerified || false
});

export const userResolvers = {
  Query: {
    // ----- CHECK AUTH ----- //
    async checkAuth(_, args) {
      const token = args.token;

      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        return { isValid: true, message: 'Token is valid' };
      } catch (error) {
        return { isValid: false, message: error.message };
      }
    },
    // ----- GET USER DETAILS ----- //
    async getUserDetails(_, { userId }, context) {
      const usersCollection = db.collection('users');
      const votesCollection = db.collection('votes');
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (!user) return null;

      const totalVotes = await votesCollection.countDocuments({
        userId: userId
      });

      return {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        totalVotes,
        joinDate: user.joinDate,
        role: user.role,
        avatarUrl: user.avatarUrl,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified
      };
    },

    // ----- GET USER LEADERBOARD ----- //
    async getUserLeaderboard(_, { cursor = '' }, context) {
      const usersCollection = db.collection('users');
      const queryConditions = [];

      if (cursor) {
        try {
          const cursorData = JSON.parse(cursor);
          queryConditions.push({
            $or: [
              { totalVotes: { $lt: cursorData.totalVotes } },
              {
                totalVotes: cursorData.totalVotes,
                joinDate: { $gt: new Date(cursorData.joinDate) }
              }
            ]
          });
        } catch (error) {
          console.warn(
            'Invalid cursor provided to getUserLeaderboard:',
            cursor
          );
        }
      }

      const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

      const users = await usersCollection
        .find(query)
        .sort({ totalVotes: -1, joinDate: 1 })
        .limit(25)
        .toArray();
      const endOfResults = users.length < 25;

      let newCursor = '';
      if (users.length > 0 && !endOfResults) {
        const lastUser = users[users.length - 1];
        newCursor = JSON.stringify({
          totalVotes: lastUser.totalVotes,
          joinDate: lastUser.joinDate.toISOString()
        });
      }

      return {
        users: users.map(user => ({
          ...user,
          id: user._id
        })),
        newCursor,
        endOfResults
      };
    }
  },
  Mutation: {
    async login(_, { emailOrUsername, password }) {
      let collection = db.collection('users');
      const user = await collection.findOne({
        $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
      });

      if (!user) {
        throw new Error(
          "This username/email and password combination doesn't exist."
        );
      }

      const valid = await bcrypt.compare(
        password,
        user.passwordHash || user.password
      );

      if (!valid) {
        throw new Error(
          "This username/email and password combination doesn't exist."
        );
      }

      const refreshTokenId = randomUUID();

      await collection.updateOne(
        { _id: user._id },
        {
          $set: {
            lastLogin: new Date(),
            updatedAt: new Date(),
            refreshTokenId
          }
        }
      );

      return {
        ...buildAuthTokens(
          { id: user._id, email: user.email, role: user.role },
          refreshTokenId
        ),
        user: toAuthUser(user)
      };
    },
    async signup(
      _,
      { username, email, password, displayName, firstName, lastName, birthday }
    ) {
      let collection = db.collection('users');

      const invalidValues = [
        null,
        undefined,
        'null',
        'undefined',
        '',
        'NULL',
        'UNDEFINED'
      ];
      const trimmedUsername = username?.trim();
      const trimmedDisplayName = displayName?.trim();

      if (
        !trimmedUsername ||
        invalidValues.includes(username) ||
        invalidValues.includes(trimmedUsername)
      ) {
        throw new Error("You're a stupid idiot.");
      }

      if (
        displayName !== undefined &&
        (!trimmedDisplayName ||
          invalidValues.includes(displayName) ||
          invalidValues.includes(trimmedDisplayName))
      ) {
        throw new Error("You're a stupid idiot.");
      }

      const existingUser = await collection.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        if (existingUser.email === email) {
          throw new Error('An account with this email already exists.');
        }
        if (existingUser.username === username) {
          throw new Error('This username is already taken.');
        }
      }

      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      const refreshTokenId = randomUUID();

      const newUser = {
        username,
        email,
        passwordHash,
        role: 'user',
        totalVotes: 0,
        joinDate: new Date(),
        lastLogin: new Date(),
        isActive: true,
        displayName: displayName || username,
        firstName,
        lastName,
        birthday,
        emailVerified: false,
        verificationToken: null,
        refreshTokenId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await collection.insertOne(newUser);

      if (!result.acknowledged) {
        throw new Error('Failed to create user account.');
      }

      return {
        ...buildAuthTokens(
          { id: result.insertedId, email, role: 'user' },
          refreshTokenId
        ),
        user: {
          id: result.insertedId,
          username,
          email,
          displayName: displayName || username,
          firstName,
          lastName,
          birthday,
          totalVotes: 0,
          joinDate: newUser.joinDate.toISOString(),
          role: 'user',
          emailVerified: false
        }
      };
    },
    async refreshAccessToken(_, { refreshToken }) {
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      } catch {
        throw new Error('Refresh token is invalid.');
      }

      if (!decoded?.id || !decoded?.jti) {
        throw new Error('Refresh token is invalid.');
      }

      let userId;
      try {
        userId = new ObjectId(decoded.id);
      } catch {
        throw new Error('Refresh token is invalid.');
      }

      const collection = db.collection('users');
      const nextRefreshTokenId = randomUUID();
      const user = await collection.findOneAndUpdate(
        { _id: userId, refreshTokenId: decoded.jti },
        {
          $set: {
            refreshTokenId: nextRefreshTokenId,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'before' }
      );

      if (!user) {
        throw new Error('Refresh token is invalid.');
      }

      return {
        ...buildAuthTokens(
          { id: user._id, email: user.email, role: user.role },
          nextRefreshTokenId
        ),
        user: toAuthUser(user)
      };
    }
  }
};
