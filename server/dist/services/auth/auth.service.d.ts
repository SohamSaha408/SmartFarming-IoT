import { Farmer } from '../../models';
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
export declare const register: (phone: string, password: string, name?: string) => Promise<RegisterResult>;
export declare const login: (identifier: string, password: string) => Promise<LoginResult>;
export declare const getFarmerProfile: (farmerId: string) => Promise<Farmer | null>;
export declare const updateFarmerProfile: (farmerId: string, data: {
    name?: string;
    email?: string;
    address?: string;
    profileImage?: string;
}) => Promise<{
    id: string;
    phone: string;
    name: string | null;
    email: string | null;
    address: string | null;
    profileImage: string | null;
    isVerified: boolean;
} | null>;
export declare const changePassword: (farmerId: string, currentPassword: string, newPassword: string) => Promise<{
    success: boolean;
    message: string;
}>;
export declare const sendOTP: (phone: string) => Promise<SendOtpResult>;
export declare const verifyOTP: (phone: string, otp: string) => Promise<VerifyOtpResult>;
export {};
//# sourceMappingURL=auth.service.d.ts.map