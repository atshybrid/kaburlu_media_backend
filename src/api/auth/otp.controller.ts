
import { Request, Response } from 'express';
import { OtpService } from './otp.service';
import { RequestOtpDto, VerifyOtpDto, SetMpinDto } from './otp.dto';

const otpService = new OtpService();

export class OtpController {
    async requestOtp(req: Request, res: Response) {
        try {
            const data: RequestOtpDto = req.body;
            const result = await otpService.requestOtp(data);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async verifyOtp(req: Request, res: Response) {
        try {
            const data: VerifyOtpDto = req.body;
            const result = await otpService.verifyOtp(data);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async setMpin(req: Request, res: Response) {
        try {
            const data: SetMpinDto = req.body;
            const result = await otpService.setMpin(data);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async getMpinStatus(req: Request, res: Response) {
        try {
            const { mobileNumber } = req.params;
            const result = await otpService.getMpinStatus(mobileNumber);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }
}
