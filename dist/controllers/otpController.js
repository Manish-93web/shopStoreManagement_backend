import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import OTP from '../models/OTP.js';
import User from '../models/User.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import AuditLog from '../models/AuditLog.js';
import { sendSMS } from '../utils/smsService.js';
// @desc    Send OTP to phone
// @route   POST /api/v1/auth/send-otp
export const sendOTP = asyncHandler(async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json(new ApiResponse(400, null, 'Phone number is required'));
    }
    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    // Save to DB
    await OTP.findOneAndUpdate({ phone }, { code, expiresAt }, { upsert: true, returnDocument: 'after' });
    // Real Twilio send when TWILIO_* env vars are configured; smsService.ts itself
    // logs the code to the console as an honest fallback when they aren't (previously
    // this path never attempted a real send at all, even when Twilio was configured).
    const smsSent = await sendSMS({
        to: phone,
        body: `Your Store360 verification code is ${code}. It expires in 5 minutes.`,
    });
    res.status(200).json(new ApiResponse(200, null, smsSent
        ? 'OTP sent successfully'
        : 'OTP generated — SMS delivery is not configured on this server; check the server console for the code'));
});
// @desc    Verify OTP and log in
// @route   POST /api/v1/auth/verify-otp
export const verifyOTP = asyncHandler(async (req, res) => {
    const { phone, code } = req.body;
    if (!phone || !code) {
        return res.status(400).json(new ApiResponse(400, null, 'Phone and code are required'));
    }
    const otpRecord = await OTP.findOne({ phone, code });
    if (!otpRecord) {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid or expired OTP'));
    }
    // OTP verified, find user
    const user = await User.findOne({ phone });
    if (!user) {
        // Option 1: Error out
        // return res.status(404).json(new ApiResponse(404, null, "No account linked to this phone"));
        // Option 2: Auto-register (Simpler for demo, but needs storeId etc in real app)
        // For now, let's assume the user must already exist or we return a 404
        return res
            .status(404)
            .json(new ApiResponse(404, null, 'No user found with this phone number. Please register first.'));
    }
    // Clean up OTP record
    await OTP.deleteOne({ _id: otpRecord._id });
    // Generate JWTs
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save();
    // Create Audit Log
    await AuditLog.create({
        storeId: user.storeId || (user.stores && user.stores[0]),
        userId: user._id,
        action: 'LOGIN_OTP',
        entity: 'User',
        entityId: user._id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });
    res.status(200).json(new ApiResponse(200, {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            storeId: user.storeId,
            allowedMenus: user.allowedMenus,
        },
        accessToken,
        refreshToken,
    }, 'Login successful'));
});
