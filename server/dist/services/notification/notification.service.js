"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSystemNotification = exports.cleanupOldNotifications = exports.markAllAsRead = exports.markAsRead = exports.getNotifications = exports.createCriticalAlert = exports.createNotification = void 0;
const twilio_1 = __importDefault(require("twilio"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const models_1 = require("../../models");
const sequelize_1 = require("sequelize");
// Initialize Twilio
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;
// Initialize Nodemailer
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
// Send SMS notification
const sendSMS = async (phone, message) => {
    try {
        if (!twilioClient || process.env.NODE_ENV !== 'production') {
            console.log(`[DEV SMS] To: ${phone} - ${message}`);
            return true;
        }
        await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });
        return true;
    }
    catch (error) {
        console.error('SMS send error:', error);
        return false;
    }
};
// Send Email notification
const sendEmail = async (email, subject, content) => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log(`[DEV EMAIL LOGGING] Credentials not found. To: ${email} - Subject: ${subject}`);
            return true;
        }
        await transporter.sendMail({
            from: `"Smart Agri IoT" <${process.env.EMAIL_USER}>`,
            to: email,
            subject,
            text: content,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2e7d32;">${subject}</h2>
          <p style="color: #333; line-height: 1.6;">${content}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            This is an automated message from Smart Agri IoT.
            Please do not reply to this email.
          </p>
        </div>
      `
        });
        return true;
    }
    catch (error) {
        console.error('Email send error:', error);
        return false;
    }
};
// Create and send notification
const createNotification = async (params) => {
    const { farmerId, farmId, cropId, type, priority = 'medium', title, message, channels = ['in_app'], actionUrl, metadata } = params;
    // Create notification record
    const notification = await models_1.Notification.create({
        farmerId,
        farmId,
        cropId,
        type,
        priority,
        title,
        message,
        channels,
        sentVia: ['in_app'], // Always sent in-app
        actionUrl,
        metadata
    });
    // Get farmer details for SMS/Email
    const farmer = await models_1.Farmer.findByPk(farmerId);
    if (farmer) {
        const sentVia = ['in_app'];
        // Send SMS if requested
        if (channels.includes('sms')) {
            const smsSuccess = await sendSMS(farmer.phone, `[Smart Agri] ${title}: ${message.substring(0, 140)}`);
            if (smsSuccess)
                sentVia.push('sms');
        }
        // Send Email if requested and email is available
        if (channels.includes('email') && farmer.email) {
            const emailSuccess = await sendEmail(farmer.email, title, message);
            if (emailSuccess)
                sentVia.push('email');
        }
        // Update sent channels
        await notification.update({ sentVia });
    }
    return notification;
};
exports.createNotification = createNotification;
// Create alert for critical conditions
const createCriticalAlert = async (farmerId, farmId, type, title, message, metadata) => {
    return (0, exports.createNotification)({
        farmerId,
        farmId,
        type,
        priority: 'critical',
        title,
        message,
        channels: ['in_app', 'sms', 'email'],
        metadata
    });
};
exports.createCriticalAlert = createCriticalAlert;
// Get notifications for a farmer
const getNotifications = async (farmerId, options = {}) => {
    const { unreadOnly, type, limit = 20, offset = 0 } = options;
    const whereClause = { farmerId };
    if (unreadOnly) {
        whereClause.readAt = null;
    }
    if (type) {
        whereClause.type = type;
    }
    const { rows: notifications, count: total } = await models_1.Notification.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit,
        offset
    });
    const unreadCount = await models_1.Notification.count({
        where: { farmerId, readAt: null }
    });
    return { notifications, total, unreadCount };
};
exports.getNotifications = getNotifications;
// Mark notification as read
const markAsRead = async (notificationId, farmerId) => {
    const notification = await models_1.Notification.findOne({
        where: { id: notificationId, farmerId }
    });
    if (!notification) {
        return false;
    }
    await notification.update({ readAt: new Date() });
    return true;
};
exports.markAsRead = markAsRead;
// Mark all notifications as read
const markAllAsRead = async (farmerId) => {
    const [updatedCount] = await models_1.Notification.update({ readAt: new Date() }, { where: { farmerId, readAt: null } });
    return updatedCount;
};
exports.markAllAsRead = markAllAsRead;
// Delete old notifications (cleanup job)
const cleanupOldNotifications = async (daysOld = 90) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const deletedCount = await models_1.Notification.destroy({
        where: {
            createdAt: { [sequelize_1.Op.lt]: cutoffDate },
            readAt: { [sequelize_1.Op.ne]: null }
        }
    });
    return deletedCount;
};
exports.cleanupOldNotifications = cleanupOldNotifications;
// Create system notification for all farmers
const createSystemNotification = async (title, message) => {
    const farmers = await models_1.Farmer.findAll({ attributes: ['id'] });
    let count = 0;
    for (const farmer of farmers) {
        await (0, exports.createNotification)({
            farmerId: farmer.id,
            type: 'system',
            priority: 'medium',
            title,
            message,
            channels: ['in_app']
        });
        count++;
    }
    return count;
};
exports.createSystemNotification = createSystemNotification;
//# sourceMappingURL=notification.service.js.map