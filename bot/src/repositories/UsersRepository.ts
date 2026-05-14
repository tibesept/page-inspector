import { ApiService } from "#api/ApiService.js";
import { User } from "#core/models/User.js";
import { UserDTO } from "#api/types.js";
import { logger } from "#core/logger.js";

export interface IUsersRepository {
    getUserById(id: number): Promise<User | null>; 
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


    private mapGetDtoToModel(dto: UserDTO): User {
        if (!dto) throw new Error("Cannot map null DTO to model");

        return {
            userId: dto.userId,
            balance: dto.balance
        };
    }

}
