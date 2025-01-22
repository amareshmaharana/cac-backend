import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import ApiResponse from '../utils/ApiResponse.js';

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
    );
  }
};

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
  console.log(email)

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

export default registerUser;
