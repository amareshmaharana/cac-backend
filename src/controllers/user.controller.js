import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import ApiResponse from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      'Something went wrong while generating access and refresh tokens',
    )
  }
}

// < ---------------- register-user ------------------ >
const registerUser = asyncHandler(async (req, res) => {
  // < ---------- get user details from frontend ----------- >
  const { fullname, email, username, password } = req.body;

  // < ---------- validation - not empty (if user give any input empty) ---------- >
  if (
    [fullname, email, username, password].some((field) => field?.trim() === '')
  ) {
    throw new ApiError(400, 'All fields are required');
  }

  // < ---------- check if user already exists: username, email ---------- >
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, 'A user with the email or username already exists');
  }

  // < ----------- check for images and avatar ----------- >
  // console.log(req.files);
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar file is required');
  }

  // < ----------- upload them to cloudinary ----------- >
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, 'Avatar is required');
  }

  // < ------------ create user object - create entry in db ------------ >
  const user = await User.create({
    fullname,
    email,
    username: username.toLowerCase(),
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || '',
  });

  // < ------------ remove password and refresh token field from response ------------ >
  const createdUser = await User.findById(user._id).select(
    '-password -refreshToken',
  );

  // < ------------ check for user creation ----------- >
  if (!createdUser) {
    throw new ApiError(500, 'something went wrong while registering the user');
  }

  // < ---------- return res ----------- >
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, 'User registered successfully'));
});

/*           ========== <<<<<<<<<<<<<<<<</>>>>>>>>>>>>>>>>>> ==========           */

// < ----------------- login-user ------------------ >
export const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  const { email, username, password } = req.body;
  console.log(email);

  // username or email
  if (!username && !email) {
    throw new ApiError(400, 'email or username is required');
  }

  // find the user
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, 'User does not exist');
  }

  // password check
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Incorrect password');
  }

  // access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );
  const loggedInUser = await User.findById(user._id).select(
    '-password -refreshToken',
  );

  // send cookies
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        'User logged in successfully',
      ),
    );
});

/*          ========== <<<<<<<<<<<<<<<<<</>>>>>>>>>>>>>>>>>>> ==========           */

// < ----------------- logout-user ------------------ >
export const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    },
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  // clear cookies
  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'User logged out successfully'));
});

/*          ========== <<<<<<<<<<<<<<<<<</>>>>>>>>>>>>>>>>>>> ==========           */

// < ----------------- refresh-token-part ------------------ >
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, 'unauthorized request');
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(404, 'invalid refresh token');
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, 'Refresh token is expired or used');
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          'Access token refreshed',
        ),
      );
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid refresh token');
  }
});

/*          ========== <<<<<<<<<<<<<<<<<</>>>>>>>>>>>>>>>>>>> ==========           */

// < ------------- forgot-your-password ==>>>> reseting-the-password -------------- >
export const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, 'Incorrect old password');
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: true });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password changed successfully'));
});

/*          ========== <<<<<<<<<<<<<<<<<</>>>>>>>>>>>>>>>>>>> ==========           */

// < ------------------ current-user-details ------------------ >
export const getCurrUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, 'Current user fetched successfully'));
});

/*          ========== <<<<<<<<<<<<<<<<<</>>>>>>>>>>>>>>>>>>> ==========           */

// < ------------------ update-account-details ------------------ >
export const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email, username } = req.body;

  if (!fullname || !email) {
    throw new ApiError(400, 'All fields are required');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    { new: true },
  ).select('-password');

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'Account details updated successfully'));
});

/*          ========== <<<<<<<<<<<<<<<<<</>>>>>>>>>>>>>>>>>>> ==========           */

// < ------------------ update-user-avatar ------------------ >
export const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.files?.avatar[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar file is required');
  }

  // delete the previous avatar from cloudinary
  const userOfAvatar = await User.findById(req.user?._id);
  await deleteCloudinaryImage(userOfAvatar.avatar);

  // upload the new avatar to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, 'Avatar is required');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true },
  ).select('-password');

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'Avatar updated successfully'));
});

/*          ========== <<<<<<<<<<<<<<<<<</>>>>>>>>>>>>>>>>>>> ==========           */

// < ------------------ update-user-cover-image ------------------ >
export const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, 'Cover image file is required');
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, 'Cover image is required');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true },
  ).select('-password');

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'Cover image updated successfully'));
});

/*          ========== <<<<<<<<<<<<<<<<<</>>>>>>>>>>>>>>>>>>> ==========           */

//
export const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username) {
    throw new ApiError(400, 'Username is missing');
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'channel',
        as: 'subscribers',
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'subscriber',
        as: 'subscribedTo',
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: '$subscribers',
        },
        channelsSubscribeToCount: {
          $size: '$subscribedTo',
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, '$subscribers.subscriber'] },
            then: true,
            else: false,
          }
        }
      },
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribeToCount: 1,
        email: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
      },
    },
  ])

  if(!channel?.length) {
    throw new ApiError(404, 'Channel not found');
  }

  return res
   .status(200)
   .json(new ApiResponse(200, channel[0], 'User channel profile fetched successfully'));

});

export default registerUser;
