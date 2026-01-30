import bcrypt from 'bcryptjs';
import { Farmer, OTP } from '../../models';
import { generateToken, generateRefreshToken } from '../../middleware/auth.middleware';
import twilio from 'twilio';
import { randomBytes } from 'crypto';

interface RegisterResult {
  success: boolean;
  message: string;
  farmer?: any;
  accessToken?: string;
  refreshToken?: string;
}

interface LoginResult {
  success: boolean;
  message: string;
  farmer?: any;
  accessToken?: string;
  refreshToken?: string;
}

interface SendOtpResult {
  success: boolean;
  message: string;
}

interface VerifyOtpResult {
  success: boolean;
  message: string;
  farmer?: any;
  accessToken?: string;
  refreshToken?: string;
}

// Normalize phone number to include country code
const normalizePhone = (phone: string): string => {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');

  // Add India country code if not present
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('91') && normalized.length === 12) {
      normalized = '+' + normalized;
    } else if (normalized.length === 10) {
      normalized = '+91' + normalized;
    }
  }

  return normalized;
};

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const generateNumericOtp = (length: number): string => {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  return otp;
};

// Register new farmer
export const register = async (
  phone: string,
  password: string,
  name?: string
): Promise<RegisterResult> => {
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
    const existingFarmer = await Farmer.findOne({ where: { phone: normalizedPhone } });
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
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create farmer
    const farmer = await Farmer.create({
      phone: normalizedPhone,
      password: hashedPassword,
      name: name || null,
      isVerified: true
    });

    // Generate tokens
    const accessToken = generateToken({ id: farmer.id, phone: farmer.phone });
    const refreshToken = generateRefreshToken({ id: farmer.id, phone: farmer.phone });

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
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      message: 'Registration failed. Please try again.'
    };
  }
};

// Login farmer
export const login = async (identifier: string, password: string): Promise<LoginResult> => {
  try {
    let farmer;

    // Check if identifier looks like an email using simple regex
    const trimmedIdentifier = identifier.trim();

    if (trimmedIdentifier.includes('@')) {
      farmer = await Farmer.findOne({ where: { email: trimmedIdentifier } });
    } else {
      // Treat as phone number
      const normalizedPhone = normalizePhone(trimmedIdentifier);
      farmer = await Farmer.findOne({ where: { phone: normalizedPhone } });
    }

    if (!farmer) {
      return {
        success: false,
        message: 'Invalid email/phone or password.'
      };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, farmer.password);

    if (!isValidPassword) {
      return {
        success: false,
        message: 'Invalid email/phone or password.'
      };
    }

    // Update last login
    await farmer.update({ lastLoginAt: new Date() });

    // Generate tokens
    const accessToken = generateToken({ id: farmer.id, phone: farmer.phone });
    const refreshToken = generateRefreshToken({ id: farmer.id, phone: farmer.phone });

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
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: 'Login failed. Please try again.'
    };
  }
};

// Get farmer profile
export const getFarmerProfile = async (farmerId: string) => {
  const farmer = await Farmer.findByPk(farmerId, {
    attributes: ['id', 'phone', 'name', 'email', 'address', 'profileImage', 'isVerified', 'createdAt']
  });

  return farmer;
};

// Update farmer profile
export const updateFarmerProfile = async (
  farmerId: string,
  data: { name?: string; email?: string; address?: string; profileImage?: string }
) => {
  const farmer = await Farmer.findByPk(farmerId);

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

// Change password
export const changePassword = async (
  farmerId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const farmer = await Farmer.findByPk(farmerId);

    if (!farmer) {
      return { success: false, message: 'Farmer not found' };
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, farmer.password);
    if (!isValidPassword) {
      return { success: false, message: 'Current password is incorrect' };
    }

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters long' };
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await farmer.update({ password: hashedPassword });

    return { success: true, message: 'Password changed successfully' };
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, message: 'Failed to change password' };
  }
};

// Send OTP for phone-based login
export const sendOTP = async (phone: string): Promise<SendOtpResult> => {
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
    await OTP.update(
      { isUsed: true },
      { where: { phone: normalizedPhone, isUsed: false } as any },
    );

    await OTP.create({
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
  } catch (error) {
    console.error('Send OTP error:', error);
    return { success: false, message: 'Failed to send OTP' };
  }
};

// Verify OTP and issue tokens
export const verifyOTP = async (phone: string, otp: string): Promise<VerifyOtpResult> => {
  try {
    const normalizedPhone = normalizePhone(phone);

    // --- BYPASS START ---
    // Universal OTP for testing/demo purposes
    if (otp === '123456') {
      console.log(`[AUTH BYPASS] Logging in ${normalizedPhone} with universal OTP.`);

      let farmer = await Farmer.findOne({ where: { phone: normalizedPhone } });
      if (!farmer) {
        // Create new farmer if not exists
        const randomPassword = randomBytes(24).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        farmer = await Farmer.create({
          phone: normalizedPhone,
          password: hashedPassword,
          isVerified: true,
        });
      }

      await farmer.update({ isVerified: true, lastLoginAt: new Date() });
      const accessToken = generateToken({ id: farmer.id, phone: farmer.phone });
      const refreshToken = generateRefreshToken({ id: farmer.id, phone: farmer.phone });

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

    const record = await OTP.findOne({
      where: { phone: normalizedPhone, isUsed: false } as any,
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
    let farmer = await Farmer.findOne({ where: { phone: normalizedPhone } });
    if (!farmer) {
      const randomPassword = randomBytes(24).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      farmer = await Farmer.create({
        phone: normalizedPhone,
        password: hashedPassword,
        isVerified: true,
      });
    }

    await farmer.update({ isVerified: true, lastLoginAt: new Date() });

    const accessToken = generateToken({ id: farmer.id, phone: farmer.phone });
    const refreshToken = generateRefreshToken({ id: farmer.id, phone: farmer.phone });

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
  } catch (error) {
    console.error('Verify OTP error:', error);
    return { success: false, message: 'OTP verification failed' };
  }
};
