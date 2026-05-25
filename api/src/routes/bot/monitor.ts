import { Router } from "express";
import { prisma } from "../../db";
import { createMonitorBodySchema, updateMonitorBodySchema } from "@page-inspector/shared";

const router = Router();

const parseProductIds = (productIds: any): string[] => {
    if (typeof productIds === "string") {
        try {
            return JSON.parse(productIds);
        } catch {
            return [];
        }
    }
    if (Array.isArray(productIds)) {
        return productIds;
    }
    return [];
};

// GET /api/monitors/:userId
router.get("/:userId", async (req, res, next) => {
    try {
        const userId = BigInt(req.params.userId);
        const monitors = await prisma.scheduledMonitor.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" }
        });
        
        res.json(monitors.map((m: any) => ({
            ...m,
            userId: Number(m.userId),
            productIds: parseProductIds(m.productIds)
        })));
    } catch (err) {
        next(err);
    }
});

// POST /api/monitors/:userId
router.post("/:userId", async (req, res, next) => {
    try {
        const userId = BigInt(req.params.userId);
        const data = createMonitorBodySchema.parse(req.body);

        // initial nextRunAt = now so it gets executed immediately by the next tick
        const monitor = await prisma.scheduledMonitor.create({
            data: {
                userId,
                url: data.url,
                interval: data.interval,
                productIds: data.productIds,
                nextRunAt: new Date()
            }
        });

        res.json({
            ...monitor,
            userId: Number(monitor.userId),
            productIds: parseProductIds(monitor.productIds)
        });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/monitors/:userId/:id
router.patch("/:userId/:id", async (req, res, next) => {
    try {
        const userId = BigInt(req.params.userId);
        const id = parseInt(req.params.id);
        const data = updateMonitorBodySchema.parse(req.body);

        const monitor = await prisma.scheduledMonitor.updateMany({
            where: { id, userId },
            data: {
                ...(data.active !== undefined && { active: data.active }),
                ...(data.interval !== undefined && { interval: data.interval }),
                ...(data.productIds !== undefined && { productIds: data.productIds }),
                // if reactivated, reset nextRunAt to now
                ...(data.active === true && { nextRunAt: new Date() })
            }
        });

        res.json({ success: monitor.count > 0 });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/monitors/:userId/:id
router.delete("/:userId/:id", async (req, res, next) => {
    try {
        const userId = BigInt(req.params.userId);
        const id = parseInt(req.params.id);

        const deleted = await prisma.scheduledMonitor.deleteMany({
            where: { id, userId }
        });

        res.json({ success: deleted.count > 0 });
    } catch (err) {
        next(err);
    }
});

export default router;
