import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/StringSession.js";
import { input, password, select } from "@inquirer/prompts";
import { ExitPromptError } from "@inquirer/core";
import keytar from "keytar";
import { auth } from "telegram/client/index.js";
import type { UserInfo } from "node:os";

const storageName = "telega";

type EnvVariables = {
    apiId: number,
    apiHash: string,
}

type SelectItem = {
    name: string,
    value: string,
}

main()

async function main(): Promise<void> {
    await mainFlow()
}

async function mainFlow(): Promise<void> {
    const accounts = await getAccounts()    
    const items = mapToSelectItemList(accounts)

    const choice = await select({
        message: "Select:",
        choices: [
            ...items,
            { name: "Add Account", value: "add_account" },
            { name: "Quit", value: "quit_value" },
        ],
        theme: { keybindings: [ "vim" ] },
    }) 

    const env = getEnvVariables()
    switch (choice) {
        case "quit_value": 
            process.exit(0) 
        case "add_account":
            await addAccount(env)
            await mainFlow()
            break
        default:
            const userToken = choice 
            const client = await useAccount(userToken, env)
            await signedFlow(client, items)
            break
    }
}

async function useAccount(userToken: string, env: EnvVariables): Promise<TelegramClient> {
    const session = new StringSession(userToken) 
    const client = new TelegramClient(session, env.apiId, env.apiHash, {
        reconnectRetries: 5
    }) 

    await client.connect()
    return client
}

function getVisibleName(me: Api.User): string {
    const firstName = me.firstName ?? ""
    const lastName = me.lastName ?? ""

    if (firstName === "" && lastName !== "") {
        return lastName
    } 

    if (firstName !== "" && lastName === "") {
        return firstName 
    }

    if (firstName !== "" && lastName !== "") {
       return firstName + " " + lastName
    } 

    const username = me.username ?? ""
    if (username !== "") {
        return username
    }

    const phone = me.phone ?? ""
    if (phone !== "") {
        return phone
    }

    return `${me.id}`
}

async function signedFlow(client: TelegramClient) : Promise<void> {
    const me = await client.getMe()

    const userId = `${me.id}`

    const name = getVisibleName(me)

    const accountsMap = await getAccounts()
    accountsMap.delete(userId)

    const items = mapToSelectItemList(accountsMap) 

    const choice = await select({
        message: `${name}`,
        choices: [
            { name: "Get Chats", value: "get_chats" },
            ...items,
            { name: "Sign Out", value: "sign_out" },
            { name: "Add Account", value: "add_account" },
            { name: "Quit", value: "quit_value" },
        ],
        theme: { keybindings: [ "vim" ] },
    }) 

    switch (choice) {
        case "get_chats": 
            break
        case "sign_out": 
            await client.invoke(new Api.auth.LogOut())
            await keytar.deletePassword(storageName, userId)
            await mainFlow()
            break
        case "add_account":
            await addAccount(client)
            await signedFlow(client)
            break
        case "quit_value":
            process.exit(0)
        default:
            const userToken = choice
            const env = getEnvVariables()
            await client.disconnect()
            const newClient = await useAccount(userToken, env)
            await signedFlow(newClient)
            break
    }
} 

async function addAccount(env: EnvVariables): Promise<void> {
    const client = new TelegramClient(new StringSession(), env.apiId, env.apiHash, {
        reconnectRetries: 5
    }) 

    await client.start({
        phoneNumber: getPhoneNumber,
        phoneCode: getPhoneCode,
        password: getPassword,
        onError: console.error,
    })

    const newToken = (client.session as StringSession).save()
    const me = await client.getMe()

    const userId = me.id
    const userIdStr = `${userId}`
    await keytar.setPassword(storageName, userIdStr, newToken)


    await client.disconnect()
}

function getEnvVariables(): EnvVariables {
    return { // insert real values later
        apiHash: "6f0e62dc1fa7f09378d592c8ed6807e7",
        apiId: 27054841,
    }
}

async function getPhoneNumber(): Promise<string> {
    try {
        return await input({ message: "Enter your phone number:" })
    } catch (error) {
        if (error instanceof ExitPromptError) { 
            process.exit(0) 
        }
        throw error
    }
}

async function getPassword(): Promise<string> {
    try {
        return await password({ message: "Enter password:" })
    } catch (error) {
        if (error instanceof ExitPromptError) { 
            process.exit(0) 
        }
        throw error
    }
}

async function getPhoneCode(): Promise<string> {
    try {
        return await input({ message: "Enter your phone code:" })
    } catch (error) {
        if (error instanceof ExitPromptError) { 
            process.exit(0) 
        }
        throw error
    }
}

async function getAccounts(): Promise<Map<string, string>> {
    const accounts = await keytar.findCredentials(storageName)
    const accountMap = new Map<string, string>()
    accounts.forEach(account => {
        accountMap.set(account.account, account.password)
    })
    return accountMap
}

function mapToSelectItemList(map: Map<string, string>): SelectItem[] {
    const items = map.entries().map((entry) => {
        return {
            name: entry[0], value: entry[1],
        }
    })
    return [...items]
} 
