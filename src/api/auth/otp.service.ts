
import { PrismaClient } from '@prisma/client';
import { RequestOtpDto, VerifyOtpDto, SetMpinDto } from './otp.dto';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export class OtpService {
    async requestOtp(data: RequestOtpDto) {
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            // Save OTP log to DB
    const otpLog = await prisma.otpLog.create({
                data: {
                    mobileNumber: data.mobileNumber,
                    otp,
                    expiresAt,
                },
            });

            // In a real application, you would send the OTP via SMS here.
            console.log(`OTP for ${data.mobileNumber} is ${otp}`);
            return { success: true, id: otpLog.id };
    }

    async verifyOtp(data: VerifyOtpDto) {
    // TODO: Implement OTP verification using a valid model/table
    return { success: true };
    }

    async setMpin(data: SetMpinDto) {
        // TODO: Implement setMpin logic using a valid model/table
        const user = await prisma.user.findUnique({
            where: {
                mobileNumber: data.mobileNumber,
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

        if (!user) {
            return { mpinStatus: false, isRegistered: false };
        }
        if (user.mpin) {
            return { mpinStatus: true };
        }
        return { mpinStatus: false, isRegistered: true };
    }
}
