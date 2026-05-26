import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/StringSession.js";
import { input, password } from "@inquirer/prompts";
import { ExitPromptError } from "@inquirer/core";
import keytar from "keytar";
import { match, none, run, some } from "./option.js";
import { type Option } from "./option.js";

// later will be moved to real .env
const storageName = "telega";
const tokenKey = "session_token";


type EnvVariables = {
    apiId: number,
    apiHash: string,
}

async function main() {
    const env = await getEnvVariables()
    const tokenOrNone = await getSavedToken()
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

                await signedUserFlow(client)
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

async function getSavedToken(): Promise<Option<string>> {
    const token = await keytar.getPassword(storageName, tokenKey)
    if (token == null) {
        return none()
    }

    return some(token)
}

async function signedUserFlow(client: TelegramClient): Promise<void> {
    console.log("logged")

    await new Promise(resolve => setTimeout(resolve, 4 * 1000));

    await signOut(client)
    await anonUserFlow(client)
}

async function anonUserFlow(client: TelegramClient): Promise<void> {
    console.log("anon")
    await signIn(client)
    await signedUserFlow(client)
}

async function signIn(client: TelegramClient) {
    await client.start({
        phoneNumber: getPhoneNumber,
        password: getPassword,
        phoneCode: getPhoneCode,
        onError: console.log,
    }) 

    const newToken = (client.session as StringSession).save()
    await keytar.setPassword(storageName, tokenKey, newToken)
}

async function signOut(client: TelegramClient): Promise<void> {
    await Promise.all([
        client.invoke(new Api.auth.LogOut()),
        keytar.deletePassword(storageName, tokenKey)
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
