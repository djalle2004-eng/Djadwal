const nodemailer = require('nodemailer');
const { google } = require('googleapis');

class EmailService {
    constructor() {
        this.oauth2Client = null;
        this.transporter = null;
    }

    async initialize(refreshToken, userEmail) {
        try {
            // Create OAuth2 client
            this.oauth2Client = new google.auth.OAuth2(
                process.env.GMAIL_CLIENT_ID,
                process.env.GMAIL_CLIENT_SECRET,
                process.env.GMAIL_REDIRECT_URI
            );

            this.oauth2Client.setCredentials({
                refresh_token: refreshToken
            });

            console.log(`Initializing email service for: ${userEmail}`);

            // Get access token explicitly
            const accessTokenResponse = await this.oauth2Client.getAccessToken();
            const accessToken = accessTokenResponse.token;

            if (!accessToken) {
                throw new Error('Failed to generate access token');
            }
            console.log('✅ Access token generated successfully');

            // Create transporter with explicit SMTP settings
            this.transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true, // use SSL
                auth: {
                    type: 'OAuth2',
                    user: userEmail,
                    clientId: process.env.GMAIL_CLIENT_ID,
                    clientSecret: process.env.GMAIL_CLIENT_SECRET,
                    refreshToken: refreshToken,
                    accessToken: accessToken
                },
                logger: true,
                debug: true
            });

            console.log('✅ Email service initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize email service:', error);
            throw error;
        }
    }

    async sendEmail(to, subject, html, attachments = []) {
        if (!this.transporter) {
            throw new Error('Email service not initialized');
        }

        const mailOptions = {
            from: this.transporter.options.auth.user,
            to,
            subject,
            html,
            attachments
        };

        return await this.transporter.sendMail(mailOptions);
    }

    async sendProfessorSchedule(professor, pdfBuffer, semester) {
        const subject = `جدولك الدراسي - ${semester}`;
        const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2c3e50;">السلام عليكم ورحمة الله وبركاته</h2>
        <p>الأستاذ(ة) الفاضل(ة) <strong>${professor.name}</strong>,</p>
        <p>نرسل لكم طيه جدولكم الدراسي للفصل <strong>${semester}</strong>.</p>
        <p>يرجى مراجعة الملف المرفق.</p>
        <br>
        <p>مع تحياتنا،<br><strong>إدارة الكلية</strong></p>
      </div>
    `;

        const attachments = [{
            filename: `جدول_${professor.name.replace(/\s+/g, '_')}_${semester}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }];

        return await this.sendEmail(professor.email, subject, html, attachments);
    }
}

module.exports = new EmailService();
