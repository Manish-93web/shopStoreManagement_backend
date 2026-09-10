import { Request, Response } from 'express';
import User, { UserRole } from '../models/User.js';
import Store from '../models/Store.js';
import Plan from '../models/Plan.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { logAudit } from '../utils/auditLogger.js';
import jwt from 'jsonwebtoken';
import OTP from '../models/OTP.js';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../utils/emailService.js';

// @desc    Register a new store and owner
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, storeName, shopType } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json(new ApiResponse(400, null, 'User already exists'));
    }

    // Create User (Store Owner)
    const user = await User.create({
        name,
        email,
        password,
        role: UserRole.STORE_OWNER,
    });

    // Create Initial Store
    const freePlan = await Plan.findOne({ name: 'Free' });
    const store = await Store.create({
        name: storeName,
        shopType,
        owner: user._id,
        subscriptionPlan: freePlan?._id,
    });

    user.stores.push(store._id as any);
    user.storeId = store._id as any;
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    // Create Audit Log
    await logAudit({
        req,
        storeId: store._id,
        userId: user._id,
        action: 'REGISTER',
        entity: 'User',
        entityId: user._id,
    });

    res.status(201).json(
        new ApiResponse(
            201,
            {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    storeId: user.storeId,
                },
                accessToken,
                refreshToken,
            },
            'Store registered successfully'
        )
    );
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
        await logAudit({
            req,
            storeId: user?.storeId || null,
            userId: user?._id || null,
            action: 'LOGIN_FAILURE',
            entity: 'User',
            details: `Failed login attempt for email: ${email}`,
        });
        return res.status(401).json(new ApiResponse(401, null, 'Invalid credentials'));
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    // Create Audit Log
    await logAudit({
        req,
        storeId: user.storeId || (user.stores && user.stores[0]),
        userId: user._id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user._id,
    });

    res.status(200).json(
        new ApiResponse(
            200,
            {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    storeId: user.storeId,
                },
                accessToken,
                refreshToken,
            },
            'Login successful'
        )
    );
});

// @desc    Logout user / clear refresh token
// @route   POST /api/auth/logout
// @access  Private
export const logout = asyncHandler(async (req: any, res: Response) => {
    const user = await User.findById(req.user.id);
    if (user) {
        user.refreshToken = undefined;
        await user.save();
    }

    res.status(200).json(new ApiResponse(200, null, 'Logged out successfully'));
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json(new ApiResponse(401, null, 'Refresh token required'));
    }

    try {
        const decoded: any = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!);
        const user = await User.findById(decoded.id);

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json(new ApiResponse(401, null, 'Invalid refresh token'));
        }

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        user.refreshToken = newRefreshToken;
        await user.save();

        res.status(200).json(
            new ApiResponse(
                200,
                {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                },
                'Token refreshed'
            )
        );
    } catch (error) {
        return res.status(401).json(new ApiResponse(401, null, 'Invalid refresh token'));
    }
});

// @desc    Forgot Password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always return the same generic response whether or not the account exists —
    // returning 404 for unknown emails lets an attacker enumerate registered accounts.
    const genericResponse = () =>
        res
            .status(200)
            .json(
                new ApiResponse(200, null, 'If an account exists for that email, a password reset code has been sent.')
            );

    if (!user) {
        return genericResponse();
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await OTP.findOneAndUpdate(
        { phone: `email:${email}` },
        { code, expiresAt },
        { upsert: true, returnDocument: 'after' }
    );

    // Real email send when SMTP is configured; emailService.ts itself logs the code
    // to the console as an honest fallback when it isn't.
    await sendEmail({
        to: email,
        subject: 'Your Store360 password reset code',
        html: `<p>Your password reset code is <strong>${code}</strong>. It expires in 10 minutes.</p><p>If you didn't request this, you can ignore this email.</p>`,
    });

    genericResponse();
});

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email, code, newPassword } = req.body;

    const otpRecord = await OTP.findOne({ phone: `email:${email}`, code });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid or expired reset code'));
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json(new ApiResponse(404, null, 'User not found'));
    }

    user.password = newPassword; // Will be hashed by pre-save hook
    await user.save();

    await OTP.deleteOne({ _id: otpRecord._id });

    res.status(200).json(new ApiResponse(200, null, 'Password reset successfully'));
});
