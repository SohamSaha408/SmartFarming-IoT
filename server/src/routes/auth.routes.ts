import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { authenticate, AuthRequest, verifyRefreshToken, generateToken, generateRefreshToken } from '../middleware/auth.middleware';
import * as authService from '../services/auth/auth.service';

const router = Router();

// Send OTP
router.post(
  '/send-otp',
  validate([
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^(\+91)?[0-9]{10}$/)
      .withMessage('Invalid phone number format'),
  ]),
  async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;
      const result = await authService.sendOTP(phone);

      if (!result.success) {
        res.status(400).json({ error: result.message });
        return;
      }

      res.json({ message: result.message });
    } catch (error) {
      console.error('Send OTP error:', error);
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  },
);

// Verify OTP
router.post(
  '/verify-otp',
  validate([
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^(\+91)?[0-9]{10}$/)
      .withMessage('Invalid phone number format'),
    body('otp')
      .notEmpty()
      .withMessage('OTP is required')
      .isLength({ min: 4, max: 10 })
      .withMessage('Invalid OTP'),
  ]),
  async (req: Request, res: Response) => {
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
    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({ error: 'OTP verification failed' });
    }
  },
);

// Register
router.post(
  '/register',
  validate([
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^(\+91)?[0-9]{10}$/)
      .withMessage('Invalid phone number format'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
  ]),
  async (req: Request, res: Response) => {
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
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Login
router.post(
  '/login',
  validate([
    body('identifier')
      .notEmpty()
      .withMessage('Email or Phone is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ]),
  async (req: Request, res: Response) => {
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
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Refresh token
router.post(
  '/refresh',
  validate([
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
  ]),
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      const newAccessToken = generateToken({ id: decoded.id, phone: decoded.phone });
      const newRefreshToken = generateRefreshToken({ id: decoded.id, phone: decoded.phone });

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }
);

// Get profile
router.get(
  '/profile',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const farmer = await authService.getFarmerProfile(req.farmer!.id);

      if (!farmer) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      res.json({ farmer });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }
);

// Update profile
router.put(
  '/profile',
  authenticate,
  validate([
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Invalid email format'),
    body('address')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Address must be less than 500 characters')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, email, address, profileImage } = req.body;

      const farmer = await authService.updateFarmerProfile(req.farmer!.id, {
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
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// Change password
router.post(
  '/change-password',
  authenticate,
  validate([
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const result = await authService.changePassword(
        req.farmer!.id,
        currentPassword,
        newPassword
      );

      if (!result.success) {
        res.status(400).json({ error: result.message });
        return;
      }

      res.json({ message: result.message });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

export default router;
