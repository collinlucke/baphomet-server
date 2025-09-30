export const userMutations = {
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
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(newUser);

    if (!result.acknowledged) {
      throw new Error('Failed to create user account.');
    }

    return {
      token: generateToken(
        { id: result.insertedId, email },
        process.env.ACCESS_TOKEN_SECRET,
        '6h'
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

    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          lastLogin: new Date(),
          updatedAt: new Date()
        }
      }
    );

    return {
      token: generateToken(
        { id: user._id, email: user.email },
        process.env.ACCESS_TOKEN_SECRET,
        '7d'
      ),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        totalVotes: user.totalVotes || 0,
        joinDate: (user.joinDate || user.createdAt).toISOString(),
        role: user.role || 'user',
        emailVerified: user.emailVerified || false
      }
    };
  },
  async updateProfile(
    _,
    {
      id,
      displayName,
      firstName,
      lastName,
      birthday,
      email,
      username,
      avatarUrl
    },
    context
  ) {
    const token = context.token;
    if (!token) {
      throw new Error('Authentication required to update profile');
    }

    let decoded;
    try {
      decoded = jwt.verify(
        token.replace('Bearer ', ''),
        process.env.ACCESS_TOKEN_SECRET
      );
    } catch (error) {
      throw new Error('Invalid authentication token');
    }

    // Verify that the user is updating their own profile or is an admin
    if (decoded.id !== id && decoded.role !== 'admin') {
      throw new Error('You can only update your own profile');
    }

    const usersCollection = db.collection('users');
    const userId = new ObjectId(id);

    // If email is being changed, check for duplicates
    if (email) {
      const existingUser = await usersCollection.findOne({
        email,
        _id: { $ne: userId }
      });

      if (existingUser) {
        throw new Error('This email address is already in use');
      }
    }

    const updateData = {};

    if (displayName) updateData.displayName = displayName;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (birthday !== undefined) updateData.birthday = birthday;
    if (email) updateData.email = email;
    if (username) updateData.username = username;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    updateData.updatedAt = new Date();

    const result = await usersCollection.updateOne(
      { _id: userId },
      { $set: updateData }
    );

    if (!result.acknowledged) {
      throw new Error('Failed to update profile');
    }

    const updatedUser = await usersCollection.findOne({ _id: userId });

    if (!updatedUser) {
      throw new Error('User not found');
    }

    return {
      id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      displayName: updatedUser.displayName,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      birthday: updatedUser.birthday,
      totalVotes: updatedUser.totalVotes || 0,
      joinDate: (updatedUser.joinDate || updatedUser.createdAt).toISOString(),
      role: updatedUser.role || 'user',
      emailVerified: updatedUser.emailVerified || false
    };
  },

  async changePassword(_, { id, currentPassword, newPassword }, context) {
    const token = context.token;
    if (!token) {
      throw new Error('Authentication required to change password');
    }

    let decoded;
    try {
      decoded = jwt.verify(
        token.replace('Bearer ', ''),
        process.env.ACCESS_TOKEN_SECRET
      );
    } catch (error) {
      throw new Error('Invalid authentication token');
    }

    // Verify that the user is changing their own password or is an admin
    if (decoded.id !== id && decoded.role !== 'admin') {
      throw new Error('You can only change your own password');
    }

    const usersCollection = db.collection('users');
    const userId = new ObjectId(id);

    const user = await usersCollection.findOne({ _id: userId });

    if (!user) {
      throw new Error('User not found');
    }

    const valid = await bcrypt.compare(
      currentPassword,
      user.passwordHash || user.password
    );

    if (!valid) {
      throw new Error('Current password is incorrect');
    }

    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    const result = await usersCollection.updateOne(
      { _id: userId },
      {
        $set: {
          passwordHash: newPasswordHash,
          updatedAt: new Date()
        }
      }
    );

    if (!result.acknowledged) {
      throw new Error('Failed to update password');
    }

    return {
      token: generateToken(
        { id: user._id, email: user.email },
        process.env.ACCESS_TOKEN_SECRET,
        '7d'
      ),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        birthday: user.birthday,
        totalVotes: user.totalVotes || 0,
        joinDate: (user.joinDate || user.createdAt).toISOString(),
        role: user.role || 'user',
        emailVerified: user.emailVerified || false
      }
    };
  }
};
