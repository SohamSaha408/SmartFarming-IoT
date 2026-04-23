import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { Notification, Farmer } from '../../models';
import { Op } from 'sequelize';
import type { NotificationChannel } from '../../models/Notification.model';

// Initialize Twilio
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Initialize Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

interface CreateNotificationParams {
  farmerId: string;
  farmId?: string | null;
  cropId?: string | null;
  type: 'irrigation' | 'fertilization' | 'health_alert' | 'weather' | 'device' | 'system';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  channels?: ('in_app' | 'sms' | 'email')[];
  actionUrl?: string;
  metadata?: object;
}

// Send SMS notification
const sendSMS = async (phone: string, message: string): Promise<boolean> => {
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
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
};

// Send Email notification
const sendEmail = async (
  email: string,
  subject: string,
  content: string
): Promise<boolean> => {
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
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

// Create and send notification
export const createNotification = async (
  params: CreateNotificationParams
): Promise<Notification> => {
  const {
    farmerId,
    farmId,
    cropId,
    type,
    priority = 'medium',
    title,
    message,
    channels = ['in_app'],
    actionUrl,
    metadata
  } = params;

  // Create notification record
  const notification = await Notification.create({
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
  const farmer = await Farmer.findByPk(farmerId);

  if (farmer) {
    const sentVia: NotificationChannel[] = ['in_app'];

    // Send SMS if requested
    if (channels.includes('sms')) {
      const smsSuccess = await sendSMS(
        farmer.phone,
        `[Smart Agri] ${title}: ${message.substring(0, 140)}`
      );
      if (smsSuccess) sentVia.push('sms');
    }

    // Send Email if requested and email is available
    if (channels.includes('email') && farmer.email) {
      const emailSuccess = await sendEmail(farmer.email, title, message);
      if (emailSuccess) sentVia.push('email');
    }

    // Update sent channels
    await notification.update({ sentVia });
  }

  return notification;
};

// Create alert for critical conditions
export const createCriticalAlert = async (
  farmerId: string,
  farmId: string,
  type: CreateNotificationParams['type'],
  title: string,
  message: string,
  metadata?: object
): Promise<Notification> => {
  return createNotification({
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

// Get notifications for a farmer
export const getNotifications = async (
  farmerId: string,
  options: {
    unreadOnly?: boolean;
    type?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> => {
  const { unreadOnly, type, limit = 20, offset = 0 } = options;

  const whereClause: any = { farmerId };

  if (unreadOnly) {
    whereClause.readAt = null;
  }

  if (type) {
    whereClause.type = type;
  }

  const { rows: notifications, count: total } = await Notification.findAndCountAll({
    where: whereClause,
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });

  const unreadCount = await Notification.count({
    where: { farmerId, readAt: null }
  });

  return { notifications, total, unreadCount };
};

// Mark notification as read
export const markAsRead = async (
  notificationId: string,
  farmerId: string
): Promise<boolean> => {
  const notification = await Notification.findOne({
    where: { id: notificationId, farmerId }
  });

  if (!notification) {
    return false;
  }

  await notification.update({ readAt: new Date() });
  return true;
};

// Mark all notifications as read
export const markAllAsRead = async (farmerId: string): Promise<number> => {
  const [updatedCount] = await Notification.update(
    { readAt: new Date() },
    { where: { farmerId, readAt: null } }
  );

  return updatedCount;
};

// Delete old notifications (cleanup job)
export const cleanupOldNotifications = async (daysOld: number = 90): Promise<number> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const deletedCount = await Notification.destroy({
    where: {
      createdAt: { [Op.lt]: cutoffDate },
      readAt: { [Op.ne]: null }
    }
  });

  return deletedCount;
};

// Create system notification for all farmers
export const createSystemNotification = async (
  title: string,
  message: string
): Promise<number> => {
  const farmers = await Farmer.findAll({ attributes: ['id'] });

  let count = 0;
  for (const farmer of farmers) {
    await createNotification({
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
