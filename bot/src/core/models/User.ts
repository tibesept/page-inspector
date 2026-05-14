
/**
 * Доменная модель юзера
 * Эта модель используется в Service Layer (UserService)
 */
export interface User {
    userId: number;
    balance: number;
}