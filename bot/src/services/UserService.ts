import { logger } from "#core/logger.js";
import { IUsersRepository } from "#repositories/UsersRepository.js";

/**
 * Операции с юзерами (на уровне бизнес-логики)
 */
export class UserService {
    constructor(
        private readonly userRepository: IUsersRepository
    ) {}

    public async getUserById(id: number) {
        try {
            const userData = await this.userRepository.getUserById(id);
            if (!userData) {
                throw new Error("User not found");
            }
            return userData;
        } catch (error) {
            logger.error(error, "Failed to fetch user data");
            throw error;
        }
    }

}
