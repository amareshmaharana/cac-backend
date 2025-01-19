import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import ApiResponse from '../utils/ApiResponse.js';

const registerUser = asyncHandler(async (req, res, next) => {

  // < ---------- get user details from frontend ----------- >
  const { fullname, email, username, password } = req.body;


  // < ---------- validation - not empty (if user give any input empty) ---------- >
  if (
    [fullname, email, username, password].some((field) => field?.trim() === '')
  ) {
    throw new ApiError(400, 'All fields are required');
  }


  // < ---------- check if user already exists: username, email ---------- >
  const existedUser = User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, 'Username or email already exists');
  }


  // < ----------- check for images and avatar ----------- >
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

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
  if(!createdUser) {
    throw new ApiError(500, "something went wrong while registering the user")
  }


  // < ---------- return res ----------- >
  return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered successfully")
  )
});

export default registerUser;
