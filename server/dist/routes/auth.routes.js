"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authService = __importStar(require("../services/auth/auth.service"));
const router = (0, express_1.Router)();
// Send OTP
router.post('/send-otp', (0, validation_middleware_1.validate)([
    (0, express_validator_1.body)('phone')
        .notEmpty()
        .withMessage('Phone number is required')
        .matches(/^(\+91)?[0-9]{10}$/)
        .withMessage('Invalid phone number format'),
]), async (req, res) => {
    try {
        const { phone } = req.body;
        const result = await authService.sendOTP(phone);
        if (!result.success) {
            res.status(400).json({ error: result.message });
            return;
        }
        res.json({ message: result.message });
    }
    catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});
// Verify OTP
router.post('/verify-otp', (0, validation_middleware_1.validate)([
    (0, express_validator_1.body)('phone')
        .notEmpty()
        .withMessage('Phone number is required')
        .matches(/^(\+91)?[0-9]{10}$/)
        .withMessage('Invalid phone number format'),
    (0, express_validator_1.body)('otp')
        .notEmpty()
        .withMessage('OTP is required')
        .isLength({ min: 4, max: 10 })
        .withMessage('Invalid OTP'),
]), async (req, res) => {
    try {
        const { phone, otp } = req.body;
        const result = await authService.verifyOTP(phone, otp);
        if (!result.success) {
            res.status(401).json({ error: result.message });
            return;
        }
        res.json({
            message: result.message,
            farmer: result.farmer,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });
    }
    catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'OTP verification failed' });
    }
});
// Register
router.post('/register', (0, validation_middleware_1.validate)([
    (0, express_validator_1.body)('phone')
        .notEmpty()
        .withMessage('Phone number is required')
        .matches(/^(\+91)?[0-9]{10}$/)
        .withMessage('Invalid phone number format'),
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    (0, express_validator_1.body)('name')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
]), async (req, res) => {
    try {
        const { phone, password, name } = req.body;
        const result = await authService.register(phone, password, name);
        if (!result.success) {
            res.status(400).json({ error: result.message });
            return;
        }
        res.status(201).json({
            message: result.message,
            farmer: result.farmer,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});
// Login
router.post('/login', (0, validation_middleware_1.validate)([
    (0, express_validator_1.body)('identifier')
        .notEmpty()
        .withMessage('Email or Phone is required'),
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required')
]), async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const result = await authService.login(identifier, password);
        if (!result.success) {
            res.status(401).json({ error: result.message });
            return;
        }
        res.json({
            message: result.message,
            farmer: result.farmer,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});
// Refresh token
router.post('/refresh', (0, validation_middleware_1.validate)([
    (0, express_validator_1.body)('refreshToken')
        .notEmpty()
        .withMessage('Refresh token is required')
]), async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const decoded = (0, auth_middleware_1.verifyRefreshToken)(refreshToken);
        if (!decoded) {
            res.status(401).json({ error: 'Invalid refresh token' });
            return;
        }
        const newAccessToken = (0, auth_middleware_1.generateToken)({ id: decoded.id, phone: decoded.phone });
        const newRefreshToken = (0, auth_middleware_1.generateRefreshToken)({ id: decoded.id, phone: decoded.phone });
        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
    }
    catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});
// Get profile
router.get('/profile', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const farmer = await authService.getFarmerProfile(req.farmer.id);
        if (!farmer) {
            res.status(404).json({ error: 'Profile not found' });
            return;
        }
        res.json({ farmer });
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});
// Update profile
router.put('/profile', auth_middleware_1.authenticate, (0, validation_middleware_1.validate)([
    (0, express_validator_1.body)('name')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),
    (0, express_validator_1.body)('email')
        .optional()
        .isEmail()
        .withMessage('Invalid email format'),
    (0, express_validator_1.body)('address')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Address must be less than 500 characters')
]), async (req, res) => {
    try {
        const { name, email, address, profileImage } = req.body;
        const farmer = await authService.updateFarmerProfile(req.farmer.id, {
            name,
            email,
            address,
            profileImage
        });
        if (!farmer) {
            res.status(404).json({ error: 'Profile not found' });
            return;
        }
        res.json({
            message: 'Profile updated successfully',
            farmer
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
// Change password
router.post('/change-password', auth_middleware_1.authenticate, (0, validation_middleware_1.validate)([
    (0, express_validator_1.body)('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    (0, express_validator_1.body)('newPassword')
        .notEmpty()
        .withMessage('New password is required')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters')
]), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const result = await authService.changePassword(req.farmer.id, currentPassword, newPassword);
        if (!result.success) {
            res.status(400).json({ error: result.message });
            return;
        }
        res.json({ message: result.message });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map