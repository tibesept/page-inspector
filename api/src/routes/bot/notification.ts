import { Router } from "express";
import { prisma } from "../../db";

const router = Router();

// GET /api/notifications/unsent
router.get("/unsent", async (req, res, next) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { sent: false },
            orderBy: { createdAt: "asc" },
            take: 100 // Batch size
        });

        res.json(notifications.map((n: any) => ({
            ...n,
            userId: Number(n.userId)
        })));
    } catch (err) {
        next(err);
    }
});

// PATCH /api/notifications/:id/sent
router.patch("/:id/sent", async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        
        await prisma.notification.update({
            where: { id },
            data: { sent: true }
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
