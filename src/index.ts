import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/StringSession.js";
import { input, password, select } from "@inquirer/prompts";
import { ExitPromptError } from "@inquirer/core";
import keytar from "keytar";
import { match, none, run, some } from "./option.js";
import { type Option } from "./option.js";

// later will be moved to real .env
const storageName = "telega";

type EnvVariables = {
    apiId: number,
    apiHash: string,
}

async function main() {
    const env = await getEnvVariables()

    const accounts = await getAccounts()

    const quitAppValue = "quit_app"

    const quitAppItem = ({
        name: "Quit",
        value: quitAppValue,
    }) 

    const addAccountValue = "add_new_account"

    const addAccountItem = ({
        name: "Add new account",
        value: addAccountValue,
    })

    const accountItems = accounts.keys()
        .map(item => ({ name: item, value: item }))

    const choices = [quitAppItem, addAccountItem, ...accountItems]

    let choice: string

    try {
        choice = await select({ 
            message: "Select:", 
            choices: choices,
            theme: {
                keybindings: [ "vim" ]
            },
        }) as string 
    } catch (error) {
        if (error instanceof ExitPromptError) {
            process.exit(0)
        }
        throw error
    }

    let tokenOrNone: Option<string> 
    if (choice === quitAppValue) {
        process.exit(0) 
    } else if (choice === addAccountValue) {
        tokenOrNone = none()
    } else {
        const choiceToken = accounts.get(choice)
        if (choiceToken === undefined) {
            tokenOrNone = none()
        } else {
            tokenOrNone = some(choiceToken)
        }
    }

    const client = createTelegramClient(tokenOrNone, env)
    run(
        tokenOrNone, 
        {
            ifNone: async () => {
                // if not signed in 
             
                await anonUserFlow(client)
            },
            ifSome: async () => {
                // if signed in

                await signedUserFlow(client, choice)
            },
        }
    )
}


async function getEnvVariables(): Promise<EnvVariables> {
    return { // insert real values later
        apiHash: "6f0e62dc1fa7f09378d592c8ed6807e7",
        apiId: 27054841,
    }
}

async function getPhoneNumber(): Promise<string> {
    try {
        return await input({ message: "Enter your phone number:" })
    } catch (error) {
        if (error instanceof ExitPromptError) process.exit(0)
        throw error
    }
}

async function getPassword(): Promise<string> {
    try {
        return await password({ message: "Enter password:" })
    } catch (error) {
        if (error instanceof ExitPromptError) process.exit(0)
        throw error
    }
}

async function getPhoneCode(): Promise<string> {
    try {
        return await input({ message: "Enter your phone code:" })
    } catch (error) {
        if (error instanceof ExitPromptError) process.exit(0)
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

async function signedUserFlow(client: TelegramClient, userId: string): Promise<void> {
    console.log("logged")

    await new Promise(resolve => setTimeout(resolve, 4 * 1000));

    // await signOut(client, userId)
    // await anonUserFlow(client)
}

async function anonUserFlow(client: TelegramClient): Promise<void> {
    console.log("anon")
    const userId = await signIn(client)
    await signedUserFlow(client, userId)
}

async function signIn(client: TelegramClient): Promise<string> {
    await client.start({
        phoneNumber: getPhoneNumber,
        password: getPassword,
        phoneCode: getPhoneCode,
        onError: console.log,
    }) 

    const newToken = (client.session as StringSession).save()
    const me = await client.getMe()

    const userId = me.id
    const userIdStr = `${userId}`
    await keytar.setPassword(storageName, userIdStr, newToken)

    return userIdStr
}

async function signOut(client: TelegramClient, userId: string): Promise<void> {
    await Promise.all([
        client.invoke(new Api.auth.LogOut()),
        keytar.deletePassword(storageName, userId)
    ])
}


function createTelegramClient(token: Option<string>, env: EnvVariables): TelegramClient {
    const apiId = env.apiId
    const apiHash = env.apiHash
    const connectionRetries = 5

    const session = match(
        token, 
        {
            ifNone: () => { 
                return new StringSession(); 
            },
            ifSome: (value) => {
                return new StringSession(value); 
            },
        }
    )
    return new TelegramClient(session, apiId, apiHash, {
        connectionRetries: connectionRetries,
    });
} 


// start of the program
main()
