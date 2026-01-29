"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOTP = exports.sendOTP = exports.changePassword = exports.updateFarmerProfile = exports.getFarmerProfile = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const models_1 = require("../../models");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const twilio_1 = __importDefault(require("twilio"));
const crypto_1 = require("crypto");
// Normalize phone number to include country code
const normalizePhone = (phone) => {
    // Remove all non-digit characters except +
    let normalized = phone.replace(/[^\d+]/g, '');
    // Add India country code if not present
    if (!normalized.startsWith('+')) {
        if (normalized.startsWith('91') && normalized.length === 12) {
            normalized = '+' + normalized;
        }
        else if (normalized.length === 10) {
            normalized = '+91' + normalized;
        }
    }
    return normalized;
};
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;
const generateNumericOtp = (length) => {
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += Math.floor(Math.random() * 10).toString();
    }
    return otp;
};
// Register new farmer
const register = async (phone, password, name) => {
    try {
        const normalizedPhone = normalizePhone(phone);
        // Validate phone number format
        if (!/^\+91[0-9]{10}$/.test(normalizedPhone)) {
            return {
                success: false,
                message: 'Invalid phone number format. Please provide a valid 10-digit Indian mobile number.'
            };
        }
        // Check if farmer already exists
        const existingFarmer = await models_1.Farmer.findOne({ where: { phone: normalizedPhone } });
        if (existingFarmer) {
            return {
                success: false,
                message: 'Phone number already registered. Please login instead.'
            };
        }
        // Validate password
        if (!password || password.length < 6) {
            return {
                success: false,
                message: 'Password must be at least 6 characters long.'
            };
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create farmer
        const farmer = await models_1.Farmer.create({
            phone: normalizedPhone,
            password: hashedPassword,
            name: name || null,
            isVerified: true
        });
        // Generate tokens
        const accessToken = (0, auth_middleware_1.generateToken)({ id: farmer.id, phone: farmer.phone });
        const refreshToken = (0, auth_middleware_1.generateRefreshToken)({ id: farmer.id, phone: farmer.phone });
        return {
            success: true,
            message: 'Registration successful',
            farmer: {
                id: farmer.id,
                phone: farmer.phone,
                name: farmer.name,
                email: farmer.email,
                isVerified: farmer.isVerified
            },
            accessToken,
            refreshToken
        };
    }
    catch (error) {
        console.error('Registration error:', error);
        return {
            success: false,
            message: 'Registration failed. Please try again.'
        };
    }
};
exports.register = register;
// Login farmer
const login = async (phone, password) => {
    try {
        const normalizedPhone = normalizePhone(phone);
        // Find farmer
        const farmer = await models_1.Farmer.findOne({ where: { phone: normalizedPhone } });
        if (!farmer) {
            return {
                success: false,
                message: 'Invalid phone number or password.'
            };
        }
        // Verify password
        const isValidPassword = await bcryptjs_1.default.compare(password, farmer.password);
        if (!isValidPassword) {
            return {
                success: false,
                message: 'Invalid phone number or password.'
            };
        }
        // Update last login
        await farmer.update({ lastLoginAt: new Date() });
        // Generate tokens
        const accessToken = (0, auth_middleware_1.generateToken)({ id: farmer.id, phone: farmer.phone });
        const refreshToken = (0, auth_middleware_1.generateRefreshToken)({ id: farmer.id, phone: farmer.phone });
        return {
            success: true,
            message: 'Login successful',
            farmer: {
                id: farmer.id,
                phone: farmer.phone,
                name: farmer.name,
                email: farmer.email,
                isVerified: farmer.isVerified
            },
            accessToken,
            refreshToken
        };
    }
    catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            message: 'Login failed. Please try again.'
        };
    }
};
exports.login = login;
// Get farmer profile
const getFarmerProfile = async (farmerId) => {
    const farmer = await models_1.Farmer.findByPk(farmerId, {
        attributes: ['id', 'phone', 'name', 'email', 'address', 'profileImage', 'isVerified', 'createdAt']
    });
    return farmer;
};
exports.getFarmerProfile = getFarmerProfile;
// Update farmer profile
const updateFarmerProfile = async (farmerId, data) => {
    const farmer = await models_1.Farmer.findByPk(farmerId);
    if (!farmer) {
        return null;
    }
    await farmer.update(data);
    return {
        id: farmer.id,
        phone: farmer.phone,
        name: farmer.name,
        email: farmer.email,
        address: farmer.address,
        profileImage: farmer.profileImage,
        isVerified: farmer.isVerified
    };
};
exports.updateFarmerProfile = updateFarmerProfile;
// Change password
const changePassword = async (farmerId, currentPassword, newPassword) => {
    try {
        const farmer = await models_1.Farmer.findByPk(farmerId);
        if (!farmer) {
            return { success: false, message: 'Farmer not found' };
        }
        // Verify current password
        const isValidPassword = await bcryptjs_1.default.compare(currentPassword, farmer.password);
        if (!isValidPassword) {
            return { success: false, message: 'Current password is incorrect' };
        }
        // Validate new password
        if (!newPassword || newPassword.length < 6) {
            return { success: false, message: 'New password must be at least 6 characters long' };
        }
        // Hash and update password
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        await farmer.update({ password: hashedPassword });
        return { success: true, message: 'Password changed successfully' };
    }
    catch (error) {
        console.error('Change password error:', error);
        return { success: false, message: 'Failed to change password' };
    }
};
exports.changePassword = changePassword;
// Send OTP for phone-based login
const sendOTP = async (phone) => {
    try {
        const normalizedPhone = normalizePhone(phone);
        if (!/^\+91[0-9]{10}$/.test(normalizedPhone)) {
            return {
                success: false,
                message: 'Invalid phone number format. Please provide a valid 10-digit Indian mobile number.',
            };
        }
        const otpLength = parseInt(process.env.OTP_LENGTH || '6');
        const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '5');
        const otp = generateNumericOtp(otpLength);
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
        // Invalidate previous unused OTPs for this phone (simple approach)
        await models_1.OTP.update({ isUsed: true }, { where: { phone: normalizedPhone, isUsed: false } });
        await models_1.OTP.create({
            phone: normalizedPhone,
            otp,
            expiresAt,
            isUsed: false,
            attempts: 0,
        });
        const smsBody = `Your Smart Agri OTP is ${otp}. It expires in ${expiryMinutes} minutes.`;
        // --- BYPASS: Disable actual SMS sending to avoid Twilio errors ---
        // if (twilioClient && process.env.TWILIO_PHONE_NUMBER) { ... }
        console.log(`[DEV/BYPASS] OTP for ${normalizedPhone} is ${otp}`);
        return { success: true, message: 'OTP sent successfully (Bypass Mode)' };
    }
    catch (error) {
        console.error('Send OTP error:', error);
        return { success: false, message: 'Failed to send OTP' };
    }
};
exports.sendOTP = sendOTP;
// Verify OTP and issue tokens
const verifyOTP = async (phone, otp) => {
    try {
        const normalizedPhone = normalizePhone(phone);
        // --- BYPASS START ---
        // Universal OTP for testing/demo purposes
        if (otp === '123456') {
            console.log(`[AUTH BYPASS] Logging in ${normalizedPhone} with universal OTP.`);
            let farmer = await models_1.Farmer.findOne({ where: { phone: normalizedPhone } });
            if (!farmer) {
                // Create new farmer if not exists
                const randomPassword = (0, crypto_1.randomBytes)(24).toString('hex');
                const hashedPassword = await bcryptjs_1.default.hash(randomPassword, 10);
                farmer = await models_1.Farmer.create({
                    phone: normalizedPhone,
                    password: hashedPassword,
                    isVerified: true,
                });
            }
            await farmer.update({ isVerified: true, lastLoginAt: new Date() });
            const accessToken = (0, auth_middleware_1.generateToken)({ id: farmer.id, phone: farmer.phone });
            const refreshToken = (0, auth_middleware_1.generateRefreshToken)({ id: farmer.id, phone: farmer.phone });
            return {
                success: true,
                message: 'Login successful (Bypass)',
                farmer: {
                    id: farmer.id,
                    phone: farmer.phone,
                    name: farmer.name,
                    email: farmer.email,
                    isVerified: farmer.isVerified,
                },
                accessToken,
                refreshToken,
            };
        }
        // --- BYPASS END ---
        if (!/^\+91[0-9]{10}$/.test(normalizedPhone)) {
            return {
                success: false,
                message: 'Invalid phone number format.',
            };
        }
        const record = await models_1.OTP.findOne({
            where: { phone: normalizedPhone, isUsed: false },
            order: [['createdAt', 'DESC']],
        });
        if (!record) {
            return { success: false, message: 'OTP not found. Please request a new OTP.' };
        }
        // Track attempts
        await record.update({ attempts: record.attempts + 1 });
        if (record.isExpired()) {
            await record.update({ isUsed: true });
            return { success: false, message: 'OTP expired. Please request a new OTP.' };
        }
        if (!record.isValid(otp)) {
            return { success: false, message: 'Invalid OTP.' };
        }
        await record.update({ isUsed: true });
        // Find or create farmer (OTP-first signup)
        let farmer = await models_1.Farmer.findOne({ where: { phone: normalizedPhone } });
        if (!farmer) {
            const randomPassword = (0, crypto_1.randomBytes)(24).toString('hex');
            const hashedPassword = await bcryptjs_1.default.hash(randomPassword, 10);
            farmer = await models_1.Farmer.create({
                phone: normalizedPhone,
                password: hashedPassword,
                isVerified: true,
            });
        }
        await farmer.update({ isVerified: true, lastLoginAt: new Date() });
        const accessToken = (0, auth_middleware_1.generateToken)({ id: farmer.id, phone: farmer.phone });
        const refreshToken = (0, auth_middleware_1.generateRefreshToken)({ id: farmer.id, phone: farmer.phone });
        return {
            success: true,
            message: 'Login successful',
            farmer: {
                id: farmer.id,
                phone: farmer.phone,
                name: farmer.name,
                email: farmer.email,
                isVerified: farmer.isVerified,
            },
            accessToken,
            refreshToken,
        };
    }
    catch (error) {
        console.error('Verify OTP error:', error);
        return { success: false, message: 'OTP verification failed' };
    }
};
exports.verifyOTP = verifyOTP;
//# sourceMappingURL=auth.service.js.map