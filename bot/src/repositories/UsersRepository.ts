import { ApiService } from "#api/ApiService.js";
import { User } from "#core/models/User.js";
import { UserDTO, CartDTO, ProductId, CheckoutResponseDTO } from "#api/types.js";
import { logger } from "#core/logger.js";

export interface IUsersRepository {
    getUserById(id: number): Promise<User | null>; 
    createPaymentIntent(userId: number, amountCredits: number, amountStars: number): Promise<{ id: string }>;
    confirmPayment(paymentId: string, telegramChargeId: string): Promise<{ success: boolean; alreadyProcessed: boolean }>;
    getCart(userId: number): Promise<CartDTO>;
    addToCart(userId: number, productId: ProductId): Promise<any>;
    removeFromCart(userId: number, productId: ProductId): Promise<any>;
    checkoutCart(userId: number, url: string): Promise<CheckoutResponseDTO>;
}

export class UsersRepository implements IUsersRepository {
    constructor(private readonly apiService: ApiService) {}

    public async getUserById(id: number): Promise<User | null> {
        const dto = await this.apiService.getUserById(id);
        if(!dto) {
            return null;
        }

        return this.mapGetDtoToModel(dto);
    }

    public async createPaymentIntent(userId: number, amountCredits: number, amountStars: number) {
        return await this.apiService.createPaymentIntent({
            userId,
            amountCredits,
            amountStars
        });
    }

    public async confirmPayment(paymentId: string, telegramChargeId: string) {
        return await this.apiService.confirmPayment({
            paymentId,
            telegramChargeId
        });
    }

    public async getCart(userId: number): Promise<CartDTO> {
        return await this.apiService.getCart(userId);
    }

    public async addToCart(userId: number, productId: ProductId): Promise<any> {
        return await this.apiService.addToCart(userId, productId);
    }

    public async removeFromCart(userId: number, productId: ProductId): Promise<any> {
        return await this.apiService.removeFromCart(userId, productId);
    }

    public async checkoutCart(userId: number, url: string): Promise<CheckoutResponseDTO> {
        return await this.apiService.checkoutCart(userId, url);
    }

    private mapGetDtoToModel(dto: UserDTO): User {
        if (!dto) throw new Error("Cannot map null DTO to model");

        return {
            userId: dto.userId,
            balance: dto.balance
        };
    }

}
