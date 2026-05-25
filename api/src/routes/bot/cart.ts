import { Router, Request, Response } from "express";
import { CartService } from "../../service/cartService";
import { ProductId } from "../../types";
import { BadRequestError } from "../../errors/badRequest";

const router = Router();

// GET /api/bot/cart/:userId
router.get("/:userId", async (req: Request, res: Response, next) => {
    try {
        const userId = req.params.userId;
        if (!userId) {
            throw new BadRequestError("Не указан userId");
        }
        const cart = await CartService.getCart(BigInt(userId));
        res.json(cart);
    } catch (error) {
        next(error);
    }
});

// POST /api/bot/cart/:userId/add (body: { productId: ProductId })
router.post("/:userId/add", async (req: Request, res: Response, next) => {
    try {
        const userId = req.params.userId;
        const { productId } = req.body;

        if (!userId) {
            throw new BadRequestError("Не указан userId");
        }
        if (!productId) {
            throw new BadRequestError("Не указан productId");
        }

        const item = await CartService.addToCart(BigInt(userId), productId as ProductId);
        res.status(201).json(item);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/bot/cart/:userId/remove/:productId
router.delete("/:userId/remove/:productId", async (req: Request, res: Response, next) => {
    try {
        const userId = req.params.userId;
        const productId = req.params.productId;

        if (!userId) {
            throw new BadRequestError("Не указан userId");
        }
        if (!productId) {
            throw new BadRequestError("Не указан productId");
        }

        await CartService.removeFromCart(BigInt(userId), productId as ProductId);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// POST /api/bot/cart/:userId/checkout (body: { url: string })
router.post("/:userId/checkout", async (req: Request, res: Response, next) => {
    try {
        const userId = req.params.userId;
        const { url } = req.body;

        if (!userId) {
            throw new BadRequestError("Не указан userId");
        }
        if (!url) {
            throw new BadRequestError("Не указан URL для анализа");
        }

        const job = await CartService.checkout(BigInt(userId), url);
        res.json({
            success: true,
            job: {
                jobId: job.jobId,
                userId: Number(job.userId),
                status: job.status,
                url: job.url
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
