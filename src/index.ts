import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/StringSession.js";
import { input, password, select } from "@inquirer/prompts";
import { ExitPromptError } from "@inquirer/core";
import keytar from "keytar";
import type { TotalList } from "telegram/Helpers.js";
import type { Dialog } from "telegram/tl/custom/dialog.js";

const tokenStorageName = "telega";
const nameStorageName = "telega_name_storage" 

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

async function customSelect(args: {
    message: string,
    choices: readonly SelectItem[],
}): Promise<string> {
    const { message, choices } = args
    try {
        return await select({
            message: message,
            choices: choices,
            loop: false,
            theme: { keybindings: [ "vim" ] },
        })
    } catch (error) {
        if (error instanceof ExitPromptError) {
            process.exit(0)
        }
        throw error
    }
}

async function mainFlow(): Promise<void> {
    const accountsMap = await getAccounts()    
    const items = mapToSelectItemList(accountsMap)

    const choice = await customSelect({
        message: "Select:",
        choices: [
            ...items,
            { name: "Add Account", value: "add_account" },
            { name: "Quit", value: "quit_value" },
        ],
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
            console.log("test")
            await signedFlow(client)
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

    const choice = await customSelect({
        message: `${name}`,
        choices: [
            { name: "Get Chats", value: "get_chats" },
            ...items,
            { name: "Sign Out", value: "sign_out" },
            { name: "Add Account", value: "add_account" },
            { name: "Quit", value: "quit_value" },
        ],
    }) 

    switch (choice) {
        case "get_chats": 
            const dialogs = await client.getDialogs()
            await showDialogs(dialogs)
            break
        case "sign_out": 
            await client.invoke(new Api.auth.LogOut())
            await keytar.deletePassword(tokenStorageName, userId)
            await keytar.deletePassword(nameStorageName, userId)
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

async function showDialogs(dialogs: TotalList<Dialog>): Promise<void> {
    const items = dialogs.map(dialog => {
        const unreadStr = dialog.unreadCount !== 0 ? ` (${dialog.unreadCount} unread)` : ""
        return {
            name: dialog.title + unreadStr,     
            value: `${dialog.id ?? 0}`
        }
    })

    const choice = await customSelect({
        message: "Dialogs:",
        choices: [
            { name: "Back", value: "back" },
            ...items,
        ],
    })

    switch (choice) {
        case "back":
            break
        default:
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
   
    const name = getVisibleName(me)

    const userId = `${me.id}`
    await keytar.setPassword(tokenStorageName, userId, newToken)
    await keytar.setPassword(nameStorageName, userId, name)

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

type NameToken = {
    name: string,
    token: string,
}

async function getAccounts(): Promise<Map<string, NameToken>> {
    const tokensAccounts = await keytar.findCredentials(tokenStorageName)
    const namesAccounts = await keytar.findCredentials(nameStorageName) 

    const accountsMap = new Map<string, NameToken>()

    tokensAccounts.forEach(tokenAccount => {
        namesAccounts.forEach(nameAccount => {
            if (tokenAccount.account === nameAccount.account) {
                accountsMap.set(
                    nameAccount.account, 
                    { 
                        name: nameAccount.password, 
                        token: tokenAccount.password 
                    }
                )
            }
        })
    })
    return accountsMap
}

function mapToSelectItemList(map: Map<string, NameToken>): SelectItem[] {
    const items = map.entries().map((entry) => {
        return {
            name: entry[1].name, 
            value: entry[1].token,
        }
    })
    return [...items]
}
