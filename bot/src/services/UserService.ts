import { logger } from "#core/logger.js";
import { IUsersRepository } from "#repositories/UsersRepository.js";
import { CartDTO, ProductId, CheckoutResponseDTO } from "#api/types.js";

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

    public async createPaymentIntent(userId: number, amountCredits: number, amountStars: number) {
        try {
            return await this.userRepository.createPaymentIntent(userId, amountCredits, amountStars);
        } catch (error) {
            logger.error(error, "Failed to create payment intent");
            throw error;
        }
    }

    public async confirmPayment(paymentId: string, telegramChargeId: string) {
        try {
            return await this.userRepository.confirmPayment(paymentId, telegramChargeId);
        } catch (error) {
            logger.error(error, "Failed to confirm payment");
            throw error;
        }
    }

    public async getCart(userId: number): Promise<CartDTO> {
        try {
            return await this.userRepository.getCart(userId);
        } catch (error) {
            logger.error(error, "Failed to get cart");
            throw error;
        }
    }

    public async addToCart(userId: number, productId: ProductId) {
        try {
            return await this.userRepository.addToCart(userId, productId);
        } catch (error) {
            logger.error(error, "Failed to add to cart");
            throw error;
        }
    }

    public async removeFromCart(userId: number, productId: ProductId) {
        try {
            return await this.userRepository.removeFromCart(userId, productId);
        } catch (error) {
            logger.error(error, "Failed to remove from cart");
            throw error;
        }
    }

    public async checkoutCart(userId: number, url: string): Promise<CheckoutResponseDTO> {
        try {
            return await this.userRepository.checkoutCart(userId, url);
        } catch (error) {
            logger.error(error, "Failed to checkout cart");
            throw error;
        }
    }
}

