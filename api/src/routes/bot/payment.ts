import { Router, Request, Response } from "express";
import { 
    createPaymentIntentBodySchema, 
    confirmPaymentBodySchema, 
    PaymentIntentDTO,
    TELEGRAM_STARS_RATE
} from "../../types";
import { PaymentService } from "../../service/paymentService";
import { BadRequestError } from "../../errors/badRequest";
import logger from "../../logger";

const router = Router();

// Создание намерения платежа
router.post("/", async (req: Request, res: Response<PaymentIntentDTO>) => {
    const body = createPaymentIntentBodySchema.parse(req.body);
    
    // Валидируем курс конвертации на сервере для безопасности платежной системы
    if (body.amountStars !== body.amountCredits * TELEGRAM_STARS_RATE) {
        throw new BadRequestError(
            `Неверный курс обмена. Ожидалось ${body.amountCredits * TELEGRAM_STARS_RATE} Stars для ${body.amountCredits} кредитов.`
        );
    }
    
    logger.info({ userId: body.userId, credits: body.amountCredits }, "Creating payment intent");
    
    const payment = await PaymentService.createPaymentIntent(
        body.userId,
        body.amountCredits,
        body.amountStars
    );

    const dto: PaymentIntentDTO = {
        id: payment.id,
        userId: Number(payment.userId),
        amountCredits: Number(payment.amountCredits),
        amountStars: payment.amountStars,
        status: payment.status
    };

    res.status(201).json(dto);
});

// Подтверждение платежа
router.post("/confirm", async (req: Request, res: Response) => {
    const body = confirmPaymentBodySchema.parse(req.body);
    
    logger.info({ paymentId: body.paymentId, chargeId: body.telegramChargeId }, "Confirming payment");

    const result = await PaymentService.confirmPayment(
        body.paymentId,
        body.telegramChargeId
    );

    res.json({
        success: true,
        alreadyProcessed: result.alreadyProcessed,
        payment: {
            id: result.payment.id,
            userId: Number(result.payment.userId),
            amountCredits: Number(result.payment.amountCredits),
            amountStars: result.payment.amountStars,
            status: result.payment.status
        }
    });
});

export default router;
