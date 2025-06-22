declare module 'coinbase' {
  export interface ClientOptions {
    apiKey: string;
    apiSecret: string;
    version?: string;
    strictSSL?: boolean;
  }

  export class Client {
    constructor(options: ClientOptions);
    
    getAccounts(options: object, callback: (err: any, data: any) => void): void;
    getAccount(accountId: string, callback: (err: any, data: any) => void): void;
    getTransactions(accountId: string, options: object, callback: (err: any, data: any) => void): void;
    getUser(userId: string, callback: (err: any, data: any) => void): void;
    getCurrentUser(callback: (err: any, data: any) => void): void;
    getBuyPrice(params: {currencyPair: string}, callback: (err: any, data: any) => void): void;
    getSellPrice(params: {currencyPair: string}, callback: (err: any, data: any) => void): void;
    getExchangeRates(params: object, callback: (err: any, data: any) => void): void;
    
    // Add other methods as needed
  }
}