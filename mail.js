import nodemailer from 'nodemailer';
import './dotEnvConfig.js';
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL,
        pass: process.env.APP_PASSWORD
    }
});

const sendEmail = (content) => {
    return new Promise((resolve, reject) => {
        const mailOptions = {
            from: process.env.MAIL,
            to: content.to,
            subject: content.subject,
            html: content.message,
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
                reject(error);
            } else {
                console.log('Email sent: ' + info.response);
                resolve(info.response);
            }
        });
    });
};

export default sendEmail;
