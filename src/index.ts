import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/StringSession.js";
import keytar from "keytar";
import { type AccCredential, type AccInUse, SignedFlowOption } from "./types.js";
import { input, password, select } from "@inquirer/prompts";
import { ExitPromptError } from "@inquirer/core";

import termkit from "terminal-kit"
import { Logger, LogLevel } from "telegram/extensions/Logger.js";

const term = termkit.terminal

const storageName = "telega" 

const env = { // insert real values later
    apiHash: "6f0e62dc1fa7f09378d592c8ed6807e7",
    apiId: 27054841,
}

main()

async function main(): Promise<void> {
    await mainFlow()
}

async function selectAccount(accounts: AccCredential[], index: number): Promise<AccCredential> {
    return new Promise((resolve) => {
        let selectedIndex = index
        function render() {
            term.clear()
            term("[q] [h] [a]")
            term("\n")
            accounts.forEach((account, index) => {
                if (selectedIndex === index) {
                    term(`> ${account.name}`)
                } else {
                    term(account.name)
                }
                term("\n")

            })
        }
        render()

        term.grabInput(true)

        function onKey(name: string) {
            if (isQuit(name)) {
                term.removeListener("key", onKey)
                term.grabInput(false)
                process.exit(0)
            }

            if (isAddAccount(name)) {
                term.removeListener("key", onKey)
                term.grabInput(false)
                addAccount().then((credential) => {
                    selectAccount([...accounts, credential], 0)
                })
                return
            }

            if (isHelp(name)) {
                term("Help goes here")
                term("\n")
                return
            }

            if (name === "j") {
                if (selectedIndex !== accounts.length - 1) {
                    selectedIndex += 1
                    render()
                }
                return
            }

            if (name === "k") {
                if (selectedIndex !== 0) {
                    selectedIndex -= 1
                    render()
                }
                return
            }

            if (name === "ENTER") {
                if (accounts.length === 0) {
                    return
                }

                const credential = accounts[selectedIndex]
                if (credential === undefined) {
                    return
                }
                term.removeListener("key", onKey)
                term.grabInput(false)
                resolve(credential)
                return
            }
        }

        term.on("key", onKey)
    })
}

async function mainFlow(): Promise<void> {
    const accounts = await getAccounts()    

    if (accounts.length === 0) {
        const credential = await addAccount()
        const accInUse = await useAccount(credential)
        term.clear()
        term(accInUse.cred.name)
        term("\n")
        await signedFlow(accInUse)
        return
    }

    if (accounts.length === 1) {
        const credential = accounts[0]
        if (credential === undefined) {
            return
        }

        const accInUse = await useAccount(credential)
        term.clear()
        term(accInUse.cred.name)
        term("\n")
        await signedFlow(accInUse)
        return
    }


    const credential = await selectAccount(accounts, 0)
    const accInUse = await useAccount(credential)
    
    term.clear()
    term(accInUse.cred.name)
    term("\n")

    await signedFlow(accInUse)
}

async function signedFlow(accInUse: AccInUse): Promise<void> {
    const action = await getSignedFlowOption() 

    switch (action) {
        case SignedFlowOption.help:
            term("Help is going to be here later")
            term("\n")
            await signedFlow(accInUse)
            break
        case SignedFlowOption.quit:
            process.exit(0) 
        case SignedFlowOption.addAccount:
            await addAccount()
            await signedFlow(accInUse)
            break
        case SignedFlowOption.signOut:
            try {
                const choice = await select({
                    message: "Are you sure you want to sign out?",
                    choices: [
                        { name: "Yes", value: true },
                        { name: "No", value: false },
                    ],
                    theme: {
                        keybindings: [ "vim" ],
                    },
                })

                if (choice) {
                    await Promise.all([
                        accInUse.client.invoke(new Api.auth.LogOut()),
                        keytar.deletePassword(storageName, accInUse.cred.userId),
                    ])
                    await mainFlow()
                } else {
                    await signedFlow(accInUse)
                }
            } catch (error) {
                if (error instanceof ExitPromptError) {
                    process.exit(0)
                }
                throw error
            }

            break
        case SignedFlowOption.dialogs:
            term("dialogs")
            term("\n")
            break
        case SignedFlowOption.switchAccount:
            const accounts = await getAccounts() 
            const currentIndex = accounts.findIndex((account) => {
                return account.userId === accInUse.cred.userId
            }) ?? 0 
            const account = await selectAccount(accounts, currentIndex) 
            const newAccInUse = await useAccount(account)
            await signedFlow(newAccInUse)
            break
    }
       
}

async function useAccount(credential: AccCredential): Promise<AccInUse> {
    const session = new StringSession(credential.token) 
    const client = new TelegramClient(session, env.apiId, env.apiHash, {
        reconnectRetries: 5,
        baseLogger: new Logger(LogLevel.NONE),
    }) 

    await client.connect()
    return { 
        cred: credential, 
        client: client 
    }
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

function isQuit(command: string): boolean {
    return command === "q" || command === "CTRL_C"
}

function isHelp(command: string): boolean {
    return command === "h"
}

function isAddAccount(command: string): boolean {
    return command === "a"
}

function isDialogs(command: string): boolean {
    return command === "d"
} 

function isSwitchAccount(command: string): boolean {
    return command === "z"
} 

function isSignOut(command: string): boolean {
    return command === "o"
}

function getSignedFlowOption(): Promise<SignedFlowOption> {
    return new Promise((resolve) => {
        term("[h] [a] [q] [z] [d] [o]")
        term("\n")

        term.grabInput(true)

        function onKey(name: string) {
            if (isHelp(name)) {
                term.removeListener("key", onKey)
                term.grabInput(false)
                resolve(SignedFlowOption.help)
                return
            }

            if (isQuit(name)) {
                term.removeListener("key", onKey)
                term.grabInput(false)
                resolve(SignedFlowOption.quit)
                return
            }

            if (isAddAccount(name)) {
                term.removeListener("key", onKey)
                term.grabInput(false)
                resolve(SignedFlowOption.addAccount)
                return
            }

            if (isSignOut(name)) {
                term.removeListener("key", onKey)
                term.grabInput(false)
                resolve(SignedFlowOption.signOut)
                return
            }

            if (isDialogs(name)) {
                term.removeListener("key", onKey)
                term.grabInput(false)
                resolve(SignedFlowOption.dialogs)
                return
            }

            if (isSwitchAccount(name)) {
                term.removeListener("key", onKey)
                term.grabInput(false)
                resolve(SignedFlowOption.switchAccount)
                return
            }
        }

        term.on("key", onKey)
    })
}


async function addAccount(): Promise<AccCredential> {
    const client = new TelegramClient(new StringSession(), env.apiId, env.apiHash, {
        reconnectRetries: 5,
        baseLogger: new Logger(LogLevel.NONE),
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
    await keytar.setPassword(storageName, userId, newToken + "!" + name)

    await client.disconnect()

    return {
        userId: userId,
        name: name, 
        token: newToken,
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

async function getAccounts(): Promise<AccCredential[]> {
    const accounts = await keytar.findCredentials(storageName)

    return accounts.map(item => {
        const password = item.password
        const bang = password.indexOf("!")
        const token = password.slice(0, bang) 
        const name = password.slice(bang + 1)
        return {
            userId: item.account,
            name: name, 
            token: token,
        }
    })
}
