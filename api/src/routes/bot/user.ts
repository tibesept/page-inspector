import { Router, Request, Response } from "express";
import { createJobBodySchema, UserDTO } from "../../types";
import { UserService } from "../../service/userService";
import { BadRequestError } from "../../errors/badRequest";
import logger from "../../logger";

const router = Router();

router.get("/:id", async (req: Request, res: Response<UserDTO>) => {

    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
        throw new BadRequestError("invalid userId")
    }

    
    const user = await UserService.getUserAndCreateIfNotExists(userId);
    const dto: UserDTO = {
        userId: Number(user.userId),
        balance: typeof user.balance === "number" ? user.balance : Number(user.balance)
    } 

    res.json(dto);
});

export default router;
