
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
            
            // Return 402 Payment Required if pending payment exists - same format as login
            if (result.paymentRequired) {
                return res.status(402).json({ 
                    success: false, 
                    verified: false,  // MPIN not verified yet at this stage
                    code: 'PAYMENT_REQUIRED', 
                    message: result.message || 'Payment required before login', 
                    data: {
                        roleId: result.roleId,
                        roleName: result.roleName,
                        reporter: result.reporter,
                        tenant: result.tenant,
                        outstanding: result.outstanding,
                        breakdown: result.breakdown
                    }
                });
            }
            
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }
}
