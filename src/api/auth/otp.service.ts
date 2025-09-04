
import { PrismaClient } from '@prisma/client';
import { RequestOtpDto, VerifyOtpDto, SetMpinDto } from './otp.dto';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export class OtpService {
    async requestOtp(data: RequestOtpDto) {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const otpLog = await prisma.otpLog.create({
            data: {
                otp,
                mobileNumber: data.mobileNumber,
                expiresAt,
            },
        });

        // In a real application, you would send the OTP via SMS here.
        console.log(`OTP for ${data.mobileNumber} is ${otp}`);

        return { id: otpLog.id };
    }

    async verifyOtp(data: VerifyOtpDto) {
        const otpLog = await prisma.otpLog.findFirst({
            where: {
                id: data.id,
                otp: data.otp,
                expiresAt: { gt: new Date() },
            },
        });

        if (!otpLog) {
            throw new Error('Invalid or expired OTP');
        }

        return { success: true };
    }

    async setMpin(data: SetMpinDto) {
        const otpLog = await prisma.otpLog.findFirst({
            where: {
                id: data.id,
            },
        });

        if (!otpLog) {
            throw new Error('Invalid request');
        }

        const user = await prisma.user.findUnique({
            where: {
                mobileNumber: otpLog.mobileNumber,
            },
        });

        if (!user) {
            throw new Error('User not found');
        }

        const saltRounds = 10;
        const hashedMpin = await bcrypt.hash(data.mpin, saltRounds);

        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                mpin: hashedMpin,
            },
        });

        return { success: true };
    }

    async getMpinStatus(mobileNumber: string) {
        const user = await prisma.user.findUnique({
            where: {
                mobileNumber,
            },
        });

        return { hasMpin: !!user?.mpin };
    }
}
