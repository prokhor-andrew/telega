import type { TelegramClient } from "telegram"

export type EnvVariables = {
    apiId: number,
    apiHash: string,
}

export type AccCredential = {
    userId: string,
    name: string,
    token: string,
}


export type AccInUse = {
    cred: AccCredential,
    client: TelegramClient,
}

export enum SignedFlowOption {
    help, 
    quit,
    addAccount, 
    signOut, 
    dialogs, 
    switchAccount,  
    profile,
} 
