import User, { UserRole } from '../models/User.js';
import Store from '../models/Store.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
// @desc    Register a new store and owner
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res) => {
    const { name, email, password, storeName } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json(new ApiResponse(400, null, "User already exists"));
    }
    // Create User (Store Owner)
    const user = await User.create({
        name,
        email,
        password,
        role: UserRole.STORE_OWNER
    });
    // Create Initial Store
    const store = await Store.create({
        name: storeName,
        owner: user._id
    });
    user.stores.push(store._id);
    user.storeId = store._id;
    await user.save();
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save();
    res.status(201).json(new ApiResponse(201, {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            storeId: user.storeId
        },
        accessToken,
        refreshToken
    }, "Store registered successfully"));
});
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json(new ApiResponse(401, null, "Invalid credentials"));
    }
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save();
    res.status(200).json(new ApiResponse(200, {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            storeId: user.storeId
        },
        accessToken,
        refreshToken
    }, "Login successful"));
});
